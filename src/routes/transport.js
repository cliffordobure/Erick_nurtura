import express from 'express';
import Transport from '../models/Transport.js';
import Child from '../models/Child.js';
import Notification from '../models/Notification.js';
import { auth, role } from '../middleware/auth.js';
import { sendPushToUsers } from '../services/fcm.js';

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'parent') {
      const childIds = (await Child.find({ parentIds: req.user._id }).select('_id')).map(c => c._id);
      query.childId = { $in: childIds };
    } else if (req.user.role === 'driver') {
      query.driverId = req.user._id;
    }
    const from = req.query.from ? new Date(req.query.from) : new Date();
    const to = req.query.to ? new Date(req.query.to) : new Date(from.getTime() + 24 * 60 * 60 * 1000);
    query.scheduledAt = { $gte: from, $lte: to };
    const list = await Transport.find(query).populate('childId', 'firstName lastName').populate('driverId', 'name phone').sort({ scheduledAt: 1 }).lean();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, role('driver', 'admin'), async (req, res) => {
  try {
    const transport = await Transport.create({
      ...req.body,
      driverId: req.user.role === 'driver' ? req.user._id : req.body.driverId
    });
    const child = await Child.findById(transport.childId).select('parentIds').lean();
    if (child?.parentIds?.length) {
      for (const pid of child.parentIds) {
        await Notification.create({
          userId: pid,
          title: transport.type === 'pickup' ? 'Pick-up scheduled' : 'Drop-off scheduled',
          body: `${transport.type} at ${new Date(transport.scheduledAt).toLocaleString()}`,
          type: 'transport',
          data: { transportId: transport._id }
        });
      }
      const io = req.app.get('io');
      if (io) child.parentIds.forEach(pid => io.to(`user:${pid}`).emit('notification', { title: transport.type === 'pickup' ? 'Pick-up' : 'Drop-off', body: new Date(transport.scheduledAt).toLocaleString() }));
      const pushTitle = transport.type === 'pickup' ? 'Pick-up scheduled' : 'Drop-off scheduled';
      const pushBody = `${transport.type} at ${new Date(transport.scheduledAt).toLocaleString()}`;
      sendPushToUsers(child.parentIds.map(p => p.toString()), pushTitle, pushBody, { type: 'transport', transportId: String(transport._id) }).catch(console.error);
    }
    res.status(201).json(transport);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id', auth, role('driver', 'admin'), async (req, res) => {
  try {
    const transport = await Transport.findById(req.params.id).populate('childId', 'parentIds firstName lastName');
    if (!transport) return res.status(404).json({ error: 'Transport not found' });
    if (req.user.role === 'driver' && transport.driverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { status, eta, actualAt, notes, onBus } = req.body;
    if (status) transport.status = status;
    if (eta !== undefined) transport.eta = eta;
    if (actualAt !== undefined) transport.actualAt = actualAt;
    if (notes !== undefined) transport.notes = notes;
    if (onBus !== undefined) transport.onBus = !!onBus;
    if (status === 'en_route' || status === 'arrived') {
      if (!transport.notifiedParentAt && transport.childId?.parentIds?.length) {
        for (const pid of transport.childId.parentIds) {
          await Notification.create({
            userId: pid,
            title: status === 'en_route' ? 'Driver is on the way' : 'Driver has arrived',
            body: transport.notes || (transport.eta ? 'ETA: ' + new Date(transport.eta).toLocaleTimeString() : ''),
            type: 'transport',
            data: { transportId: transport._id }
          });
        }
        transport.notifiedParentAt = new Date();
        const io = req.app.get('io');
        if (io) transport.childId.parentIds.forEach(pid => io.to(`user:${pid}`).emit('notification', { title: status === 'en_route' ? 'On the way' : 'Arrived', body: transport.notes || '' }));
        const pushTitle = status === 'en_route' ? 'Driver is on the way' : 'Driver has arrived';
        sendPushToUsers(transport.childId.parentIds.map(p => p.toString()), pushTitle, transport.notes || (transport.eta ? 'ETA: ' + new Date(transport.eta).toLocaleTimeString() : ''), { type: 'transport', transportId: String(transport._id) }).catch(console.error);
      }
    }
    if (status === 'completed' && transport.type === 'dropoff' && transport.childId?.parentIds?.length) {
      const childName = [transport.childId.firstName, transport.childId.lastName].filter(Boolean).join(' ') || 'Your child';
      for (const pid of transport.childId.parentIds) {
        await Notification.create({
          userId: pid,
          title: 'Drop-off complete',
          body: `${childName} has been dropped off.`,
          type: 'transport',
          data: { transportId: transport._id }
        });
      }
      const io = req.app.get('io');
      if (io) transport.childId.parentIds.forEach(pid => io.to(`user:${pid}`).emit('notification', { title: 'Drop-off complete', body: `${childName} has been dropped off.` }));
      sendPushToUsers(transport.childId.parentIds.map(p => p.toString()), 'Drop-off complete', `${childName} has been dropped off.`, { type: 'transport', transportId: String(transport._id) }).catch(console.error);
    }
    await transport.save();
    res.json(transport);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/notify-left-school', auth, role('driver', 'admin'), async (req, res) => {
  try {
    const { transportIds } = req.body;
    if (!Array.isArray(transportIds) || transportIds.length === 0) {
      return res.status(400).json({ error: 'transportIds array required with at least one id' });
    }
    const transports = await Transport.find({
      _id: { $in: transportIds },
      driverId: req.user.role === 'driver' ? req.user._id : { $exists: true },
      onBus: true
    }).populate('childId', 'parentIds firstName lastName').lean();
    const notified = new Set();
    for (const t of transports) {
      if (!t.childId?.parentIds?.length) continue;
      const childName = [t.childId.firstName, t.childId.lastName].filter(Boolean).join(' ') || 'Your child';
      for (const pid of t.childId.parentIds) {
        const key = pid.toString();
        if (notified.has(key)) continue;
        notified.add(key);
        await Notification.create({
          userId: pid,
          title: 'Bus has left school',
          body: `${childName} is on the bus. The bus has left school.`,
          type: 'transport',
          data: { transportId: t._id }
        });
      }
      await Transport.updateOne({ _id: t._id }, { leftSchoolNotifiedAt: new Date() });
    }
    const parentIds = [...notified];
    const io = req.app.get('io');
    if (io) parentIds.forEach(pid => io.to(`user:${pid}`).emit('notification', { title: 'Bus has left school', body: 'The bus has left school.' }));
    sendPushToUsers(parentIds, 'Bus has left school', 'The bus has left school. Your child is on the way.', { type: 'transport' }).catch(console.error);
    res.json({ notified: parentIds.length, transports: transports.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

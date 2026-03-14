import express from 'express';
import Request from '../models/Request.js';
import Notification from '../models/Notification.js';
import { auth, role } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    let query = (req.user.role === 'teacher' || req.user.role === 'caretaker') ? { fromId: req.user._id } : { toId: req.user._id };
    const list = await Request.find(query).populate('fromId', 'name').populate('toId', 'name').populate('childId', 'firstName lastName').sort({ createdAt: -1 }).lean();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, role('teacher', 'caretaker', 'admin'), async (req, res) => {
  try {
    const { toId, childId, type, title, body } = req.body;
    if (!toId || !type || !title) return res.status(400).json({ error: 'toId, type and title required' });
    const r = await Request.create({ fromId: req.user._id, toId, childId, type, title, body });
    await Notification.create({
      userId: toId,
      title: 'Request from teacher: ' + title,
      body: body?.slice(0, 100) || '',
      type: 'request',
      data: { requestId: r._id }
    });
    const io = req.app.get('io');
    if (io) io.to(`user:${toId}`).emit('notification', { title: 'Teacher request', body: title });
    res.status(201).json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id/respond', auth, async (req, res) => {
  try {
    const r = await Request.findOne({ _id: req.params.id, toId: req.user._id });
    if (!r) return res.status(404).json({ error: 'Request not found' });
    r.status = req.body.status;
    r.response = req.body.response;
    r.respondedAt = new Date();
    await r.save();
    const io = req.app.get('io');
    if (io) io.to(`user:${r.fromId}`).emit('notification', { title: 'Request responded', body: req.body.status });
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

import express from 'express';
import Activity from '../models/Activity.js';
import Child from '../models/Child.js';
import Class from '../models/Class.js';
import Notification from '../models/Notification.js';
import { auth, role } from '../middleware/auth.js';

const router = express.Router();

/** List activities: teacher = mine; parent = for my kids' classes */
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'teacher' || req.user.role === 'caretaker') {
      query.teacherId = req.user._id;
    } else if (req.user.role === 'parent') {
      const children = await Child.find({ parentIds: req.user._id }).select('classId').lean();
      const classIds = [...new Set(children.map(c => c.classId).filter(Boolean))];
      if (classIds.length) query.classId = { $in: classIds };
      else query.classId = { $in: [] };
    } else if (req.user.schoolId) {
      const classIds = (await Class.find({ schoolId: req.user.schoolId }).select('_id').lean()).map(c => c._id);
      if (classIds.length) query.classId = { $in: classIds };
      else query.classId = { $in: [] };
    } else {
      return res.json([]);
    }
    const list = await Activity.find(query)
      .populate('classId', 'name')
      .populate('teacherId', 'name')
      .populate('recipientParentId', 'name email')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id)
      .populate('classId', 'name')
      .populate('teacherId', 'name')
      .populate('recipientParentId', 'name email')
      .lean();
    if (!activity) return res.status(404).json({ error: 'Activity not found' });
    if (req.user.role === 'parent') {
      const children = await Child.find({ parentIds: req.user._id }).select('classId').lean();
      const classIds = children.map(c => c.classId.toString()).filter(Boolean);
      if (!classIds.includes(activity.classId?._id?.toString())) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else if ((req.user.role === 'teacher' || req.user.role === 'caretaker') && activity.teacherId?._id?.toString() !== req.user._id?.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(activity);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Create activity – teacher only; notify parents (all or single) */
router.post('/', auth, role('teacher', 'caretaker'), async (req, res) => {
  try {
    const { title, body, classId, scheduledAt, photos, recipientType, recipientParentId } = req.body;
    if (!title || !classId) return res.status(400).json({ error: 'Title and class required' });
    const activity = await Activity.create({
      title,
      body: body || '',
      classId,
      teacherId: req.user._id,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      photos: Array.isArray(photos) ? photos : [],
      recipientType: recipientType === 'single' ? 'single' : 'all',
      recipientParentId: recipientType === 'single' && recipientParentId ? recipientParentId : undefined
    });
    let parentIds = [];
    const children = await Child.find({ classId }).select('parentIds').lean();
    parentIds = [...new Set(children.flatMap(c => (c.parentIds || []).map(p => p.toString())))];
    if (req.body.recipientType === 'single' && req.body.recipientParentId) {
      const pid = req.body.recipientParentId.toString();
      if (parentIds.includes(pid)) parentIds = [pid];
      else parentIds = [];
    }

    const msg = `New activity: ${title}`;
    for (const pid of parentIds) {
      await Notification.create({
        userId: pid,
        title: msg,
        body: (body || '').slice(0, 150),
        type: 'activity',
        data: { activityId: activity._id }
      });
    }
    const io = req.app.get('io');
    if (io) parentIds.forEach(pid => io.to(`user:${pid}`).emit('notification', { title: msg, body: (body || '').slice(0, 100) }));

    const populated = await Activity.findById(activity._id)
      .populate('classId', 'name')
      .populate('teacherId', 'name')
      .populate('recipientParentId', 'name email')
      .lean();
    res.status(201).json(populated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

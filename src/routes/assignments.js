import express from 'express';
import Assignment from '../models/Assignment.js';
import Child from '../models/Child.js';
import Notification from '../models/Notification.js';
import { auth, role } from '../middleware/auth.js';
import { sendPushToUsers } from '../services/fcm.js';

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'parent') {
      const childIds = (await Child.find({ parentIds: req.user._id }).select('_id classId')).map(c => c._id);
      const classIds = [...new Set((await Child.find({ parentIds: req.user._id }).select('classId')).map(c => c.classId).filter(Boolean))];
      query.classId = { $in: classIds };
    } else if (req.user.role === 'teacher' || req.user.role === 'caretaker') {
      query.teacherId = req.user._id;
    } else if (req.user.schoolId) {
      const Class = (await import('../models/Class.js')).default;
      const classIds = (await Class.find({ schoolId: req.user.schoolId }).select('_id')).map(c => c._id);
      query.classId = { $in: classIds };
    }
    const list = await Assignment.find(query).populate('classId', 'name').populate('teacherId', 'name').sort({ dueDate: 1 }).lean();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, role('teacher', 'caretaker', 'admin'), async (req, res) => {
  try {
    const assignment = await Assignment.create({
      ...req.body,
      teacherId: req.user._id
    });
    const children = await Child.find({ classId: assignment.classId }).select('parentIds').lean();
    const parentIds = [...new Set(children.flatMap(c => c.parentIds.map(p => p.toString())))];
    for (const pid of parentIds) {
      await Notification.create({
        userId: pid,
        title: 'New assignment: ' + assignment.title,
        body: assignment.description?.slice(0, 100),
        type: 'assignment',
        data: { assignmentId: assignment._id }
      });
    }
    const io = req.app.get('io');
    if (io) parentIds.forEach(pid => io.to(`user:${pid}`).emit('notification', { title: 'New assignment', body: assignment.title }));
    sendPushToUsers(parentIds, 'New assignment', assignment.title, { type: 'assignment', assignmentId: String(assignment._id) }).catch(console.error);
    res.status(201).json(assignment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/send-reminder', auth, role('teacher', 'caretaker', 'admin'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id).populate('classId');
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    const children = await Child.find({ classId: assignment.classId }).select('parentIds').lean();
    const parentIds = [...new Set(children.flatMap(c => c.parentIds.map(p => p.toString())))];
    for (const pid of parentIds) {
      await Notification.create({
        userId: pid,
        title: 'Reminder: ' + assignment.title,
        body: 'Due: ' + (assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'Soon'),
        type: 'reminder',
        data: { assignmentId: assignment._id }
      });
    }
    assignment.reminderSent = true;
    await assignment.save();
    const io = req.app.get('io');
    if (io) parentIds.forEach(pid => io.to(`user:${pid}`).emit('notification', { title: 'Assignment reminder', body: assignment.title }));
    sendPushToUsers(parentIds, 'Reminder: ' + assignment.title, 'Due: ' + (assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'Soon'), { type: 'reminder', assignmentId: String(assignment._id) }).catch(console.error);
    res.json({ sent: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id', auth, role('teacher', 'caretaker', 'admin'), async (req, res) => {
  try {
    const assignment = await Assignment.findOneAndUpdate({ _id: req.params.id, teacherId: req.user._id }, req.body, { new: true });
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    res.json(assignment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

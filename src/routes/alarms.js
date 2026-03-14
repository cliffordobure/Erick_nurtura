import express from 'express';
import ParentAlarm from '../models/ParentAlarm.js';
import Child from '../models/Child.js';
import { auth, role } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, role('parent'), async (req, res) => {
  try {
    const list = await ParentAlarm.find({ parentId: req.user._id })
      .populate('childId', 'firstName lastName')
      .sort({ scheduledTime: 1 })
      .lean();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, role('parent'), async (req, res) => {
  try {
    const { childId, label, note, scheduledTime, repeat, daysOfWeek } = req.body;
    if (!label || !scheduledTime) return res.status(400).json({ error: 'label and scheduledTime required' });
    if (childId) {
      const child = await Child.findOne({ _id: childId, parentIds: req.user._id });
      if (!child) return res.status(400).json({ error: 'Child not found or not yours' });
    }
    const alarm = await ParentAlarm.create({
      parentId: req.user._id,
      childId: childId || undefined,
      label,
      note: note || '',
      scheduledTime: new Date(scheduledTime),
      repeat: repeat === 'daily' || repeat === 'weekly' ? repeat : 'once',
      daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : [],
      enabled: true
    });
    const populated = await ParentAlarm.findById(alarm._id).populate('childId', 'firstName lastName').lean();
    res.status(201).json(populated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id', auth, role('parent'), async (req, res) => {
  try {
    const alarm = await ParentAlarm.findOne({ _id: req.params.id, parentId: req.user._id });
    if (!alarm) return res.status(404).json({ error: 'Alarm not found' });
    const { childId, label, note, scheduledTime, repeat, daysOfWeek, enabled } = req.body;
    if (childId !== undefined) alarm.childId = childId || undefined;
    if (label !== undefined) alarm.label = label;
    if (note !== undefined) alarm.note = note;
    if (scheduledTime !== undefined) alarm.scheduledTime = new Date(scheduledTime);
    if (repeat !== undefined) alarm.repeat = repeat;
    if (daysOfWeek !== undefined) alarm.daysOfWeek = Array.isArray(daysOfWeek) ? daysOfWeek : alarm.daysOfWeek;
    if (enabled !== undefined) alarm.enabled = !!enabled;
    await alarm.save();
    const populated = await ParentAlarm.findById(alarm._id).populate('childId', 'firstName lastName').lean();
    res.json(populated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', auth, role('parent'), async (req, res) => {
  try {
    const alarm = await ParentAlarm.findOneAndDelete({ _id: req.params.id, parentId: req.user._id });
    if (!alarm) return res.status(404).json({ error: 'Alarm not found' });
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

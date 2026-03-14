import mongoose from 'mongoose';
import express from 'express';
import Child from '../models/Child.js';
import Class from '../models/Class.js';
import { auth, role } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'parent') {
      const raw = req.user._id;
      const idStr = raw?.toString?.();
      if (idStr && mongoose.Types.ObjectId.isValid(idStr)) {
        const oid = new mongoose.Types.ObjectId(idStr);
        query.$or = [{ parentIds: oid }, { parentIds: idStr }];
      } else {
        query.parentIds = raw;
      }
    } else if (req.user.role === 'teacher' || req.user.role === 'caretaker') {
      const myClassIds = (await Class.find({ teacherId: req.user._id }).select('_id').lean()).map(c => c._id);
      if (myClassIds.length) query.classId = { $in: myClassIds };
      else query.classId = { $in: [] };
    } else if (req.user.schoolId) {
      query.schoolId = req.user.schoolId;
    }
    const children = await Child.find(query).populate('classId').populate('parentIds', 'name email phone').populate('schoolId', 'name type').lean();
    res.json(children);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const child = await Child.findById(req.params.id).populate('classId').populate('parentIds', 'name email phone').populate('schoolId', 'name type').lean();
    if (!child) return res.status(404).json({ error: 'Child not found' });
    if (req.user.role === 'parent' && !child.parentIds.some(p => p._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(child);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, role('teacher', 'caretaker', 'admin'), async (req, res) => {
  try {
    const child = await Child.create({ ...req.body, schoolId: req.body.schoolId || req.user.schoolId });
    res.status(201).json(child);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const child = await Child.findById(req.params.id);
    if (!child) return res.status(404).json({ error: 'Child not found' });
    if (req.user.role === 'parent') {
      const allowed = ['allergies', 'notes'];
      const updates = {};
      allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
      Object.assign(child, updates);
      await child.save();
    } else {
      Object.assign(child, req.body);
      await child.save();
    }
    res.json(child);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

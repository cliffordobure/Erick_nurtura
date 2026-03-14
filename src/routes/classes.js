import express from 'express';
import Class from '../models/Class.js';
import { auth, role } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const filter = req.user.schoolId ? { schoolId: req.user.schoolId } : {};
    if (req.user.role === 'teacher') filter.teacherId = req.user._id;
    const classes = await Class.find(filter).populate('teacherId', 'name email').lean();
    res.json(classes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const c = await Class.findById(req.params.id).populate('teacherId', 'name email').lean();
    if (!c) return res.status(404).json({ error: 'Class not found' });
    res.json(c);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, role('teacher', 'admin'), async (req, res) => {
  try {
    const doc = await Class.create({ ...req.body, schoolId: req.body.schoolId || req.user.schoolId });
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

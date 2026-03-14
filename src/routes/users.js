import express from 'express';
import User from '../models/User.js';
import { auth, role } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, role('teacher', 'caretaker', 'admin'), async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { schoolId: req.user.schoolId };
    const users = await User.find(filter).select('-password').lean();
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

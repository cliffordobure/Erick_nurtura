import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import School from '../models/School.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
const secret = process.env.JWT_SECRET || 'secret';

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role, phone, schoolId } = req.body;
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Email, password, name and role required' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const user = await User.create({ email, password, name, role, phone, schoolId });
    const token = jwt.sign({ userId: user._id }, secret, { expiresIn: '7d' });
    const u = await User.findById(user._id).select('-password').lean();
    res.status(201).json({ user: u, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ userId: user._id }, secret, { expiresIn: '7d' });
    const u = await User.findById(user._id).select('-password').lean();
    res.json({ user: u, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', auth, async (req, res) => {
  res.json(req.user);
});

router.patch('/me', auth, async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'avatar', 'fcmToken'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

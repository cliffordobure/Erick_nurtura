import express from 'express';
import School from '../models/School.js';
import User from '../models/User.js';
import { auth, systemAdmin } from '../middleware/auth.js';

const router = express.Router();

/** List all schools – system admin only */
router.get('/', auth, systemAdmin, async (req, res) => {
  try {
    const schools = await School.find().sort({ createdAt: -1 }).lean();
    const bySchool = await User.aggregate([{ $match: { schoolId: { $exists: true, $ne: null } } }, { $group: { _id: '$schoolId', n: { $sum: 1 } } }]);
    const map = Object.fromEntries((bySchool || []).map(({ _id, n }) => [_id.toString(), n]));
    const withCount = schools.map(s => ({ ...s, userCount: map[s._id.toString()] || 0 }));
    res.json(withCount);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Get one school – system admin only */
router.get('/:id', auth, systemAdmin, async (req, res) => {
  try {
    const school = await School.findById(req.params.id).lean();
    if (!school) return res.status(404).json({ error: 'School not found' });
    res.json(school);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Create school – system admin only */
router.post('/', auth, systemAdmin, async (req, res) => {
  try {
    const { name, address, phone, logo } = req.body;
    if (!name) return res.status(400).json({ error: 'School name required' });
    const school = await School.create({ name, address, phone, logo });
    res.status(201).json(school);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Update school – system admin only */
router.patch('/:id', auth, systemAdmin, async (req, res) => {
  try {
    const updates = {};
    ['name', 'address', 'phone', 'logo'].forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const school = await School.findByIdAndUpdate(req.params.id, updates, { new: true }).lean();
    if (!school) return res.status(404).json({ error: 'School not found' });
    res.json(school);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Onboard school: create school + school admin – system admin only */
router.post('/onboard', auth, systemAdmin, async (req, res) => {
  try {
    const {
      name,
      type,
      address,
      phone,
      logo,
      adminName,
      adminEmail,
      adminPassword,
      adminPhone,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'School name required' });
    if (!adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: 'School admin name, email and password required' });
    }
    const institutionType = type === 'daycare' ? 'daycare' : 'school';

    const existingUser = await User.findOne({ email: adminEmail });
    if (existingUser) return res.status(400).json({ error: 'School admin email already registered' });

    const school = await School.create({ name, type: institutionType, address, phone, logo });
    const user = await User.create({
      email: adminEmail,
      password: adminPassword,
      name: adminName,
      role: 'school_admin',
      phone: adminPhone,
      schoolId: school._id,
    });

    const u = await User.findById(user._id).select('-password').lean();
    res.status(201).json({
      school: await School.findById(school._id).lean(),
      user: u,
      message: institutionType === 'daycare'
        ? 'Daycare onboarded. School admin can sign in and create children, parents and caregivers.'
        : 'School onboarded. School admin can sign in and create students, parents, teachers and drivers.',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

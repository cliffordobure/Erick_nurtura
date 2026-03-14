import mongoose from 'mongoose';
import express from 'express';
import User from '../models/User.js';
import Child from '../models/Child.js';
import Class from '../models/Class.js';
import School from '../models/School.js';
import { auth, schoolAdmin } from '../middleware/auth.js';

function toObjectIds(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(id => id != null && mongoose.Types.ObjectId.isValid(id.toString()))
    .map(id => new mongoose.Types.ObjectId(id.toString()));
}

const router = express.Router();

router.use(auth, schoolAdmin);

/** Get my school (with type: school | daycare) */
router.get('/school', async (req, res) => {
  try {
    const school = await School.findById(req.user.schoolId).lean();
    if (!school) return res.status(404).json({ error: 'School not found' });
    res.json(school);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** List all users (parents, teachers, drivers, caregivers) in my school */
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ schoolId: req.user.schoolId, role: { $in: ['parent', 'teacher', 'driver', 'caretaker'] } })
      .select('-password')
      .sort({ role: 1, name: 1 })
      .lean();
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Create a user (parent, teacher, driver, or caretaker) – school admin only. Daycare: parent, caretaker only. */
router.post('/users', async (req, res) => {
  try {
    const { email, password, name, role, phone, childIds } = req.body;
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Email, password, name and role required' });
    }
    const school = await School.findById(req.user.schoolId).lean();
    const isDaycare = school?.type === 'daycare';
    const allowedRoles = isDaycare ? ['parent', 'caretaker'] : ['parent', 'teacher', 'driver'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: isDaycare ? 'Role must be parent or caretaker for daycare' : 'Role must be parent, teacher or driver' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const user = await User.create({
      email,
      password,
      name,
      role,
      phone: phone || undefined,
      schoolId: req.user.schoolId,
    });
    if (role === 'parent' && childIds && Array.isArray(childIds) && childIds.length > 0) {
      await Child.updateMany(
        { _id: { $in: childIds }, schoolId: req.user.schoolId },
        { $addToSet: { parentIds: user._id } }
      );
    }
    const u = await User.findById(user._id).select('-password').lean();
    res.status(201).json(u);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Update a user (parent, teacher, driver) – school admin only */
router.patch('/users/:id', async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, schoolId: req.user.schoolId, role: { $in: ['parent', 'teacher', 'driver', 'caretaker'] } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { name, phone, newPassword, childIds } = req.body;
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (newPassword !== undefined && newPassword.length >= 6) {
      user.password = newPassword;
      await user.save();
    } else {
      await user.save();
    }
    if (user.role === 'parent' && childIds !== undefined && Array.isArray(childIds)) {
      await Child.updateMany(
        { schoolId: req.user.schoolId, parentIds: user._id },
        { $pull: { parentIds: user._id } }
      );
      if (childIds.length > 0) {
        await Child.updateMany(
          { _id: { $in: childIds }, schoolId: req.user.schoolId },
          { $addToSet: { parentIds: user._id } }
        );
      }
    }
    const u = await User.findById(user._id).select('-password').lean();
    res.json(u);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** List all students (children) in my school */
router.get('/students', async (req, res) => {
  try {
    const children = await Child.find({ schoolId: req.user.schoolId })
      .populate('classId', 'name')
      .populate('parentIds', 'name email')
      .sort({ firstName: 1 })
      .lean();
    res.json(children);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Create a student (child) – school admin only */
router.post('/students', async (req, res) => {
  try {
    const { firstName, lastName, dateOfBirth, classId, parentIds, allergies, notes } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name required' });
    }
    const child = await Child.create({
      firstName,
      lastName,
      dateOfBirth: dateOfBirth || undefined,
      classId: classId || undefined,
      parentIds: parentIds && Array.isArray(parentIds) ? toObjectIds(parentIds) : [],
      schoolId: req.user.schoolId,
      allergies: allergies && Array.isArray(allergies) ? allergies : [],
      notes: notes || undefined,
    });
    const populated = await Child.findById(child._id).populate('classId', 'name').populate('parentIds', 'name email').lean();
    res.status(201).json(populated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Update a student (child) – school admin only */
router.patch('/students/:id', async (req, res) => {
  try {
    const child = await Child.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
    if (!child) return res.status(404).json({ error: 'Student not found' });
    const { firstName, lastName, dateOfBirth, classId, parentIds, allergies, notes } = req.body;
    if (firstName !== undefined) child.firstName = firstName;
    if (lastName !== undefined) child.lastName = lastName;
    if (dateOfBirth !== undefined) child.dateOfBirth = dateOfBirth;
    if (classId !== undefined) child.classId = classId;
    if (parentIds !== undefined && Array.isArray(parentIds)) child.parentIds = toObjectIds(parentIds);
    if (allergies !== undefined && Array.isArray(allergies)) child.allergies = allergies;
    if (notes !== undefined) child.notes = notes;
    await child.save();
    const populated = await Child.findById(child._id).populate('classId', 'name').populate('parentIds', 'name email').lean();
    res.json(populated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** List classes in my school (for dropdowns) */
router.get('/classes', async (req, res) => {
  try {
    const classes = await Class.find({ schoolId: req.user.schoolId })
      .populate('teacherId', 'name email')
      .sort({ name: 1 })
      .lean();
    res.json(classes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Create a class – school admin only */
router.post('/classes', async (req, res) => {
  try {
    const { name, grade, teacherId } = req.body;
    if (!name) return res.status(400).json({ error: 'Class name required' });
    const teacher = teacherId ? await User.findOne({ _id: teacherId, schoolId: req.user.schoolId, role: { $in: ['teacher', 'caretaker'] } }) : null;
    const c = await Class.create({
      name,
      grade: grade || undefined,
      teacherId: teacher ? teacher._id : undefined,
      schoolId: req.user.schoolId,
    });
    const populated = await Class.findById(c._id).populate('teacherId', 'name email').lean();
    res.status(201).json(populated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Update a class – school admin only */
router.patch('/classes/:id', async (req, res) => {
  try {
    const c = await Class.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
    if (!c) return res.status(404).json({ error: 'Class not found' });
    const { name, grade, teacherId } = req.body;
    if (name !== undefined) c.name = name;
    if (grade !== undefined) c.grade = grade;
    if (teacherId !== undefined) {
      c.teacherId = teacherId ? (await User.findOne({ _id: teacherId, schoolId: req.user.schoolId, role: { $in: ['teacher', 'caretaker'] } }))?._id : null;
    }
    await c.save();
    const populated = await Class.findById(c._id).populate('teacherId', 'name email').lean();
    res.json(populated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

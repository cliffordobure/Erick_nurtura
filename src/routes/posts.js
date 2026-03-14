import express from 'express';
import Post from '../models/Post.js';
import Child from '../models/Child.js';
import Class from '../models/Class.js';
import Notification from '../models/Notification.js';
import { auth, role } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'parent') {
      const classIds = [...new Set((await Child.find({ parentIds: req.user._id }).select('classId')).map(c => c.classId).filter(Boolean))];
      query.$or = [{ classId: { $in: classIds } }, { classId: null }];
    } else {
      if (req.user.schoolId) query.schoolId = req.user.schoolId;
      if (req.user.role === 'teacher' || req.user.role === 'caretaker') {
        const teacherClassIds = (await Class.find({ teacherId: req.user._id }).select('_id')).map(c => c._id);
        query.$or = [{ authorId: req.user._id }, { classId: { $in: teacherClassIds } }];
      }
    }
    const posts = await Post.find(query).populate('authorId', 'name').populate('classId', 'name').sort({ createdAt: -1 }).limit(50).lean();
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, role('teacher', 'caretaker', 'admin'), async (req, res) => {
  try {
    const post = await Post.create({
      ...req.body,
      authorId: req.user._id,
      schoolId: req.body.schoolId || req.user.schoolId
    });
    const classId = post.classId;
    let parentIds = [];
    if (classId) {
      const children = await Child.find({ classId }).select('parentIds').lean();
      parentIds = [...new Set(children.flatMap(c => c.parentIds.map(p => p.toString())))];
    }
    for (const pid of parentIds) {
      await Notification.create({ userId: pid, title: post.title, body: post.body?.slice(0, 100), type: 'post', data: { postId: post._id } });
    }
    const io = req.app.get('io');
    if (io) parentIds.forEach(pid => io.to(`user:${pid}`).emit('notification', { title: post.title, body: post.body?.slice(0, 100) }));
    res.status(201).json(post);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id', auth, role('teacher', 'caretaker', 'admin'), async (req, res) => {
  try {
    const post = await Post.findOneAndUpdate({ _id: req.params.id, authorId: req.user._id }, req.body, { new: true });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', auth, role('teacher', 'caretaker', 'admin'), async (req, res) => {
  try {
    const post = await Post.findOneAndDelete({ _id: req.params.id, authorId: req.user._id });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

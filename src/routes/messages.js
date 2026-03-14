import express from 'express';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import { auth } from '../middleware/auth.js';
import { sendPushToUsers } from '../services/fcm.js';

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const withUser = req.query.with;
    if (!withUser) {
      const sent = await Message.find({ senderId: req.user._id }).select('recipientId').lean();
      const received = await Message.find({ recipientId: req.user._id }).select('senderId').lean();
      const ids = [...new Set([...sent.map(m => m.recipientId.toString()), ...received.map(m => m.senderId.toString())])];
      return res.json(ids);
    }
    const messages = await Message.find({
      $or: [
        { senderId: req.user._id, recipientId: withUser },
        { senderId: withUser, recipientId: req.user._id }
      ]
    }).populate('senderId', 'name').populate('childId', 'firstName lastName').sort({ createdAt: 1 }).lean();
    await Message.updateMany({ recipientId: req.user._id, senderId: withUser }, { read: true });
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { recipientId, content, childId } = req.body;
    if (!recipientId || !content) return res.status(400).json({ error: 'recipientId and content required' });
    const message = await Message.create({ senderId: req.user._id, recipientId, content, childId });
    await Notification.create({
      userId: recipientId,
      title: 'New message from ' + req.user.name,
      body: content.slice(0, 80),
      type: 'message',
      data: { messageId: message._id, senderId: req.user._id }
    });
    const io = req.app.get('io');
    if (io) io.to(`user:${recipientId}`).emit('message', { from: req.user.name, body: content.slice(0, 80) });
    const pushTitle = 'New message from ' + req.user.name;
    sendPushToUsers([recipientId], pushTitle, content.slice(0, 80), { type: 'message', messageId: String(message._id), senderId: String(req.user._id) }).catch(console.error);
    const populated = await Message.findById(message._id).populate('senderId', 'name').populate('childId', 'firstName lastName').lean();
    res.status(201).json(populated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

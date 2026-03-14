import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  body: String,
  type: { type: String, enum: ['post', 'assignment', 'transport', 'message', 'request', 'reminder', 'general', 'activity'], default: 'general' },
  data: mongoose.Schema.Types.Mixed,
  read: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);

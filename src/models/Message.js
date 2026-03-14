import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  read: { type: Boolean, default: false },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'Child' }
}, { timestamps: true });

export default mongoose.model('Message', messageSchema);

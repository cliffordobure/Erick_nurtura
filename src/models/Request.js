import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema({
  fromId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'Child' },
  type: { type: String, enum: ['meeting', 'permission', 'info', 'other'], required: true },
  title: { type: String, required: true },
  body: String,
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  response: String,
  respondedAt: Date
}, { timestamps: true });

export default mongoose.model('Request', requestSchema);

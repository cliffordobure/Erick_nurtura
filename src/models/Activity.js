import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, default: '' },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scheduledAt: { type: Date },
  photos: [String],
  recipientType: { type: String, enum: ['all', 'single'], default: 'all' },
  recipientParentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reminderSent: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Activity', activitySchema);

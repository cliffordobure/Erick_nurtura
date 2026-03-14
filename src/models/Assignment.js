import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  dueDate: Date,
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  attachments: [String],
  reminderSent: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Assignment', assignmentSchema);

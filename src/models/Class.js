import mongoose from 'mongoose';

const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  grade: String,
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Class', classSchema);

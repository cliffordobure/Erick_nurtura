import mongoose from 'mongoose';

const childSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  dateOfBirth: Date,
  parentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  photo: String,
  allergies: [String],
  notes: String
}, { timestamps: true });

export default mongoose.model('Child', childSchema);

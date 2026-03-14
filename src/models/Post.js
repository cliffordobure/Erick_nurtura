import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  images: [String],
  type: { type: String, enum: ['update', 'announcement', 'activity', 'general'], default: 'update' }
}, { timestamps: true });

export default mongoose.model('Post', postSchema);

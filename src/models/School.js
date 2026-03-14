import mongoose from 'mongoose';

const schoolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: String,
  phone: String,
  logo: String
}, { timestamps: true });

export default mongoose.model('School', schoolSchema);

import mongoose from 'mongoose';

const transportSchema = new mongoose.Schema({
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'Child', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['pickup', 'dropoff'], required: true },
  scheduledAt: { type: Date, required: true },
  actualAt: Date,
  status: { type: String, enum: ['scheduled', 'en_route', 'arrived', 'completed', 'cancelled'], default: 'scheduled' },
  eta: Date,
  notes: String,
  notifiedParentAt: Date
}, { timestamps: true });

export default mongoose.model('Transport', transportSchema);

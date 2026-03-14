import mongoose from 'mongoose';

const parentAlarmSchema = new mongoose.Schema({
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'Child' },
  label: { type: String, required: true },
  note: String,
  scheduledTime: { type: Date, required: true },
  repeat: { type: String, enum: ['once', 'daily', 'weekly'], default: 'once' },
  daysOfWeek: [{ type: Number, min: 0, max: 6 }],
  enabled: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('ParentAlarm', parentAlarmSchema);

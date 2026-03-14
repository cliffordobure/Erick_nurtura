import Activity from '../models/Activity.js';
import Child from '../models/Child.js';
import Notification from '../models/Notification.js';
import { sendPushToUsers } from '../services/fcm.js';

/** Run every minute: find activities where scheduledAt <= now and reminderSent is false, notify parents, set reminderSent = true */
export async function runActivityReminders(io) {
  const now = new Date();
  const due = await Activity.find({
    scheduledAt: { $lte: now },
    reminderSent: false
  }).lean();

  for (const a of due) {
    const children = await Child.find({ classId: a.classId }).select('parentIds').lean();
    const parentIds = [...new Set(children.flatMap(c => (c.parentIds || []).map(p => p.toString())))];
    const title = `Reminder: ${a.title}`;
    const body = (a.body || 'Check the activity update.').slice(0, 150);
    for (const pid of parentIds) {
      await Notification.create({
        userId: pid,
        title,
        body,
        type: 'reminder',
        data: { activityId: a._id }
      });
    }
    if (io) parentIds.forEach(pid => io.to(`user:${pid}`).emit('notification', { title, body }));
    sendPushToUsers(parentIds, title, body, { type: 'reminder', activityId: String(a._id) }).catch(console.error);
    await Activity.updateOne({ _id: a._id }, { reminderSent: true });
  }
}

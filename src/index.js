import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import seedSystemAdmin from './config/seed.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import childRoutes from './routes/children.js';
import classRoutes from './routes/classes.js';
import postRoutes from './routes/posts.js';
import assignmentRoutes from './routes/assignments.js';
import transportRoutes from './routes/transport.js';
import notificationRoutes from './routes/notifications.js';
import messageRoutes from './routes/messages.js';
import requestRoutes from './routes/requests.js';
import schoolRoutes from './routes/schools.js';
import schoolAdminRoutes from './routes/schoolAdmin.js';
import uploadRoutes from './routes/upload.js';
import activityRoutes from './routes/activities.js';
import { runActivityReminders } from './jobs/activityReminders.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
app.use('/api/uploads', express.static(uploadsDir));

await connectDB();
await seedSystemAdmin();

// Real-time: attach io to req for use in routes
app.set('io', io);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/children', childRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/school-admin', schoolAdminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/activities', activityRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true }));

// Activity reminder job: every 60s check for due activities and notify parents
setInterval(() => runActivityReminders(io).catch(console.error), 60 * 1000);

// Socket: notify users (e.g. by userId or role)
io.on('connection', (socket) => {
  socket.on('join', (data) => {
    if (data.userId) socket.join(`user:${data.userId}`);
    if (data.room) socket.join(data.room);
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`Natura API running on port ${PORT}`));

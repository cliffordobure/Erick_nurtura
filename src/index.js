import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
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

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

connectDB();

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

app.get('/api/health', (_, res) => res.json({ ok: true }));

// Socket: notify users (e.g. by userId or role)
io.on('connection', (socket) => {
  socket.on('join', (data) => {
    if (data.userId) socket.join(`user:${data.userId}`);
    if (data.room) socket.join(data.room);
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`Natura API running on port ${PORT}`));

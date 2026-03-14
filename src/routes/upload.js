import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import express from 'express';
import fs from 'fs';
import { auth } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const name = (file.originalname || 'image').replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, Date.now() + '-' + name);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();

router.post('/', auth, upload.single('photo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const base = process.env.BASE_URL || (req.protocol + '://' + req.get('host'));
    const url = base + '/api/uploads/' + req.file.filename;
    res.json({ url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

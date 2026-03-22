import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const folder = (req.query.folder as string) || 'general';
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'general';
    const dir = path.resolve('uploads', safeFolder);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  },
}).single('image');

export const uploadFile = (req: Request, res: Response): void => {
  if (!req.file) {
    res.status(400).json({ status: 'ERROR', message: 'No file provided' });
    return;
  }

  const folder = (req.query.folder as string) || 'general';
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'general';
  const url = `/uploads/${safeFolder}/${req.file.filename}`;
  res.status(200).json({ status: 'SUCCESS', url });
};

import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import sharp from 'sharp';

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  },
}).single('image');

export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ status: 'ERROR', message: 'No file provided' });
    return;
  }

  const folder = (req.query.folder as string) || 'general';
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'general';
  const dir = path.resolve('uploads', safeFolder);
  fs.mkdirSync(dir, { recursive: true });

  try {
    let filename: string;
    let outputPath: string;

    if (req.file.mimetype.startsWith('video/')) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      outputPath = path.join(dir, filename);
      fs.writeFileSync(outputPath, req.file.buffer);
    } else {
      filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
      outputPath = path.join(dir, filename);
      await sharp(req.file.buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(outputPath);
    }

    res.status(200).json({ status: 'SUCCESS', url: `/uploads/${safeFolder}/${filename}` });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: 'Image processing failed' });
  }
};

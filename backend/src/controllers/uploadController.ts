import { Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import Image from '../models/Image';

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

function isStorageFullError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return (
    err?.code === 14 ||
    msg.includes('exceeded storage') ||
    msg.includes('disk quota') ||
    msg.includes('out of space') ||
    msg.includes('storage limit') ||
    msg.includes('quota')
  );
}

export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ status: 'ERROR', message: 'No file provided' });
    return;
  }

  const folder = (req.query.folder as string) || 'general';
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'general';

  try {
    let buffer: Buffer;
    let contentType: string;

    if (req.file.mimetype.startsWith('video/')) {
      buffer = req.file.buffer;
      contentType = req.file.mimetype;
    } else {
      buffer = await sharp(req.file.buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      contentType = 'image/webp';
    }

    const image = await Image.create({
      data: buffer,
      contentType,
      folder: safeFolder,
      size: buffer.length,
    });

    res.status(200).json({ status: 'SUCCESS', url: `/api/images/${image._id}` });
  } catch (err: any) {
    if (isStorageFullError(err)) {
      res.status(507).json({
        status: 'ERROR',
        message: 'Storage limit reached. No more images can be uploaded at this time.',
      });
      return;
    }
    res.status(500).json({ status: 'ERROR', message: 'Image processing failed' });
  }
};

export const serveImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const image = await Image.findById(req.params.id).lean() as any;
    if (!image) {
      res.status(404).end();
      return;
    }
    // Mongoose with .lean() returns Buffer fields as plain Buffers
    const buf: Buffer = Buffer.isBuffer(image.data)
      ? image.data
      : Buffer.from(image.data.buffer ?? image.data);

    res.set('Content-Type', image.contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Content-Length', String(buf.length));
    res.send(buf);
  } catch {
    res.status(500).end();
  }
};

import { Router, Request, Response, NextFunction } from 'express';
import { uploadMiddleware, uploadFile } from '../controllers/uploadController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post(
  '/',
  authMiddleware,
  (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        res.status(400).json({ status: 'ERROR', message: (err as Error).message });
        return;
      }
      next();
    });
  },
  uploadFile
);

export default router;

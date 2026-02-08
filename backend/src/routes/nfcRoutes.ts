import express, { Request, Response } from 'express';
import { nfcService } from '../services/nfcService';

const router = express.Router();

// GET /api/nfc/readers - List all connected NFC readers
router.get('/readers', (req: Request, res: Response) => {
  const readers = nfcService.getReaders();
  res.json({
    success: true,
    count: readers.length,
    data: readers,
  });
});

// GET /api/nfc/status - Check if NFC service is running
router.get('/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      initialized: nfcService.isInitialized(),
      readerCount: nfcService.getReaders().length,
    },
  });
});

export default router;

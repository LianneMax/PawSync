import express, { Request, Response } from 'express';
import { nfcService } from '../services/nfcService';
import {
  getPetForNFCWriting,
  recordNFCTagWriting,
  checkNFCTagStatus,
  getNFCWritingInstructions,
  startNFCTagWriting
} from '../controllers/nfcController';
import {
  requestPetTag,
  getPendingTagRequests,
  getAllTagRequests,
  markTagRequestFulfilled,
  cancelTagRequest,
  getTagRequest
} from '../controllers/petTagRequestController';
import { authMiddleware } from '../middleware/auth';
import { nfcAuthMiddleware } from '../middleware/nfcAuth';
import { NfcCommand } from '../models/NfcCommand';
import mongoose from 'mongoose';

const router = express.Router();

// GET /api/nfc/readers - List all connected NFC readers
router.get('/readers', (_req: Request, res: Response) => {
  const readers = nfcService.getReaders();
  res.json({
    success: true,
    count: readers.length,
    data: readers,
  });
});

// GET /api/nfc/status - Check if NFC service is running
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      initialized: nfcService.isInitialized(),
      readerCount: nfcService.getReaders().length,
    },
  });
});

// Clinic endpoints for writing NFC tags to pets
// GET /api/nfc/pet/:petId/for-writing - Get pet data for NFC writing
router.get('/pet/:petId/for-writing', getPetForNFCWriting);

// GET /api/nfc/pet/:petId/status - Check if pet has NFC tag
router.get('/pet/:petId/status', checkNFCTagStatus);

// GET /api/nfc/pet/:petId/instructions - Get NFC writing instructions
router.get('/pet/:petId/instructions', getNFCWritingInstructions);

// POST /api/nfc/pet/:petId/write - Start writing NFC tag (waits for tag placement)
router.post('/pet/:petId/write', authMiddleware, startNFCTagWriting);

// POST /api/nfc/pet/:petId/record-writing - Record NFC tag after writing
router.post('/pet/:petId/record-writing', authMiddleware, recordNFCTagWriting);

// ===== Pet Tag Request Routes =====

// POST /api/nfc/pet/:petId/request-tag - Pet owner requests an NFC tag
router.post('/pet/:petId/request-tag', authMiddleware, requestPetTag);

// GET /api/nfc/clinic/pending-requests - Get all pending tag requests for clinic
router.get('/clinic/pending-requests', authMiddleware, getPendingTagRequests);

// GET /api/nfc/clinic/all-requests - Get all tag requests (with optional status filter)
router.get('/clinic/all-requests', authMiddleware, getAllTagRequests);

// GET /api/nfc/requests/:requestId - Get single tag request details
router.get('/requests/:requestId', getTagRequest);

// PUT /api/nfc/requests/:requestId/fulfill - Mark request as fulfilled
router.put('/requests/:requestId/fulfill', authMiddleware, markTagRequestFulfilled);

// DELETE /api/nfc/requests/:requestId - Cancel a tag request
router.delete('/requests/:requestId', authMiddleware, cancelTagRequest);

// ===== Local NFC Agent Routes (protected by x-nfc-secret) =====

/**
 * POST /api/nfc/events
 * The local agent POSTs every NFC event here.
 * We bridge it into nfcService so the existing WebSocket pipeline
 * forwards it to connected browser clients in real-time.
 */
router.post('/events', nfcAuthMiddleware, (req: Request, res: Response) => {
  const { id, type, data, timestamp } = req.body as {
    id: string;
    type: string;
    data: unknown;
    timestamp: string;
  };

  if (!type) {
    res.status(400).json({ success: false, message: 'Missing event type' });
    return;
  }

  // Keep the readers map in sync so GET /api/nfc/status returns the correct
  // readerCount — this is what the frontend polls every 5 s to enable the
  // "Write Tag" button.
  if (type === 'reader:connect') {
    const name = (data as { name?: string })?.name ?? 'unknown';
    nfcService.trackReader(name, true);
  } else if (type === 'reader:disconnect') {
    const name = (data as { name?: string })?.name ?? 'unknown';
    nfcService.trackReader(name, false);
  }

  // Bridge into the in-process EventEmitter → WebSocket pipeline
  nfcService.emit(type, data);

  console.log(`[NFC/events] type=${type} id=${id} ts=${timestamp}`);
  res.json({ success: true });
});

/**
 * GET /api/nfc/commands/pending
 * The local agent polls this to pick up write commands queued by the web UI.
 * Returns at most one command at a time and marks it in_progress atomically.
 */
router.get('/commands/pending', nfcAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    // findOneAndUpdate with atomicity prevents two agents claiming the same command
    const command = await NfcCommand.findOneAndUpdate(
      { status: 'pending' },
      { $set: { status: 'in_progress' } },
      { sort: { createdAt: 1 }, new: true }
    );

    res.json({ success: true, data: command ? [command] : [] });
  } catch (err: any) {
    console.error('[NFC/commands/pending]', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch pending commands' });
  }
});

/**
 * POST /api/nfc/commands/:id/result
 * The local agent posts the write result here once the tag is written.
 * We update the DB record and re-emit the event so WebSocket clients get notified.
 */
router.post('/commands/:id/result', nfcAuthMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ success: false, message: 'Invalid command id' });
    return;
  }

  const { uid, writeSuccess, message } = req.body as {
    uid: string;
    writeSuccess: boolean;
    message?: string;
  };

  try {
    const command = await NfcCommand.findByIdAndUpdate(
      id,
      {
        $set: {
          status: writeSuccess ? 'done' : 'failed',
          result: { uid, writeSuccess, message },
        },
      },
      { new: true }
    );

    if (!command) {
      res.status(404).json({ success: false, message: 'Command not found' });
      return;
    }

    // Notify WebSocket clients about the write outcome
    nfcService.emit('card:write-complete', { uid, writeSuccess, message, petId: command.petId });

    res.json({ success: true, data: command });
  } catch (err: any) {
    console.error('[NFC/commands/:id/result]', err.message);
    res.status(500).json({ success: false, message: 'Failed to save command result' });
  }
});

export default router;

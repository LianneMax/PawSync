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

export default router;

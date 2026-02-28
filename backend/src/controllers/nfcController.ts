import { Request, Response } from 'express';
import Pet from '../models/Pet';
import { nfcService } from '../services/nfcService';
import { NfcCommand } from '../models/NfcCommand';

const isCloud = !!process.env.RENDER || process.env.NFC_MODE === 'remote';

/**
 * Get pet details for NFC tag writing.
 * Used by clinics to retrieve pet info before writing to NFC tag.
 */
export const getPetForNFCWriting = async (req: Request, res: Response) => {
  try {
    const { petId } = req.params;

    if (!petId) {
      return res.status(400).json({ status: 'ERROR', message: 'Pet ID is required' });
    }

    const pet = await Pet.findById(petId).populate('ownerId', 'firstName lastName email mobileNumber');

    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const petProfileUrl = `${baseUrl}/pet/${petId}`;

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        pet: {
          _id: pet._id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          photo: pet.photo,
          owner: pet.ownerId,
        },
        nfcData: {
          url: petProfileUrl,
          type: 'pet-profile',
        },
      },
    });
  } catch (error) {
    console.error('Get pet for NFC writing error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while retrieving pet data' });
  }
};

/**
 * Start NFC tag writing process.
 *
 * Flow:
 * 1. Validates pet exists and NFC service is ready
 * 2. Checks write lock to prevent concurrent writes
 * 3. Calls nfcService.writeURLToTag() which:
 *    a. Sends write-request to worker child process
 *    b. Worker enters write mode, waits for card tap
 *    c. On card tap, writes NDEF URI record with pet profile URL
 *    d. Returns result via IPC
 * 4. On success, saves NFC tag UID to pet document
 * 5. Returns result to frontend
 *
 * The REST endpoint blocks until write completes or times out (60s).
 * WebSocket clients receive real-time progress events during the wait.
 */
export const startNFCTagWriting = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { petId } = req.params;

    if (!petId) {
      return res.status(400).json({ status: 'ERROR', message: 'Pet ID is required' });
    }

    const pet = await Pet.findById(petId);

    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    // Check NFC service
    if (!nfcService.isInitialized()) {
      return res.status(503).json({
        status: 'ERROR',
        message: 'NFC service is not available. Please ensure NFC reader is connected.',
      });
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const petProfileUrl = `${baseUrl}/pet/${petId}`;

    // ── Remote mode (Render cloud) ───────────────────────────────────────────
    // The local NFC agent owns the hardware. Queue a write command in MongoDB;
    // the agent polls every 3 s, executes the write, then POSTs the result back
    // to /api/nfc/commands/:id/result which emits a WebSocket event to the UI.
    if (isCloud) {
      const command = await NfcCommand.create({ petId: pet._id, url: petProfileUrl });
      console.log(`[API] NFC write queued — command ${command._id} for pet ${pet.name}`);

      // Push 'waiting' progress so the frontend modal shows the right stage
      nfcService.emit('write:progress', { stage: 'waiting', url: petProfileUrl });

      return res.status(202).json({
        status: 'QUEUED',
        message: 'Write command queued — place NFC tag on the reader',
        data: {
          commandId: command._id.toString(),
          petId: pet._id,
          url: petProfileUrl,
        },
      });
    }

    // ── Local mode (direct USB worker) ───────────────────────────────────────
    if (nfcService.isWriting()) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Another write operation is in progress. Please wait and try again.',
      });
    }

    console.log(`[API] Starting NFC write for pet ${pet.name} (${petId}) → ${petProfileUrl}`);

    try {
      const writeResult = await nfcService.writeURLToTag(petProfileUrl, 60000);

      if (writeResult.writeSuccess) {
        if (writeResult.uid) {
          pet.nfcTagId = writeResult.uid;
          await pet.save();
          console.log(`[API] Saved NFC tag UID ${writeResult.uid} to pet ${petId}`);
        }

        return res.status(200).json({
          status: 'SUCCESS',
          message: 'NFC tag written successfully',
          data: {
            petId: pet._id,
            url: petProfileUrl,
            nfcTagId: writeResult.uid || null,
          },
        });
      } else {
        return res.status(400).json({
          status: 'ERROR',
          message: writeResult.message || 'Failed to write to NFC tag. The tag may be write-protected.',
        });
      }
    } catch (writeError: any) {
      console.error('[API] NFC write error:', writeError.message);
      return res.status(400).json({
        status: 'ERROR',
        message: writeError.message || 'NFC write operation failed',
      });
    }
  } catch (error) {
    console.error('Start NFC tag writing error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while starting NFC write' });
  }
};

/**
 * Record NFC tag ID on a pet after writing.
 * Called by clinic staff after successfully writing an NFC tag.
 */
export const recordNFCTagWriting = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { petId } = req.params;
    const { nfcTagId } = req.body;

    if (!petId || !nfcTagId) {
      return res.status(400).json({ status: 'ERROR', message: 'Pet ID and NFC Tag ID are required' });
    }

    const pet = await Pet.findByIdAndUpdate(
      petId,
      { nfcTagId },
      { new: true }
    );

    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'NFC tag successfully written and recorded',
      data: { pet },
    });
  } catch (error) {
    console.error('Record NFC tag writing error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while recording NFC tag' });
  }
};

/**
 * Check if a pet already has an NFC tag written.
 */
export const checkNFCTagStatus = async (req: Request, res: Response) => {
  try {
    const { petId } = req.params;

    const pet = await Pet.findById(petId);

    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        petId: pet._id,
        hasNFCTag: !!pet.nfcTagId,
        nfcTagId: pet.nfcTagId || null,
      },
    });
  } catch (error) {
    console.error('Check NFC tag status error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while checking NFC tag status' });
  }
};

/**
 * Get NFC tag writing instructions for clinic staff.
 */
export const getNFCWritingInstructions = async (req: Request, res: Response) => {
  try {
    const { petId } = req.params;

    const pet = await Pet.findById(petId);

    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const petProfileUrl = `${baseUrl}/pet/${petId}`;

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        petName: pet.name,
        nfcData: {
          type: 'uri',
          uri: petProfileUrl,
          ndefFormat: {
            header: '0xD1 (MB=1, ME=1, SR=1, TNF=Well-Known)',
            type: '0x55 (U = URI)',
            protocolCode: '0x04 (https://)',
            uriPart: petProfileUrl.replace('https://', ''),
          },
        },
        instructions: [
          '1. Ensure NFC reader is connected (green status indicator)',
          '2. Click "Write Tag" button for the pet',
          '3. Place a blank NTAG213/215 tag on the reader within 60 seconds',
          '4. Wait for the write confirmation',
          `5. Tag will contain: ${petProfileUrl}`,
          '6. Attach the tag to the pet\'s collar',
        ],
      },
    });
  } catch (error) {
    console.error('Get NFC writing instructions error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

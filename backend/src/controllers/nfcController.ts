import { Request, Response } from 'express';
import Pet from '../models/Pet';
import User from '../models/User';
import Clinic from '../models/Clinic';
import ClinicBranch from '../models/ClinicBranch';
import { nfcService } from '../services/nfcService';
import { NfcCommand } from '../models/NfcCommand';
import { sendPetTagReadyEmail } from '../services/emailService';
import { createNotification } from '../services/notificationService';

const isCloud = !!process.env.RENDER || process.env.NFC_MODE === 'remote';
const normalizeNfcTagId = (value?: string | null): string => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (['null', 'undefined', 'n/a', 'na', '-'].includes(lower)) return '';
  return trimmed.toUpperCase();
};

/**
 * Fire-and-forget: notify the pet owner that their NFC tag has been linked.
 */
async function notifyOwnerTagLinked(petId: string, clinicId?: string): Promise<void> {
  try {
    const pet = await Pet.findById(petId).select('name ownerId').lean();
    if (!pet) return;

    const [owner, clinic] = await Promise.all([
      User.findById((pet as any).ownerId).select('firstName email').lean(),
      clinicId ? Clinic.findById(clinicId).select('name').lean() : null,
    ]);
    if (!owner) return;

    const petName = (pet as any).name as string;
    const clinicName = (clinic as any)?.name || 'the clinic';
    const ownerId = (owner as any)._id.toString();

    await createNotification(
      ownerId,
      'pet_tag_ready',
      'NFC Tag Linked',
      `An NFC tag has been successfully linked to ${petName}. Anyone who scans it will see their profile.`,
      { petId },
    );

    if ((owner as any).email) {
      await sendPetTagReadyEmail({
        ownerEmail: (owner as any).email,
        ownerFirstName: (owner as any).firstName || 'Pet Owner',
        petName,
        clinicName,
      });
    }
  } catch (err) {
    console.error('[NFC] notifyOwnerTagLinked failed:', err);
  }
}

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

    // ── Remote / agent mode ───────────────────────────────────────────────────
    // Use the async queue whenever:
    //   a) running on Render/cloud (RENDER=true or NFC_MODE=remote), OR
    //   b) no local worker process is running (e.g. local agent owns the reader)
    // This makes write work correctly regardless of where the backend is hosted.
    if (isCloud || !nfcService.isWorkerRunning()) {
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
          const normalizedUid = normalizeNfcTagId(writeResult.uid);
          const existingTagOwner = await Pet.findOne({
            nfcTagId: normalizedUid,
            _id: { $ne: pet._id }
          });

          if (existingTagOwner) {
            return res.status(409).json({
              status: 'ERROR',
              message: 'This NFC tag is already assigned to another pet'
            });
          }

          pet.nfcTagId = normalizedUid;
          await pet.save();
          console.log(`[API] Saved NFC tag UID ${normalizedUid} to pet ${petId}`);
          notifyOwnerTagLinked(pet._id.toString(), req.user?.clinicId).catch(() => {});
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

    const normalizedTagId = normalizeNfcTagId(nfcTagId);

    if (!petId || !normalizedTagId) {
      return res.status(400).json({ status: 'ERROR', message: 'Pet ID and NFC Tag ID are required' });
    }

    const duplicateTag = await Pet.findOne({
      nfcTagId: normalizedTagId,
      _id: { $ne: petId }
    });

    if (duplicateTag) {
      return res.status(409).json({ status: 'ERROR', message: 'This NFC tag is already assigned to another pet' });
    }

    const pet = await Pet.findByIdAndUpdate(
      petId,
      { nfcTagId: normalizedTagId },
      { new: true }
    );

    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    notifyOwnerTagLinked(petId, req.user?.clinicId).catch(() => {});

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

/**
 * Get pet by NFC tag ID.
 * Used by clinics when scanning an NFC tag to retrieve the associated pet.
 * This lookup is used in the patient management page when a pet tag is scanned.
 */
export const getPetByNfcTagId = async (req: Request, res: Response) => {
  try {
    const { nfcTagId } = req.params;
    const normalizedTagId = normalizeNfcTagId(nfcTagId);

    console.log(`[NFC] Tag scanned: ${nfcTagId} → normalized: ${normalizedTagId}`);

    if (!normalizedTagId) {
      return res.status(400).json({ status: 'ERROR', message: 'NFC Tag ID is required' });
    }

    const pet = await Pet.findOne({ nfcTagId: normalizedTagId }).populate('ownerId', 'firstName lastName email mobileNumber');

    if (!pet) {
      console.log(`[NFC] No pet found for tag: ${normalizedTagId}`);
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found with this NFC tag' });
    }

    console.log(`[NFC] Pet found: ${pet._id} (${pet.name})`);
    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        pet: {
          _id: pet._id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          photo: pet.photo,
          sex: pet.sex,
          dateOfBirth: pet.dateOfBirth,
          weight: pet.weight,
          microchipNumber: pet.microchipNumber,
          owner: pet.ownerId,
        },
      },
    });
  } catch (error) {
    console.error('Get pet by NFC tag ID error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while retrieving pet data' });
  }
};

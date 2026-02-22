import { Request, Response } from 'express';
import Pet from '../models/Pet';
import { nfcService } from '../services/nfcService';

/**
 * Get pet details for NFC tag writing
 * Used by clinics to retrieve pet info before writing to NFC tag
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

    // Get the pet profile URL that will be written to the NFC tag
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
 * Start NFC tag writing process for a pet
 * Initiates write mode and waits for tag placement
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

    // Check if NFC service is initialized
    if (!nfcService.isInitialized()) {
      return res.status(503).json({
        status: 'ERROR',
        message: 'NFC service is not available. Please ensure NFC reader is connected.',
      });
    }

    // Get the pet profile URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const petProfileUrl = `${baseUrl}/pet/${petId}`;

    console.log(`[API] Starting NFC write for pet ${pet.name} (${petId})`);

    // Initiate write process - this will wait for a tag and write the URL to it
    try {
      const writeResult = await nfcService.writeURLToTag(petProfileUrl, 60000); // 60 second timeout

      if (writeResult.writeSuccess) {
        // Update pet with NFC tag ID if available
        if (writeResult.uid) {
          pet.nfcTagId = writeResult.uid;
          await pet.save();
          console.log(`[API] Recorded NFC tag ${writeResult.uid} for pet ${petId}`);
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
          message: 'Failed to write to NFC tag. Please try again.',
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
 * Record NFC tag ID on a pet after writing
 * Called by clinic after successfully writing an NFC tag
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
      {
        nfcTagId: nfcTagId,
      },
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
 * Check if a pet already has an NFC tag written
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
 * Get NFC tag writing instructions for clinic
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
          // Standard NDEF URI record format
          type: 'uri',
          uri: petProfileUrl,
          tnf: 3, // Absolute URI
          // Alternative formats for different NFC standards
          formats: {
            // URI Record TNF=1 (Well-Known), Type='U'
            ndefWellKnown: {
              header: 0xD1, // MB=1, ME=1, CF=0, SR=1, IL=0, TNF=1
              type: 'U',
              protocolCode: 0x04, // https://
              uriPart: petProfileUrl.replace('https://', ''),
            },
            // Direct URL for simple NFC tags
            httpURL: petProfileUrl,
          },
        },
        instructions: [
          '1. Place pet NFC tag near NFC reader',
          '2. Wait for reader to detect the tag',
          '3. Click "Write" to write pet profile link to tag',
          `4. Tag will contain link: ${petProfileUrl}`,
          '5. Once written, the tag can be attached to pet collar',
        ],
      },
    });
  } catch (error) {
    console.error('Get NFC writing instructions error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

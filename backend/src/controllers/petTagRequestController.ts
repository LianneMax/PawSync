import { Request, Response } from 'express';
import Pet from '../models/Pet';
import User from '../models/User';
import PetTagRequest from '../models/PetTagRequest';
import Clinic from '../models/Clinic';
import ClinicBranch from '../models/ClinicBranch';
import Appointment from '../models/Appointment';
import Billing from '../models/Billing';
import ProductService from '../models/ProductService';
import { alertClinicAdmins } from '../services/clinicAdminAlertService';

/**
 * Request a new NFC pet tag (by pet owner)
 */
export const requestPetTag = async (req: Request, res: Response) => {
  try {
    console.log('[NFC Request] Received request from user:', req.user?.userId);

    if (!req.user) {
      console.log('[NFC Request] No user found in request');
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { petId } = req.params;
    const { reason, clinicBranchId, pickupDate } = req.body;

    console.log(`[NFC Request] Pet ID: ${petId}, Reason: ${reason}, Clinic Branch: ${clinicBranchId}, Pickup Date: ${pickupDate}`);

    if (!petId) {
      console.log('[NFC Request] No pet ID provided');
      return res.status(400).json({ status: 'ERROR', message: 'Pet ID is required' });
    }

    // Verify pet exists and belongs to the user
    const pet = await Pet.findById(petId);
    console.log(`[NFC Request] Pet lookup result:`, pet ? `Found ${pet.name}` : 'Not found');

    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    if (pet.ownerId.toString() !== req.user.userId) {
      console.log(`[NFC Request] Authorization failed: pet owner ${pet.ownerId} != user ${req.user.userId}`);
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to request tag for this pet' });
    }

    if (!pet.isAlive || pet.status === 'deceased') {
      return res.status(400).json({ status: 'ERROR', message: 'Cannot request an NFC tag for a pet marked as deceased' });
    }

    // Block duplicate requests when one is still pending or was already approved/fulfilled
    const existingRequest = await PetTagRequest.findOne({
      petId: petId,
      status: { $in: ['pending', 'approved', 'fulfilled'] }
    });

    if (existingRequest) {
      console.log(`[NFC Request] Existing active/completed request already exists for pet ${petId}`);
      return res.status(400).json({ status: 'ERROR', message: 'A pet tag request already exists for this pet' });
    }

    // Get the first clinic for now (or we could make this multi-clinic)
    const clinic = await Clinic.findOne({ isActive: true });
    console.log(`[NFC Request] Clinic lookup:`, clinic ? `Found ${clinic._id}` : 'No active clinic found');

    if (!clinic) {
      console.log('[NFC Request] ERROR: No active clinic found in database');
      return res.status(400).json({ status: 'ERROR', message: 'No active clinic found to process requests' });
    }

    // Create tag request with provided clinicBranchId and pickupDate, or fetch from next appointment
    let finalPickupDate: Date | null = pickupDate ? new Date(pickupDate) : null;
    let finalClinicBranchId = clinicBranchId || null;

    // If clinicBranchId and pickupDate provided by user, use those
    if (clinicBranchId && pickupDate) {
      console.log(`[NFC Request] Using user-provided clinic branch ${clinicBranchId} and pickup date ${pickupDate}`);
    } else {
      // Otherwise fall back to next appointment
      const now = new Date();
      const nextAppointment = await Appointment.findOne({
        petId: petId,
        date: { $gte: now },
        status: { $in: ['pending', 'confirmed'] }
      })
        .populate('clinicBranchId')
        .sort({ date: 1, startTime: 1 });

      if (nextAppointment) {
        finalPickupDate = nextAppointment.date;
        finalClinicBranchId = nextAppointment.clinicBranchId?._id || null;
        console.log(`[NFC Request] Found next appointment on ${finalPickupDate} at branch ${finalClinicBranchId}`);
      } else {
        console.log(`[NFC Request] No upcoming appointment found for pet ${petId}`);
      }
    }

    // Create tag request
    const createData: any = {
      petId: petId,
      ownerId: req.user.userId,
      clinicId: clinic._id,
      reason: reason || ''
    };

    if (finalPickupDate) {
      createData.pickupDate = finalPickupDate;
    }
    if (finalClinicBranchId) {
      createData.clinicBranchId = finalClinicBranchId;
    }

    const tagRequest = await PetTagRequest.create(createData as any) as any;

    const owner = await User.findById(req.user.userId).select('firstName lastName email');
    const branch = finalClinicBranchId
      ? await ClinicBranch.findById(finalClinicBranchId).select('name')
      : null;
    const pickupDateLabel = finalPickupDate
      ? new Date(finalPickupDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'Not set';
    const ownerName = [owner?.firstName, owner?.lastName].filter(Boolean).join(' ').trim() || 'Pet Owner';

    await alertClinicAdmins({
      clinicId: clinic._id,
      clinicBranchId: finalClinicBranchId || null,
      notificationType: 'clinic_pet_tag_requested',
      notificationTitle: 'New Pet Tag Request',
      notificationMessage: `${ownerName} requested a pet tag for ${pet.name}${branch ? ` at ${branch.name}` : ''}.`,
      metadata: {
        requestId: tagRequest._id,
        petId: pet._id,
        ownerId: req.user.userId,
        clinicId: clinic._id,
        clinicBranchId: finalClinicBranchId || null,
        pickupDate: finalPickupDate,
        reason: reason || '',
      },
      emailSubject: `PawSync – New Pet Tag Request (${pet.name})`,
      emailHeadline: 'New Pet Tag Request Submitted',
      emailIntro: 'A pet owner submitted a new NFC pet tag request.',
      emailDetails: {
        Pet: pet.name,
        Owner: ownerName,
        Branch: branch?.name || 'Not specified',
        'Pickup Date': pickupDateLabel,
        Reason: reason || 'Not provided',
      },
    });

    console.log(`[NFC Request] Successfully created tag request ${(tagRequest as any)._id} for pet ${petId}`);

    // Create billing immediately upon request (owner can pay before tag is written)
    try {
      const nfcTagProduct = await ProductService.findOne({ isSystemProduct: true, name: 'NFC Pet Tag' });
      if (nfcTagProduct) {
        let billingBranchId = finalClinicBranchId;
        if (!billingBranchId) {
          const mainBranch = await ClinicBranch.findOne({ clinicId: clinic._id, isMain: true }).select('_id');
          billingBranchId = mainBranch?._id || null;
        }

        if (billingBranchId) {
          await Billing.create({
            ownerId: req.user.userId,
            petId: petId,
            vetId: null,
            clinicId: clinic._id,
            clinicBranchId: billingBranchId,
            medicalRecordId: null,
            confinementRecordId: null,
            appointmentId: null,
            items: [{
              productServiceId: nfcTagProduct._id,
              name: nfcTagProduct.name,
              type: 'Product',
              unitPrice: nfcTagProduct.price,
              quantity: 1,
            }],
            subtotal: nfcTagProduct.price,
            discount: 0,
            totalAmountDue: nfcTagProduct.price,
            status: 'pending_payment',
            serviceLabel: 'NFC Pet Tag',
            serviceDate: new Date(),
          });
          console.log(`[NFC Request] Billing created for tag request ${(tagRequest as any)._id}`);
        } else {
          console.warn(`[NFC Request] Could not create billing — no clinic branch found`);
        }
      } else {
        console.warn('[NFC Request] NFC Pet Tag product not found — billing not created');
      }
    } catch (billingError) {
      console.error('[NFC Request] Failed to create billing:', billingError);
    }

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Pet tag request submitted successfully',
      data: { request: tagRequest }
    });
  } catch (error) {
    console.error('[NFC Request] ERROR:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while submitting tag request' });
  }
};

/**
 * Get all pending tag requests for clinic staff
 */
export const getPendingTagRequests = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    // Get clinic ID from the first matching clinic where this user is admin
    // For now, get all pending requests (clinic staff can see all)
    const requests = await PetTagRequest.find({
      status: 'pending'
    })
      .populate('petId', 'name species breed photo')
      .populate('ownerId', 'firstName lastName email contactNumber')
      .populate('clinicBranchId', 'name address')
      .sort({ createdAt: -1 });

    console.log(`[NFC] Clinic staff ${req.user.userId} fetched ${requests.length} pending tag requests`);

    return res.status(200).json({
      status: 'SUCCESS',
      data: { requests }
    });
  } catch (error) {
    console.error('Get pending tag requests error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching tag requests' });
  }
};

/**
 * Get all tag requests (pending and fulfilled)
 */
export const getAllTagRequests = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { status } = req.query;

    const filter: any = {};
    if (status && ['pending', 'fulfilled', 'cancelled'].includes(status as string)) {
      filter.status = status;
    }

    const requests = await PetTagRequest.find(filter)
      .populate('petId', 'name species breed photo')
      .populate('ownerId', 'firstName lastName email contactNumber')
      .populate('clinicBranchId', 'name address')
      .populate('fulfilledBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { requests }
    });
  } catch (error) {
    console.error('Get all tag requests error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching tag requests' });
  }
};

/**
 * Mark a tag request as fulfilled (after NFC tag is written)
 */
export const markTagRequestFulfilled = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { requestId } = req.params;

    if (!requestId) {
      return res.status(400).json({ status: 'ERROR', message: 'Request ID is required' });
    }

    const tagRequest = await PetTagRequest.findById(requestId);

    if (!tagRequest) {
      return res.status(404).json({ status: 'ERROR', message: 'Tag request not found' });
    }

    // Update request status
    tagRequest.status = 'fulfilled';
    tagRequest.fulfilledAt = new Date();
    tagRequest.fulfilledBy = req.user.userId as any;
    await tagRequest.save();

    console.log(`[Tag Request] Request ${requestId} marked as fulfilled by ${req.user.userId}`);

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Tag request marked as fulfilled',
      data: { request: tagRequest }
    });
  } catch (error) {
    console.error('Mark tag request fulfilled error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while updating tag request' });
  }
};

/**
 * Cancel a tag request
 */
export const cancelTagRequest = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { requestId } = req.params;

    if (!requestId) {
      return res.status(400).json({ status: 'ERROR', message: 'Request ID is required' });
    }

    const tagRequest = await PetTagRequest.findById(requestId);

    if (!tagRequest) {
      return res.status(404).json({ status: 'ERROR', message: 'Tag request not found' });
    }

    // Verify authorization (owner can cancel)
    const isOwner = tagRequest.ownerId.toString() === req.user.userId;

    if (!isOwner) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to cancel this request' });
    }

    // Only cancel if still pending
    if (tagRequest.status !== 'pending') {
      return res.status(400).json({ status: 'ERROR', message: 'Only pending requests can be cancelled' });
    }

    tagRequest.status = 'cancelled';
    await tagRequest.save();

    console.log(`[Tag Request] Request ${requestId} cancelled by ${req.user.userId}`);

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Tag request cancelled',
      data: { request: tagRequest }
    });
  } catch (error) {
    console.error('Cancel tag request error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while cancelling tag request' });
  }
};

/**
 * Get tag request details
 */
export const getTagRequest = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;

    if (!requestId) {
      return res.status(400).json({ status: 'ERROR', message: 'Request ID is required' });
    }

    const tagRequest = await PetTagRequest.findById(requestId)
      .populate('petId', 'name species breed photo')
      .populate('ownerId', 'firstName lastName email contactNumber')
      .populate('clinicBranchId', 'name address')
      .populate('fulfilledBy', 'firstName lastName');

    if (!tagRequest) {
      return res.status(404).json({ status: 'ERROR', message: 'Tag request not found' });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      data: { request: tagRequest }
    });
  } catch (error) {
    console.error('Get tag request error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching tag request' });
  }
};

import { Request, Response } from 'express';
import ProductService from '../models/ProductService';
import ClinicBranch from '../models/ClinicBranch';
import { getClinicForAdmin } from './clinicController';

/** Returns true for item types that support branch availability tracking */
function qualifiesForBranchAvailability(type: string, category: string): boolean {
  if (type === 'Product') return category === 'Medication';
  return true; // Services: all categories including Others
}

/**
 * GET /api/product-services
 * All authenticated clinic staff — search the global catalog.
 * Optional query params: ?search=&type=Service|Product&category=
 */
export const listProductServices = async (req: Request, res: Response) => {
  try {
    const { search, type, category } = req.query;

    const query: any = { isActive: true };
    if (type) query.type = type;
    if (category) query.category = { $regex: `^${String(category)}$`, $options: 'i' };
    if (search) query.name = { $regex: search, $options: 'i' };

    const items = await ProductService.find(query)
      .populate('branchAvailability.branchId', 'name isMain')
      .sort({ type: 1, name: 1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { items },
    });
  } catch (error) {
    console.error('List product services error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching product/services' });
  }
};

/**
 * POST /api/product-services
 * Clinic admin / branch admin only — add an item to the global catalog.
 */
export const createProductService = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { name, type, price, description, category, administrationRoute, administrationMethod, branchAvailability, dosageAmount, frequencyNotes, frequency, frequencyLabel, duration, durationLabel, dosePerKg, doseUnit, doseConcentration, netContent, intervalDays, weightMin, weightMax, pricingType, piecesPerPack, injectionPricingType, associatedServiceId, preventiveDuration, preventiveDurationUnit } = req.body;

    if (!name || !type || price === undefined) {
      return res.status(400).json({ status: 'ERROR', message: 'name, type, and price are required' });
    }

    if (!['Service', 'Product'].includes(type)) {
      return res.status(400).json({ status: 'ERROR', message: 'type must be "Service" or "Product"' });
    }

    const validProductCategories = ['Medication', 'Others'];
    const validServiceCategories = ['Diagnostic Tests', 'Preventive Care', 'Surgeries', 'Pregnancy Delivery', 'General Consultation', 'Grooming', 'Others'];
    const validCategories = type === 'Product' ? validProductCategories : validServiceCategories;
    const resolvedCategory = category && validCategories.includes(category) ? category : 'Others';

    // Validate administration fields for medications
    let resolvedRoute: string | null = null;
    let resolvedMethod: string | null = null;

    if (resolvedCategory === 'Medication') {
      if (!administrationRoute || !['oral', 'topical', 'injection', 'preventive'].includes(administrationRoute)) {
        return res.status(400).json({ status: 'ERROR', message: 'administrationRoute is required for medications (oral, topical, injection, or preventive)' });
      }
      resolvedRoute = administrationRoute;

      if (administrationRoute === 'oral') {
        const validOral = ['tablets', 'capsules', 'syrup'];
        if (!administrationMethod || !validOral.includes(administrationMethod)) {
          return res.status(400).json({ status: 'ERROR', message: 'administrationMethod is required for oral medications (tablets, capsules, or syrup)' });
        }
        resolvedMethod = administrationMethod;
      } else if (administrationRoute === 'topical') {
        const validTopical = ['skin', 'ears', 'eyes', 'wounds'];
        if (!administrationMethod || !validTopical.includes(administrationMethod)) {
          return res.status(400).json({ status: 'ERROR', message: 'administrationMethod is required for topical medications (skin, ears, eyes, or wounds)' });
        }
        resolvedMethod = administrationMethod;
      } else if (administrationRoute === 'injection') {
        const validInjection = ['iv', 'im', 'sc'];
        if (administrationMethod && !validInjection.includes(administrationMethod)) {
          return res.status(400).json({ status: 'ERROR', message: 'administrationMethod for injections must be iv, im, or sc' });
        }
        resolvedMethod = administrationMethod || null;
      } else if (administrationRoute === 'preventive') {
        const validPreventive = ['spot-on', 'chewable'];
        if (!administrationMethod || !validPreventive.includes(administrationMethod)) {
          return res.status(400).json({ status: 'ERROR', message: 'administrationMethod is required for preventive medications (spot-on or chewable)' });
        }
        resolvedMethod = administrationMethod;
      }

      // Validate pricing type for applicable medications (tablets, capsules, spot-on, chewable)
      const applicablePricingMethods = ['tablets', 'capsules', 'spot-on', 'chewable'];
      const hasPackPricing = pricingType === 'pack';
      if (hasPackPricing && !applicablePricingMethods.includes(resolvedMethod || '')) {
        return res.status(400).json({ status: 'ERROR', message: 'Pack pricing is only available for tablets, capsules, spot-on, and chewable medications' });
      }
      if (hasPackPricing && !piecesPerPack) {
        return res.status(400).json({ status: 'ERROR', message: 'piecesPerPack is required when pricingType is "pack"' });
      }

      // Validate injection pricing (only for injection route)
      if (resolvedRoute === 'injection') {
        if (injectionPricingType === 'singleDose' && !netContent) {
          return res.status(400).json({ status: 'ERROR', message: 'netContent (net volume in ML) is required when injectionPricingType is "singleDose"' });
        }
        if (injectionPricingType === 'mlPerKg' && !netContent) {
          return res.status(400).json({ status: 'ERROR', message: 'netContent (net volume in ML) is required when injectionPricingType is "mlPerKg"' });
        }
      }

      // Uniqueness check for medications: name + route + method
      const existing = await ProductService.findOne({
        isActive: true,
        name: name.trim(),
        category: 'Medication',
        administrationRoute: resolvedRoute,
        administrationMethod: resolvedMethod,
      });
      if (existing) {
        return res.status(409).json({ status: 'ERROR', message: 'A medication with this name and administration method already exists' });
      }
    } else {
      // Uniqueness check for non-medication products/services: name only
      const existing = await ProductService.findOne({ name: name.trim(), category: resolvedCategory, isActive: true });
      if (existing) {
        return res.status(409).json({ status: 'ERROR', message: 'A product/service with this name already exists' });
      }
    }

    // Only persist branchAvailability for qualifying types.
    // If not explicitly provided, auto-assign all active branches from the admin's clinic.
    let resolvedBranchAvailability: { branchId: any; isActive: boolean }[] = [];
    if (qualifiesForBranchAvailability(type, resolvedCategory)) {
      if (Array.isArray(branchAvailability) && branchAvailability.length > 0) {
        resolvedBranchAvailability = branchAvailability;
      } else {
        const clinic = await getClinicForAdmin(req);
        if (clinic) {
          const clinicBranches = await ClinicBranch.find(
            { clinicId: clinic._id, isActive: true },
            '_id'
          );
          resolvedBranchAvailability = clinicBranches.map((b: any) => ({ branchId: b._id, isActive: true }));
        }
      }
    }

    const item = await ProductService.create({
      name: name.trim(),
      type,
      category: resolvedCategory,
      price,
      description: description || '',
      administrationRoute: resolvedRoute,
      administrationMethod: resolvedMethod,
      ...(resolvedCategory === 'Medication' ? {
        dosageAmount: dosageAmount || null,
        frequencyNotes: frequencyNotes || null,
        netContent: netContent != null ? Number(netContent) : null,
        dosePerKg: dosePerKg != null ? Number(dosePerKg) : null,
        doseUnit: doseUnit || null,
        doseConcentration: doseConcentration != null ? Number(doseConcentration) : null,
        frequency: frequency != null ? Number(frequency) : null,
        frequencyLabel: frequencyLabel || null,
        duration: duration != null ? Number(duration) : null,
        durationLabel: durationLabel || null,
        intervalDays: intervalDays != null ? Number(intervalDays) : null,
        weightMin: weightMin != null ? Number(weightMin) : null,
        weightMax: weightMax != null ? Number(weightMax) : null,
        associatedServiceId: associatedServiceId || null,
        preventiveDuration: preventiveDuration != null ? Number(preventiveDuration) : null,
        preventiveDurationUnit: preventiveDurationUnit || null,
        pricingType: pricingType || 'singlePill',
        piecesPerPack: pricingType === 'pack' && piecesPerPack ? Number(piecesPerPack) : null,
        injectionPricingType: injectionPricingType || null,
      } : {}),
      branchAvailability: resolvedBranchAvailability,
    } as any);

    const itemWithBranches = await ProductService.findById((item as any)._id)
      .populate('branchAvailability.branchId', 'name isMain');

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Product/service created successfully',
      data: { item: itemWithBranches },
    });
  } catch (error: any) {
    console.error('Create product service error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ status: 'ERROR', message: 'A product/service with this name already exists' });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while creating the product/service' });
  }
};

/**
 * PUT /api/product-services/:id
 * Clinic admin / branch admin only — update an existing catalog item.
 */
export const updateProductService = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const item = await ProductService.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ status: 'ERROR', message: 'Product/service not found' });
    }

    // System products can only have price and branchAvailability updated
    if ((item as any).isSystemProduct) {
      const { price, branchAvailability } = req.body;
      if (price !== undefined) item.price = price;
      if (branchAvailability !== undefined) {
        (item as any).branchAvailability = branchAvailability;
      }
      await item.save();
      await item.populate('branchAvailability.branchId', 'name isMain');
      return res.status(200).json({
        status: 'SUCCESS',
        message: 'Product/service updated successfully',
        data: { item },
      });
    }

    const { name, type, price, description, category, isActive, administrationRoute, administrationMethod, branchAvailability, dosageAmount, frequencyNotes, frequency, frequencyLabel, duration, durationLabel, dosePerKg, doseUnit, doseConcentration, netContent, intervalDays, weightMin, weightMax, pricingType, piecesPerPack, injectionPricingType, associatedServiceId, preventiveDuration, preventiveDurationUnit } = req.body;

    if (name !== undefined) item.name = name.trim();
    if (type !== undefined) item.type = type;
    if (category !== undefined) item.category = category;
    if (price !== undefined) item.price = price;
    if (description !== undefined) item.description = description;
    if (isActive !== undefined) item.isActive = isActive;

    // Update administration fields for medications
    if (item.category === 'Medication' || category === 'Medication') {
      if (administrationRoute !== undefined) item.administrationRoute = administrationRoute || null;
      if (administrationMethod !== undefined) item.administrationMethod = administrationMethod || null;
      if (dosageAmount !== undefined) (item as any).dosageAmount = dosageAmount || null;
      if (frequencyNotes !== undefined) (item as any).frequencyNotes = frequencyNotes || null;
      if (netContent !== undefined) (item as any).netContent = netContent != null ? Number(netContent) : null;
      if (dosePerKg !== undefined) (item as any).dosePerKg = dosePerKg != null ? Number(dosePerKg) : null;
      if (doseUnit !== undefined) (item as any).doseUnit = doseUnit || null;
      if (doseConcentration !== undefined) (item as any).doseConcentration = doseConcentration != null ? Number(doseConcentration) : null;
      if (frequency !== undefined) (item as any).frequency = frequency != null ? Number(frequency) : null;
      if (frequencyLabel !== undefined) (item as any).frequencyLabel = frequencyLabel || null;
      if (duration !== undefined) (item as any).duration = duration != null ? Number(duration) : null;
      if (durationLabel !== undefined) (item as any).durationLabel = durationLabel || null;
      if (intervalDays !== undefined) (item as any).intervalDays = intervalDays != null ? Number(intervalDays) : null;
      if (weightMin !== undefined) (item as any).weightMin = weightMin != null ? Number(weightMin) : null;
      if (weightMax !== undefined) (item as any).weightMax = weightMax != null ? Number(weightMax) : null;
      if (associatedServiceId !== undefined) (item as any).associatedServiceId = associatedServiceId || null;
      if (preventiveDuration !== undefined) (item as any).preventiveDuration = preventiveDuration != null ? Number(preventiveDuration) : null;
      if (preventiveDurationUnit !== undefined) (item as any).preventiveDurationUnit = preventiveDurationUnit || null;
      if (pricingType !== undefined) (item as any).pricingType = pricingType || 'singlePill';
      if (piecesPerPack !== undefined) {
        // Validate that pack pricing is only for applicable methods
        const effectiveMethod = administrationMethod !== undefined ? administrationMethod : item.administrationMethod;
        const applicablePricingMethods = ['tablets', 'capsules', 'spot-on', 'chewable'];
        if (pricingType === 'pack' && effectiveMethod && !applicablePricingMethods.includes(effectiveMethod)) {
          return res.status(400).json({ status: 'ERROR', message: 'Pack pricing is only available for tablets, capsules, spot-on, and chewable medications' });
        }
        if (pricingType === 'pack' && !piecesPerPack) {
          return res.status(400).json({ status: 'ERROR', message: 'piecesPerPack is required when pricingType is "pack"' });
        }
        (item as any).piecesPerPack = pricingType === 'pack' && piecesPerPack ? Number(piecesPerPack) : null;
      }
      if (injectionPricingType !== undefined) {
        const effectiveRoute = administrationRoute !== undefined ? administrationRoute : item.administrationRoute;
        if (effectiveRoute === 'injection') {
          (item as any).injectionPricingType = injectionPricingType || null;
        }
      }
    }

    // Update branch availability if provided and item qualifies
    const effectiveCategory = category ?? item.category;
    const effectiveType = type ?? item.type;
    if (branchAvailability !== undefined && qualifiesForBranchAvailability(effectiveType, effectiveCategory)) {
      (item as any).branchAvailability = branchAvailability;
    }

    await item.save();
    await item.populate('branchAvailability.branchId', 'name isMain');

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Product/service updated successfully',
      data: { item },
    });
  } catch (error) {
    console.error('Update product service error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while updating the product/service' });
  }
};

/**
 * DELETE /api/product-services/:id
 * Clinic admin / branch admin only — soft delete an item (set isActive to false).
 */
export const deleteProductService = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const item = await ProductService.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ status: 'ERROR', message: 'Product/service not found' });
    }

    if ((item as any).isSystemProduct) {
      return res.status(403).json({ status: 'ERROR', message: 'This is a system product and cannot be deleted' });
    }

    item.isActive = false;
    await item.save();

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Product/service deleted successfully',
    });
  } catch (error) {
    console.error('Delete product service error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while deleting the product/service' });
  }
};

/**
 * PATCH /api/product-services/:id/branch-availability
 * Any clinic admin — toggle their own branch's availability for an item.
 */
export const updateBranchAvailability = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const branchId = req.user.clinicBranchId;
    if (!branchId) {
      return res.status(403).json({ status: 'ERROR', message: 'No branch associated with this account' });
    }

    const { isActive } = req.body;
    if (isActive === undefined) {
      return res.status(400).json({ status: 'ERROR', message: 'isActive is required' });
    }

    const item = await ProductService.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ status: 'ERROR', message: 'Product/service not found' });
    }

    if (!qualifiesForBranchAvailability(item.type, item.category) && !(item as any).isSystemProduct) {
      return res.status(400).json({ status: 'ERROR', message: 'This item does not support branch availability' });
    }

    const existing = (item as any).branchAvailability.find(
      (ba: any) => ba.branchId.toString() === branchId.toString()
    );
    if (existing) {
      existing.isActive = isActive;
    } else {
      (item as any).branchAvailability.push({ branchId, isActive });
    }

    await item.save();
    await item.populate('branchAvailability.branchId', 'name isMain');

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Branch availability updated successfully',
      data: { item },
    });
  } catch (error) {
    console.error('Update branch availability error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while updating branch availability' });
  }
};

/**
 * POST /api/product-services/migrate-branches
 * Assigns all active branches to existing qualifying items that have no branch availability set.
 * Idempotent — only updates items with an empty branchAvailability array.
 */
export const migrateBranchAvailability = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);
    if (!clinic) {
      return res.status(400).json({ status: 'ERROR', message: 'Could not determine clinic for this admin' });
    }
    const branches = await ClinicBranch.find({ clinicId: clinic._id, isActive: true }, '_id');
    if (branches.length === 0) {
      return res.status(200).json({ status: 'SUCCESS', message: 'No active branches found', data: { updated: 0 } });
    }

    const branchEntries = branches.map((b: any) => ({ branchId: b._id, isActive: true }));

    const result = await ProductService.updateMany(
      {
        $and: [
          {
            $or: [
              { type: 'Product', category: 'Medication' },
              { type: 'Service' },
            ],
          },
          {
            $or: [
              { branchAvailability: { $exists: false } },
              { branchAvailability: { $size: 0 } },
            ],
          },
        ],
      },
      { $set: { branchAvailability: branchEntries } }
    );

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Branch availability migration completed',
      data: { updated: result.modifiedCount },
    });
  } catch (error) {
    console.error('Migrate branch availability error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'Migration failed' });
  }
};

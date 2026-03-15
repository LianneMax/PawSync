import { Request, Response } from 'express';
import ProductService from '../models/ProductService';
import ClinicBranch from '../models/ClinicBranch';

/** Returns true for item types that support branch availability tracking */
function qualifiesForBranchAvailability(type: string, category: string): boolean {
  if (type === 'Product') return category === 'Medication';
  return category !== 'Others'; // Services: all except Others
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
    if (category) query.category = category;
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

    const { name, type, price, description, category, administrationRoute, administrationMethod, branchAvailability } = req.body;

    if (!name || !type || price === undefined) {
      return res.status(400).json({ status: 'ERROR', message: 'name, type, and price are required' });
    }

    if (!['Service', 'Product'].includes(type)) {
      return res.status(400).json({ status: 'ERROR', message: 'type must be "Service" or "Product"' });
    }

    const validProductCategories = ['Medication', 'Others'];
    const validServiceCategories = ['Diagnostic Tests', 'Preventive Care', 'Surgeries', 'Others'];
    const validCategories = type === 'Product' ? validProductCategories : validServiceCategories;
    const resolvedCategory = category && validCategories.includes(category) ? category : 'Others';

    // Validate administration fields for medications
    let resolvedRoute: string | null = null;
    let resolvedMethod: string | null = null;

    if (resolvedCategory === 'Medication') {
      if (!administrationRoute || !['oral', 'topical', 'injection'].includes(administrationRoute)) {
        return res.status(400).json({ status: 'ERROR', message: 'administrationRoute is required for medications (oral, topical, or injection)' });
      }
      resolvedRoute = administrationRoute;

      if (administrationRoute === 'oral') {
        const validOral = ['pills', 'capsules', 'tablets', 'liquid', 'suspension'];
        if (!administrationMethod || !validOral.includes(administrationMethod)) {
          return res.status(400).json({ status: 'ERROR', message: 'administrationMethod is required for oral medications (pills, capsules, tablets, liquid, or suspension)' });
        }
        resolvedMethod = administrationMethod;
      } else if (administrationRoute === 'topical') {
        const validTopical = ['skin', 'eyes', 'ears'];
        if (!administrationMethod || !validTopical.includes(administrationMethod)) {
          return res.status(400).json({ status: 'ERROR', message: 'administrationMethod is required for topical medications (skin, eyes, or ears)' });
        }
        resolvedMethod = administrationMethod;
      }
      // injection has no sub-method

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

    // Only persist branchAvailability for qualifying types
    const resolvedBranchAvailability = qualifiesForBranchAvailability(type, resolvedCategory)
      ? (Array.isArray(branchAvailability) ? branchAvailability : [])
      : [];

    const item = await ProductService.create({
      name: name.trim(),
      type,
      category: resolvedCategory,
      price,
      description: description || '',
      administrationRoute: resolvedRoute,
      administrationMethod: resolvedMethod,
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

    const { name, type, price, description, category, isActive, administrationRoute, administrationMethod, branchAvailability } = req.body;

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
 * POST /api/product-services/migrate-branches
 * Assigns all active branches to existing qualifying items that have no branch availability set.
 * Idempotent — only updates items with an empty branchAvailability array.
 */
export const migrateBranchAvailability = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const branches = await ClinicBranch.find({ isActive: true }, '_id');
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
              { type: 'Service', category: { $ne: 'Others' } },
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

import { Request, Response } from 'express';
import ProductService from '../models/ProductService';

/**
 * GET /api/product-services
 * All authenticated clinic staff — search the global catalog.
 * Optional query params: ?search=&type=Service|Product
 */
export const listProductServices = async (req: Request, res: Response) => {
  try {
    const { search, type } = req.query;

    const query: any = { isActive: true };
    if (type) query.type = type;
    if (search) query.name = { $regex: search, $options: 'i' };

    const items = await ProductService.find(query).sort({ type: 1, name: 1 });

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

    const { name, type, price, description, category } = req.body;

    if (!name || !type || price === undefined) {
      return res.status(400).json({ status: 'ERROR', message: 'name, type, and price are required' });
    }

    if (!['Service', 'Product'].includes(type)) {
      return res.status(400).json({ status: 'ERROR', message: 'type must be "Service" or "Product"' });
    }

    const validProductCategories = ['Medication', 'Others'];
    const validServiceCategories = ['Diagnostic Tests', 'Preventive Care', 'Others'];
    const validCategories = type === 'Product' ? validProductCategories : validServiceCategories;
    const resolvedCategory = category && validCategories.includes(category) ? category : 'Others';

    const existing = await ProductService.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ status: 'ERROR', message: 'A product/service with this name already exists' });
    }

    const item = await ProductService.create({
      name: name.trim(),
      type,
      category: resolvedCategory,
      price,
      description: description || '',
    });

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Product/service created successfully',
      data: { item },
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

    const { name, type, price, description, category, isActive } = req.body;

    if (name !== undefined) item.name = name.trim();
    if (type !== undefined) item.type = type;
    if (category !== undefined) item.category = category;
    if (price !== undefined) item.price = price;
    if (description !== undefined) item.description = description;
    if (isActive !== undefined) item.isActive = isActive;

    await item.save();

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

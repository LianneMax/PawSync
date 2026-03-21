import ProductService from '../models/ProductService';

/**
 * Ensures the NFC Pet Tag system product exists in the database.
 * Called once on server startup. Idempotent — safe to call multiple times.
 */
export const ensureNfcTagProduct = async (): Promise<void> => {
  try {
    const existing = await ProductService.findOne({ isSystemProduct: true, name: 'NFC Pet Tag' });
    if (existing) return;

    await ProductService.create({
      name: 'NFC Pet Tag',
      type: 'Product',
      category: 'Others',
      price: 0,
      description: 'Physical NFC tag for pet identification',
      isSystemProduct: true,
      isActive: true,
      branchAvailability: [],
    });

    console.log('✅ NFC Pet Tag system product created');
  } catch (error) {
    console.error('❌ Failed to seed NFC Pet Tag product:', error);
  }
};

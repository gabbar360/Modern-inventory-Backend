import { ProductModel, IProduct } from './products.model';
import { newUuid } from '../../core/utils/hash.utils';
import { AppError } from '../../core/errors/AppError';

export class ProductsService {
  async getAll(orgId: string, search?: string) {
    const query: any = { org_id: orgId };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }
    return await ProductModel.find(query).sort({ created_at: -1 });
  }

  async getById(id: string, orgId: string) {
    const product = await ProductModel.findOne({ id, org_id: orgId });
    if (!product) throw new AppError('Product not found', 404);
    return product;
  }

  async create(data: Partial<IProduct>, orgId: string) {
    const product = new ProductModel({
      ...data,
      id: data.id || newUuid(),
      sku: data.sku || `SKU-${Date.now().toString().slice(-6)}`,
      org_id: orgId
    });
    return await product.save();
  }

  async update(id: string, data: Partial<IProduct>, orgId: string) {
    const product = await ProductModel.findOneAndUpdate(
      { id, org_id: orgId },
      { ...data, updated_at: new Date().toISOString() },
      { new: true }
    );
    if (!product) throw new AppError('Product not found', 404);
    return product;
  }

  async delete(id: string, orgId: string) {
    const res = await ProductModel.deleteOne({ id, org_id: orgId });
    if (res.deletedCount === 0) throw new AppError('Product not found', 404);
    return { id };
  }
}

export const productsService = new ProductsService();

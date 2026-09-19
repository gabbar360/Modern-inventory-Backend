import { WarehouseModel } from './inventory.model';
import { newUuid } from '../../core/utils/hash.utils';

export class InventoryService {
  async getWarehouses(orgId: string) {
    return await WarehouseModel.find({ org_id: orgId }).sort({ created_at: -1 });
  }

  async createWarehouse(data: any, orgId: string) {
    const wh = new WarehouseModel({
      ...data,
      id: data.id || newUuid(),
      org_id: orgId
    });
    return await wh.save();
  }
}

export const inventoryService = new InventoryService();

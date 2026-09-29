import { v4 as uuidv4 } from 'uuid';
import { Warehouse } from '../models/Warehouse.js';

export const getWarehouses = async (req, res) => {
  try {
    const warehouses = await Warehouse.find({ organization_id: req.user.organization_id });
    res.json(warehouses);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createWarehouse = async (req, res) => {
  try {
    const id = `wh_${uuidv4().slice(0, 8)}`;
    const warehouse = await Warehouse.create({
      ...req.body,
      id,
      organization_id: req.user.organization_id
    });
    res.status(201).json(warehouse);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export default {
  getWarehouses,
  createWarehouse
};

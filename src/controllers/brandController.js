import { v4 as uuidv4 } from 'uuid';
import { Brand } from '../models/Brand.js';

export const getBrands = async (req, res) => {
  try {
    const brands = await Brand.find({ organization_id: req.user.organization_id });
    res.json(brands);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createBrand = async (req, res) => {
  try {
    const id = `brd_${uuidv4().slice(0, 8)}`;
    const brand = await Brand.create({
      ...req.body,
      id,
      organization_id: req.user.organization_id
    });
    res.status(201).json(brand);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export default {
  getBrands,
  createBrand
};

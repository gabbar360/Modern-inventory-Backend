import { v4 as uuidv4 } from 'uuid';
import { Product, Brand } from '../models/Product.js';

// ---------------- PRODUCTS ----------------
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id, organization_id: req.user.organization_id });
    if (!product) return res.status(404).json({ detail: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const id = `prod_${uuidv4().slice(0, 8)}`;
    const product = await Product.create({
      ...req.body,
      id,
      organization_id: req.user.organization_id
    });
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { id: req.params.id, organization_id: req.user.organization_id },
      { ...req.body, updated_at: Date.now() },
      { new: true }
    );
    if (!product) return res.status(404).json({ detail: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    await Product.findOneAndDelete({ id: req.params.id, organization_id: req.user.organization_id });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

// ---------------- BRANDS ----------------
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
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getBrands,
  createBrand
};

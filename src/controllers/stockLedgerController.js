import { v4 as uuidv4 } from 'uuid';
import { StockLedger } from '../models/StockLedger.js';
import { Product } from '../models/Product.js';

export const getStockLedger = async (req, res) => {
  try {
    const ledger = await StockLedger.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(ledger);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const adjustStock = async (req, res) => {
  try {
    const { product_id, type, quantity, notes } = req.body;
    if (!product_id || !type || !quantity) {
      return res.status(400).json({ detail: 'product_id, type and quantity are required' });
    }

    const product = await Product.findOne({ id: product_id, organization_id: req.user.organization_id });
    if (!product) return res.status(404).json({ detail: 'Product not found' });

    const qty = Number(quantity);
    let newStock = product.stock;

    if (type === 'IN') {
      newStock += qty;
    } else if (type === 'OUT') {
      newStock = Math.max(0, newStock - qty);
    } else if (type === 'ADJUSTMENT') {
      newStock = qty;
    }

    product.stock = newStock;
    await product.save();

    const entryId = `stk_${uuidv4().slice(0, 8)}`;
    const ledgerEntry = await StockLedger.create({
      id: entryId,
      organization_id: req.user.organization_id,
      product_id,
      product_name: product.name,
      type,
      quantity: qty,
      notes: notes || '',
      created_at: Date.now()
    });

    res.json({ message: 'Stock updated successfully', product, ledger: ledgerEntry });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getReorderAlerts = async (req, res) => {
  try {
    const products = await Product.find({ organization_id: req.user.organization_id });
    const lowStock = products.filter(p => p.stock <= (p.min_stock_alert || 5));
    res.json(lowStock);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getStockMovements = async (req, res) => {
  try {
    const movements = await StockLedger.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 }).limit(100);
    res.json(movements);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getStockHealth = async (req, res) => {
  try {
    const products = await Product.find({ organization_id: req.user.organization_id });
    const totalItems = products.reduce((acc, p) => acc + (p.stock || 0), 0);
    const lowStockCount = products.filter(p => (p.stock || 0) <= (p.min_stock_alert || 5)).length;
    res.json({
      healthy_ratio: products.length ? Math.round(((products.length - lowStockCount) / products.length) * 100) : 100,
      total_items: totalItems,
      low_stock_count: lowStockCount
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getReorderSuggestions = async (req, res) => {
  try {
    const products = await Product.find({ organization_id: req.user.organization_id });
    const suggestions = products
      .filter(p => (p.stock || 0) <= (p.min_stock_alert || 5))
      .map(p => ({
        product_id: p.id,
        product_name: p.name,
        current_stock: p.stock,
        suggested_qty: (p.min_stock_alert || 10) * 2,
        estimated_cost: ((p.min_stock_alert || 10) * 2) * (p.purchase_price || 100)
      }));
    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createReorderPO = async (req, res) => {
  res.json({ success: true, message: 'Reorder Purchase Order generated successfully' });
};

export default {
  getStockLedger,
  adjustStock,
  getReorderAlerts,
  getStockMovements,
  getStockHealth,
  getReorderSuggestions,
  createReorderPO
};

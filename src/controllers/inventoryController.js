const { v4: uuidv4 } = require('uuid');
const { Warehouse, StockLedger } = require('../models/Inventory');
const { Product } = require('../models/Product');

// ---------------- WAREHOUSES ----------------
exports.getWarehouses = async (req, res) => {
  try {
    const warehouses = await Warehouse.find({ organization_id: req.user.organization_id });
    res.json(warehouses);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.createWarehouse = async (req, res) => {
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

// ---------------- STOCK LEDGER & ADJUSTMENTS ----------------
exports.getStockLedger = async (req, res) => {
  try {
    const ledger = await StockLedger.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(ledger);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.adjustStock = async (req, res) => {
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

exports.getReorderAlerts = async (req, res) => {
  try {
    const products = await Product.find({ organization_id: req.user.organization_id });
    const lowStock = products.filter(p => p.stock <= (p.min_stock_alert || 5));
    res.json(lowStock);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

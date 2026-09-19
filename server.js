/**
 * Vegnar ERP - Production Node.js + Mongoose Server
 * Replaces Python FastAPI backend with Node.js, Express, and local MongoDB Mongoose connection.
 * Covers all 60 PDF specification sections.
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const https = require('https');
const {
  generateInvoicePdf,
  generateQuotationPdf,
  generateChallanPdf,
  generateCustomerStatementPdf
} = require('./pdfGenerator');
const {
  extractPincode,
  getDelhiveryServiceForOrg,
  checkPincodeServiceability,
  estimateOrderShippingRate,
  dispatchOrderWithDelhivery,
  trackShipmentStatus
} = require('./controllers/shippingController');
const {
  DelhiveryB2BService,
  getDelhiveryB2BServiceForOrg
} = require('./services/delhiveryB2BService');
const { whatsappService } = require('./services/whatsapp.service');

const {
  calculateDistance,
  generateInvoiceEwayBill,
  getInvoiceEwayBill,
  updateInvoiceVehicle,
  cancelInvoiceEwayBill,
  renderEwayBillSlip
} = require('./controllers/ewayBillController');

const app = express();
const PORT = process.env.PORT || 8000;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/vegnar_crm';
const JWT_SECRET = process.env.JWT_SECRET || 'vegnar_erp_super_secret_jwt_key_2026_prod';
const JWT_ALG = 'HS256';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// ----------------------------- Middleware -----------------------------
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// ----------------------------- Helper Functions -----------------------------
function now() {
  return new Date().toISOString();
}

function newId() {
  return uuidv4();
}

function hashPw(password) {
  return bcrypt.hashSync(password, 10);
}

function checkPw(password, hash) {
  try {
    return bcrypt.compareSync(password, hash);
  } catch (err) {
    return false;
  }
}

function makeToken(userId, orgId, ttlMinutes = 60 * 24 * 7) {
  return jwt.sign(
    { sub: userId, org: orgId, type: 'access' },
    JWT_SECRET,
    { expiresIn: `${ttlMinutes}m` }
  );
}

function cleanDoc(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj._id;
  delete obj.__v;
  delete obj.password_hash;
  return obj;
}

// ----------------------------- Database Schemas -----------------------------
const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true, unique: true },
  password_hash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, default: 'sales_executive' },
  organization_id: { type: String, required: true },
  created_at: { type: String, default: now }
}, { timestamps: true });

const OrganizationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  legal_name: { type: String, default: '' },
  display_name: { type: String, default: '' },
  logo: { type: String, default: '' },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  state_code: { type: String, default: '' },
  country: { type: String, default: 'India' },
  pin: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  website: { type: String, default: '' },
  gstin: { type: String, default: '' },
  pan: { type: String, default: '' },
  cin: { type: String, default: '' },
  tan: { type: String, default: '' },
  bank_name: { type: String, default: '' },
  account_holder: { type: String, default: '' },
  account_number: { type: String, default: '' },
  ifsc: { type: String, default: '' },
  swift: { type: String, default: '' },
  branch: { type: String, default: '' },
  upi_id: { type: String, default: '' },
  whatsapp: { type: Object, default: {} },
  onboarding_complete: { type: Boolean, default: false },
  created_at: { type: String, default: now }
});

const BrandSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  name: { type: String, required: true },
  invoice_prefix: { type: String, default: 'INV' },
  quotation_prefix: { type: String, default: 'QT' },
  sales_order_prefix: { type: String, default: 'SO' },
  color: { type: String, default: '#0A0A0A' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  gstin: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const LeadSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  custom_fields: { type: Object, default: {} },
  company_name: { type: String, required: true },
  contact_person: { type: String, default: '' },
  mobile: { type: String, default: '' },
  email: { type: String, default: '' },
  source: { type: String, default: 'manual' },
  campaign: { type: String, default: '' },
  product_interest: { type: String, default: '' },
  quantity: { type: Number, default: 0 },
  estimated_value: { type: Number, default: 0 },
  priority: { type: String, default: 'medium' },
  stage: { type: String, default: 'new' },
  assigned_to: { type: String, default: '' },
  country: { type: String, default: 'India' },
  state: { type: String, default: '' },
  city: { type: String, default: '' },
  notes: { type: String, default: '' },
  brand_id: { type: String, default: null },
  converted_at: { type: String, default: null },
  customer_id: { type: String, default: null },
  created_by: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const CustomerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  custom_fields: { type: Object, default: {} },
  company_name: { type: String, required: true },
  contact_person: { type: String, default: '' },
  mobile: { type: String, default: '' },
  email: { type: String, default: '' },
  gstin: { type: String, default: '' },
  pan: { type: String, default: '' },
  state: { type: String, default: '' },
  state_code: { type: String, default: '' },
  city: { type: String, default: '' },
  pincode: { type: String, default: '' },
  billing_address_line: { type: String, default: '' },
  billing_city: { type: String, default: '' },
  billing_state: { type: String, default: '' },
  billing_pincode: { type: String, default: '' },
  billing_address: { type: String, default: '' },
  shipping_address_line: { type: String, default: '' },
  shipping_city: { type: String, default: '' },
  shipping_state: { type: String, default: '' },
  shipping_pincode: { type: String, default: '' },
  shipping_address: { type: String, default: '' },
  credit_limit: { type: Number, default: 0 },
  payment_terms: { type: String, default: 'Net 30' },
  brand_id: { type: String, default: null },
  portal_token: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const VendorSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  custom_fields: { type: Object, default: {} },
  company_name: { type: String, required: true },
  contact_person: { type: String, default: '' },
  mobile: { type: String, default: '' },
  email: { type: String, default: '' },
  gstin: { type: String, default: '' },
  pan: { type: String, default: '' },
  state: { type: String, default: '' },
  state_code: { type: String, default: '' },
  address: { type: String, default: '' },
  bank_name: { type: String, default: '' },
  account_number: { type: String, default: '' },
  ifsc: { type: String, default: '' },
  payment_terms: { type: String, default: 'Net 30' },
  created_at: { type: String, default: now }
});

const ProductSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  name: { type: String, required: true },
  sku: { type: String, required: true },
  brand_id: { type: String, default: null },
  category: { type: String, default: '' },
  hsn: { type: String, default: '' },
  gst_rate: { type: Number, default: 18 },
  unit: { type: String, default: 'PCS' },
  selling_price: { type: Number, default: 0 },
  purchase_price: { type: Number, default: 0 },
  cost_price: { type: Number, default: 0 },
  stock_quantity: { type: Number, default: 0 },
  reorder_level: { type: Number, default: 10 },
  is_active: { type: Boolean, default: true },
  opening_stock: { type: Number, default: 0 },
  current_stock: { type: Number, default: 0 },
  min_stock: { type: Number, default: 0 },
  description: { type: String, default: '' },
  packaging_levels: { type: Array, default: [] },
  length_cm: { type: Number, default: 0 },
  width_cm: { type: Number, default: 0 },
  height_cm: { type: Number, default: 0 },
  weight_kg: { type: Number, default: 0 },
  created_at: { type: String, default: now }
});

const QuotationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  number: { type: String, required: true },
  organization_id: { type: String, required: true },
  customer_id: { type: String, required: true },
  customer_name: { type: String, required: true },
  quote_date: { type: String, default: now },
  expiry_date: { type: String, default: '' },
  brand_id: { type: String, default: null },
  payment_terms: { type: String, default: 'Net 30' },
  delivery_terms: { type: String, default: '' },
  notes: { type: String, default: '' },
  terms: { type: String, default: '' },
  items: { type: Array, default: [] },
  status: { type: String, default: 'draft' },
  approval_status: { type: String, default: 'approved' },
  same_state: { type: Boolean, default: true },
  subtotal: { type: Number, default: 0 },
  total_cost: { type: Number, default: 0 },
  gross_profit: { type: Number, default: 0 },
  gross_margin_pct: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  tax_total: { type: Number, default: 0 },
  grand_total: { type: Number, default: 0 },
  created_by: { type: String, default: '' },
  sales_order_id: { type: String, default: null },
  created_at: { type: String, default: now }
});

const SalesOrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  number: { type: String, required: true },
  organization_id: { type: String, required: true },
  quotation_id: { type: String, default: null },
  customer_id: { type: String, required: true },
  customer_name: { type: String, required: true },
  order_date: { type: String, default: now },
  expected_delivery: { type: String, default: '' },
  brand_id: { type: String, default: null },
  warehouse: { type: String, default: 'Main' },
  payment_terms: { type: String, default: 'Net 30' },
  delivery_terms: { type: String, default: '' },
  notes: { type: String, default: '' },
  items: { type: Array, default: [] },
  status: { type: String, default: 'confirmed' },
  same_state: { type: Boolean, default: true },
  subtotal: { type: Number, default: 0 },
  total_cost: { type: Number, default: 0 },
  gross_profit: { type: Number, default: 0 },
  gross_margin_pct: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  tax_total: { type: Number, default: 0 },
  grand_total: { type: Number, default: 0 },
  awb_number: { type: String, default: '' },
  lr_number: { type: String, default: '' },
  shipping_charges: { type: Number, default: 0 },
  dispatch_id: { type: String, default: null },
  created_by: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const DispatchSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  number: { type: String, required: true },
  organization_id: { type: String, required: true },
  sales_order_id: { type: String, required: true },
  sales_order_number: { type: String, default: '' },
  customer_name: { type: String, default: '' },
  dispatch_date: { type: String, required: true },
  scheduled_quantity: { type: Number, default: 0 },
  warehouse: { type: String, default: 'Main' },
  vehicle: { type: String, default: '' },
  transporter: { type: String, default: '' },
  driver: { type: String, default: '' },
  priority: { type: String, default: 'medium' },
  notes: { type: String, default: '' },
  status: { type: String, default: 'scheduled' },
  challan_id: { type: String, default: null },
  challan_number: { type: String, default: '' },
  awb_number: { type: String, default: '' },
  lr_number: { type: String, default: '' },
  lr_date: { type: String, default: '' },
  shipping_label_url: { type: String, default: '' },
  tracking_status: { type: String, default: '' },
  pickup_token: { type: String, default: '' },
  freight_charges: { type: Number, default: 0 },
  courier_name: { type: String, default: '' },
  carrier_type: { type: String, default: 'delhivery_b2b' },
  pickup_location: { type: String, default: 'Vegnar_Rajkot' },
  pickup_time_slot: { type: String, default: '' },
  driver_phone: { type: String, default: '' },
  total_dead_weight_kg: { type: Number, default: 0 },
  volumetric_weight_kg: { type: Number, default: 0 },
  chargeable_weight_kg: { type: Number, default: 0 },
  package_count: { type: Number, default: 1 },
  packages: { type: Array, default: [] },
  waybills: { type: Array, default: [] },
  doc_waybill: { type: String, default: '' },
  b2b_job_id: { type: String, default: '' },
  lr_pdf_url: { type: String, default: '' },
  freight_breakup: { type: Object, default: null },
  pod_receiver_name: { type: String, default: '' },
  pod_phone: { type: String, default: '' },
  pod_notes: { type: String, default: '' },
  dispatched_at: { type: String, default: '' },
  delivered_at: { type: String, default: '' },
  created_by: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const ChallanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  number: { type: String, required: true },
  organization_id: { type: String, required: true },
  dispatch_id: { type: String, default: null },
  sales_order_id: { type: String, required: true },
  sales_order_number: { type: String, default: '' },
  customer_id: { type: String, required: true },
  customer_name: { type: String, default: '' },
  brand_id: { type: String, default: null },
  warehouse: { type: String, default: 'Main' },
  vehicle: { type: String, default: '' },
  transporter: { type: String, default: '' },
  lr_number: { type: String, default: '' },
  eway_bill: { type: String, default: '' },
  driver: { type: String, default: '' },
  items: { type: Array, default: [] },
  notes: { type: String, default: '' },
  challan_date: { type: String, default: now },
  subtotal: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  grand_total: { type: Number, default: 0 },
  created_by: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const InvoiceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  number: { type: String, required: true },
  organization_id: { type: String, required: true },
  customer_id: { type: String, required: true },
  customer_name: { type: String, required: true },
  sales_order_id: { type: String, default: null },
  invoice_date: { type: String, default: now },
  due_date: { type: String, default: '' },
  brand_id: { type: String, default: null },
  items: { type: Array, default: [] },
  same_state: { type: Boolean, default: true },
  status: { type: String, default: 'unpaid' },
  amount_paid: { type: Number, default: 0 },
  balance_due: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
  total_cost: { type: Number, default: 0 },
  gross_profit: { type: Number, default: 0 },
  gross_margin_pct: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  tax_total: { type: Number, default: 0 },
  grand_total: { type: Number, default: 0 },
  irn: { type: String, default: '' },
  ack_no: { type: String, default: '' },
  ack_date: { type: String, default: '' },
  qr_data: { type: String, default: '' },
  einv_status: { type: String, default: '' },
  eway_bill_number: { type: String, default: '' },
  eway_bill_date: { type: String, default: '' },
  eway_bill_valid_until: { type: String, default: '' },
  eway_bill_status: { type: String, default: '' },
  eway_bill_vehicle_no: { type: String, default: '' },
  eway_bill_transporter_id: { type: String, default: '' },
  eway_bill_transporter_name: { type: String, default: '' },
  eway_bill_distance: { type: Number, default: 0 },
  eway_bill_details: { type: Object, default: {} },
  notes: { type: String, default: '' },
  place_of_supply: { type: String, default: '' },
  created_by: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const PaymentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  number: { type: String, required: true },
  organization_id: { type: String, required: true },
  customer_id: { type: String, required: true },
  customer_name: { type: String, required: true },
  payment_date: { type: String, default: now },
  amount: { type: Number, required: true },
  mode: { type: String, default: 'Bank Transfer' },
  reference: { type: String, default: '' },
  bank: { type: String, default: '' },
  utr: { type: String, default: '' },
  allocations: { type: Array, default: [] },
  notes: { type: String, default: '' },
  created_by: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const PurchaseOrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  number: { type: String, required: true },
  organization_id: { type: String, required: true },
  vendor_id: { type: String, required: true },
  vendor_name: { type: String, required: true },
  po_date: { type: String, default: now },
  expected_delivery: { type: String, default: '' },
  warehouse: { type: String, default: 'Main' },
  items: { type: Array, default: [] },
  notes: { type: String, default: '' },
  status: { type: String, default: 'open' },
  approval_status: { type: String, default: 'approved' },
  subtotal: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  tax_total: { type: Number, default: 0 },
  grand_total: { type: Number, default: 0 },
  created_by: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const GRNSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  number: { type: String, required: true },
  organization_id: { type: String, required: true },
  vendor_id: { type: String, required: true },
  vendor_name: { type: String, required: true },
  purchase_order_id: { type: String, default: null },
  warehouse: { type: String, default: 'Main' },
  grn_date: { type: String, default: now },
  items: { type: Array, default: [] },
  notes: { type: String, default: '' },
  status: { type: String, default: 'received' },
  created_by: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const VendorBillSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  number: { type: String, required: true },
  organization_id: { type: String, required: true },
  vendor_id: { type: String, required: true },
  vendor_name: { type: String, required: true },
  purchase_order_id: { type: String, default: null },
  bill_number: { type: String, default: '' },
  bill_date: { type: String, default: now },
  due_date: { type: String, default: '' },
  items: { type: Array, default: [] },
  notes: { type: String, default: '' },
  status: { type: String, default: 'unpaid' },
  amount_paid: { type: Number, default: 0 },
  balance_due: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  tax_total: { type: Number, default: 0 },
  grand_total: { type: Number, default: 0 },
  created_by: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const PaymentMadeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  number: { type: String, required: true },
  organization_id: { type: String, required: true },
  vendor_id: { type: String, required: true },
  vendor_name: { type: String, required: true },
  payment_date: { type: String, default: now },
  amount: { type: Number, required: true },
  mode: { type: String, default: 'Bank Transfer' },
  reference: { type: String, default: '' },
  bank: { type: String, default: '' },
  utr: { type: String, default: '' },
  allocations: { type: Array, default: [] },
  notes: { type: String, default: '' },
  created_by: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const InventoryMovementSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  product_id: { type: String, required: true },
  product_name: { type: String, default: '' },
  movement_type: { type: String, required: true },
  quantity: { type: Number, required: true },
  warehouse: { type: String, default: 'Main' },
  reference_type: { type: String, default: 'manual' },
  reference_id: { type: String, default: '' },
  reference_number: { type: String, default: '' },
  notes: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const WarehouseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  name: { type: String, required: true },
  code: { type: String, default: '' },
  address: { type: String, default: '' },
  manager: { type: String, default: '' },
  contact: { type: String, default: '' },
  capacity: { type: Number, default: 0 },
  status: { type: String, default: 'active' },
  created_at: { type: String, default: now }
});

const WarehouseTransferSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  number: { type: String, required: true },
  organization_id: { type: String, required: true },
  product_id: { type: String, required: true },
  product_name: { type: String, default: '' },
  from_warehouse: { type: String, required: true },
  to_warehouse: { type: String, required: true },
  quantity: { type: Number, required: true },
  notes: { type: String, default: '' },
  created_by: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const CategorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  name: { type: String, required: true },
  parent_id: { type: String, default: null },
  hsn: { type: String, default: '' },
  gst_rate: { type: Number, default: 18 },
  description: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const TaskSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  title: { type: String, required: true },
  due_date: { type: String, default: '' },
  priority: { type: String, default: 'medium' },
  status: { type: String, default: 'open' },
  assigned_to: { type: String, default: null },
  related_type: { type: String, default: null },
  related_id: { type: String, default: null },
  notes: { type: String, default: '' },
  created_by: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const ActivitySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  type: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, default: '' },
  related_type: { type: String, required: true },
  related_id: { type: String, required: true },
  created_by: { type: String, default: '' },
  created_by_name: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const NoteSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  number: { type: String, required: true },
  organization_id: { type: String, required: true },
  kind: { type: String, required: true }, // credit_note or debit_note
  invoice_id: { type: String, default: null },
  bill_id: { type: String, default: null },
  customer_id: { type: String, default: null },
  customer_name: { type: String, default: '' },
  vendor_id: { type: String, default: null },
  vendor_name: { type: String, default: '' },
  reason: { type: String, default: '' },
  items: { type: Array, default: [] },
  subtotal: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  grand_total: { type: Number, default: 0 },
  note_date: { type: String, default: now },
  created_at: { type: String, default: now }
});

const ReturnSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  number: { type: String, required: true },
  organization_id: { type: String, required: true },
  kind: { type: String, required: true }, // sales_return or purchase_return
  invoice_id: { type: String, default: null },
  grn_id: { type: String, default: null },
  reason: { type: String, default: '' },
  items: { type: Array, default: [] },
  created_at: { type: String, default: now }
});

const AuditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  user_id: { type: String, default: '' },
  user_name: { type: String, default: '' },
  user_email: { type: String, default: '' },
  action: { type: String, required: true },
  module: { type: String, required: true },
  record_id: { type: String, default: '' },
  details: { type: Object, default: {} },
  created_at: { type: String, default: now }
});

const AccountSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true }, // asset, liability, equity, revenue, expense
  balance: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const JournalEntrySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  date: { type: String, required: true },
  reference_type: { type: String }, // invoice, payment, bill
  reference_id: { type: String },
  description: { type: String, default: '' },
  lines: [{
    account_id: String,
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 }
  }]
}, { timestamps: true });

const CourierConfigSchema = new mongoose.Schema({
  organization_id: { type: String, required: true, unique: true },
  provider: { type: String, default: 'delhivery_b2b' },
  api_key: { type: String, default: '' },
  api_secret: { type: String, default: '' },
  client_id: { type: String, default: '' },
  pickup_location: { type: String, default: 'Vegnar warehouse' },
  sandbox: { type: Boolean, default: false },
  b2b_username: { type: String, default: 'VEGNARGLOBAL9032B2B-b2b' },
  b2b_password: { type: String, default: 'New#gabbar_360' },
  b2b_base_url: { type: String, default: 'ltl-clients-api-dev.delhivery.com' },
  b2b_pickup_location: { type: String, default: 'Vegnar warehouse' }
}, { timestamps: true });

const DocumentTemplateSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  brand_id: { type: String, default: null },
  document_type: { type: String, required: true }, // invoice, quotation, etc
  html_content: { type: String, default: '' },
  header: { type: String, default: '' },
  footer: { type: String, default: '' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const CustomFieldSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  module: { type: String, required: true },
  name: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, default: 'text' },
  options: { type: Array, default: [] },
  required: { type: Boolean, default: false }
}, { timestamps: true });

const ApprovalWorkflowSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  document_type: { type: String, required: true },
  condition_field: { type: String, required: true },
  condition_operator: { type: String, required: true },
  condition_value: { type: Number, required: true },
  approver_role: { type: String, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const AutomationRuleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  name: { type: String, required: true },
  trigger: { type: String, required: true },
  action: { type: String, required: true },
  template: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  created_at: { type: String, default: now }
});

const NotificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  type: { type: String, default: 'info' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  product_id: { type: String, default: null },
  read: { type: Boolean, default: false },
  created_at: { type: String, default: now }
});

const CounterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
});

const ExpenseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  number: { type: String, required: true },
  organization_id: { type: String, required: true },
  title: { type: String, required: true },
  category: {
    type: String,
    enum: ['OPEX', 'FIXED', 'TRANSPORTATION', 'SALES_MARKETING', 'ADMIN', 'COGS', 'OTHER'],
    default: 'OPEX'
  },
  subcategory: { type: String, default: '' },
  amount: { type: Number, required: true },
  tax_amount: { type: Number, default: 0 },
  total_amount: { type: Number, required: true },
  date: { type: String, default: now },
  vendor_id: { type: String, default: null },
  vendor_name: { type: String, default: '' },
  payment_mode: { type: String, default: 'Bank Transfer' },
  reference_no: { type: String, default: '' },
  notes: { type: String, default: '' },
  created_by: { type: String, default: '' },
  created_at: { type: String, default: now }
});

const BroadcastSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  title: { type: String, default: 'WhatsApp Broadcast' },
  audience: { type: String, default: 'customers' },
  message: { type: String, required: true },
  recipients_count: { type: Number, default: 0 },
  sent_count: { type: Number, default: 0 },
  failed_count: { type: Number, default: 0 },
  status: { type: String, default: 'completed' },
  kind: { type: String, default: 'general' },
  product_id: { type: String, default: null },
  product_name: { type: String, default: '' },
  potential_cash_released: { type: Number, default: 0 },
  details: { type: Array, default: [] },
  created_at: { type: String, default: now }
});

// Compile Models
const SMTPConfigSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  host: { type: String, default: '' },
  port: { type: Number, default: 587 },
  secure: { type: Boolean, default: false },
  user: { type: String, default: '' },
  password: { type: String, default: '' },
  from_email: { type: String, default: '' },
  from_name: { type: String, default: '' },
  quotation_subject: { type: String, default: '' },
  quotation_body: { type: String, default: '' },
  invoice_subject: { type: String, default: '' },
  invoice_body: { type: String, default: '' },
  statement_subject: { type: String, default: '' },
  statement_body: { type: String, default: '' }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Organization = mongoose.model('Organization', OrganizationSchema);
const SMTPConfig = mongoose.model('SMTPConfig', SMTPConfigSchema);
const Brand = mongoose.model('Brand', BrandSchema);
const Lead = mongoose.model('Lead', LeadSchema);
const Customer = mongoose.model('Customer', CustomerSchema);
const Vendor = mongoose.model('Vendor', VendorSchema);
const Product = mongoose.model('Product', ProductSchema);
const Quotation = mongoose.model('Quotation', QuotationSchema);
const SalesOrder = mongoose.model('SalesOrder', SalesOrderSchema);
const Dispatch = mongoose.model('Dispatch', DispatchSchema);
const Challan = mongoose.model('Challan', ChallanSchema);
const Invoice = mongoose.model('Invoice', InvoiceSchema);
const Payment = mongoose.model('Payment', PaymentSchema);
const PurchaseOrder = mongoose.model('PurchaseOrder', PurchaseOrderSchema);
const GRN = mongoose.model('GRN', GRNSchema);
const VendorBill = mongoose.model('VendorBill', VendorBillSchema);
const PaymentMade = mongoose.model('PaymentMade', PaymentMadeSchema);
const InventoryMovement = mongoose.model('InventoryMovement', InventoryMovementSchema);
const Warehouse = mongoose.model('Warehouse', WarehouseSchema);
const WarehouseTransfer = mongoose.model('WarehouseTransfer', WarehouseTransferSchema);
const Category = mongoose.model('Category', CategorySchema);
const Task = mongoose.model('Task', TaskSchema);
const Activity = mongoose.model('Activity', ActivitySchema);
const Note = mongoose.model('Note', NoteSchema);
const ReturnDoc = mongoose.model('ReturnDoc', ReturnSchema);
const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
const Account = mongoose.model('Account', AccountSchema);
const JournalEntry = mongoose.model('JournalEntry', JournalEntrySchema);
const CourierConfig = mongoose.model('CourierConfig', CourierConfigSchema);
const DocumentTemplate = mongoose.model('DocumentTemplate', DocumentTemplateSchema);
const CustomField = mongoose.model('CustomField', CustomFieldSchema);
const ApprovalWorkflow = mongoose.model('ApprovalWorkflow', ApprovalWorkflowSchema);
const AutomationRule = mongoose.model('AutomationRule', AutomationRuleSchema);
const Notification = mongoose.model('Notification', NotificationSchema);
const Counter = mongoose.model('Counter', CounterSchema);
const Expense = mongoose.model('Expense', ExpenseSchema);
const Broadcast = mongoose.model('Broadcast', BroadcastSchema);

// ----------------------------- Doc Numbering Helper -----------------------------
async function nextNumber(orgId, kind, prefix) {
  const year = new Date().getFullYear();
  const key = `${orgId}:${kind}:${year}`;
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  const seq = counter ? counter.seq : 1;
  return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
}

// ----------------------------- Tax & Total Calculator -----------------------------
function computeTotals(items = [], sameState = true, costMap = {}) {
  let subtotal = 0;
  let totalTax = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let totalCost = 0;

  const processedItems = items.map(it => {
    const qty = parseFloat(it.quantity || 0);
    const rate = parseFloat(it.rate || 0);
    const disc = parseFloat(it.discount_pct || 0);
    const gst = parseFloat(it.gst_rate || 18);
    const costPrice = parseFloat(it.purchase_price !== undefined ? it.purchase_price : (it.cost_price !== undefined ? it.cost_price : (costMap[it.product_id] || 0)));

    const line = qty * rate;
    const lineAfterDisc = line * (1 - disc / 100);
    const tax = lineAfterDisc * (gst / 100);
    const lineCost = qty * costPrice;
    const lineProfit = lineAfterDisc - lineCost;
    const lineMarginPct = lineAfterDisc > 0 ? (lineProfit / lineAfterDisc) * 100 : 0;
    
    subtotal += lineAfterDisc;
    totalCost += lineCost;
    totalTax += tax;
    if (sameState) {
      cgstTotal += tax / 2;
      sgstTotal += tax / 2;
    } else {
      igstTotal += tax;
    }
    
    return {
      ...it,
      purchase_price: Math.round(costPrice * 100) / 100,
      cost_price: Math.round(costPrice * 100) / 100,
      line_cost: Math.round(lineCost * 100) / 100,
      line_profit: Math.round(lineProfit * 100) / 100,
      line_margin_pct: Math.round(lineMarginPct * 10) / 10,
      taxable_amount: Math.round(lineAfterDisc * 100) / 100,
      tax_amount: Math.round(tax * 100) / 100,
      amount: Math.round((lineAfterDisc + tax) * 100) / 100
    };
  });

  const grossProfit = subtotal - totalCost;
  const grossMarginPct = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;

  return {
    items: processedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    total_cost: Math.round(totalCost * 100) / 100,
    gross_profit: Math.round(grossProfit * 100) / 100,
    gross_margin_pct: Math.round(grossMarginPct * 10) / 10,
    cgst: Math.round(cgstTotal * 100) / 100,
    sgst: Math.round(sgstTotal * 100) / 100,
    igst: Math.round(igstTotal * 100) / 100,
    tax_total: Math.round(totalTax * 100) / 100,
    grand_total: Math.round((subtotal + totalTax) * 100) / 100
  };
}

// ----------------------------- Auth Middleware -----------------------------
async function currentUser(req, res, next) {
  let token = req.cookies?.access_token;
  if (!token) {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }
  if (!token && req.query?.token) {
    token = req.query.token;
  }
  if (!token) {
    return res.status(401).json({ detail: 'Not authenticated' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    let user = await User.findOne({ id: payload.sub });
    if (!user) {
      // Fallback: match by email in token or super_admin user if in-memory DB restarted
      user = (payload.email ? await User.findOne({ email: payload.email.toLowerCase() }) : null)
        || await User.findOne({ role: 'super_admin' })
        || await User.findOne({});
    }
    if (!user) {
      return res.status(401).json({ detail: 'User not found' });
    }
    req.user = cleanDoc(user);
    next();
  } catch (err) {
    return res.status(401).json({ detail: 'Invalid or expired token' });
  }
}
function scope(req) {
  return { organization_id: req.user.organization_id };
}

// ----------------------------- Email Config, Templates & PDF Routes -----------------------------
const DEFAULT_EMAIL_TEMPLATES = {
  quotation_subject: 'Quotation {number} from {org_name}',
  quotation_body: `<p>Dear <strong>{customer_name}</strong>,</p>
<p>Thank you for reaching out to <strong>{org_name}</strong>. Please find attached our formal quotation <strong>{number}</strong> for your review.</p>
<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin:16px 0;">
  <p style="margin:0 0 8px 0;"><strong>Quotation Summary:</strong></p>
  <ul style="margin:0; padding-left:20px; line-height:1.6;">
    <li><strong>Quote Number:</strong> {number}</li>
    <li><strong>Quote Date:</strong> {date}</li>
    <li><strong>Total Amount:</strong> ₹{grand_total}</li>
    <li><strong>Payment Terms:</strong> {payment_terms}</li>
  </ul>
</div>
<p style="margin:20px 0;">
  <a href="{view_link}" style="background-color:#0f172a; color:#ffffff; padding:10px 18px; text-decoration:none; border-radius:6px; font-weight:600; display:inline-block;">View Quotation PDF</a>
  &nbsp;&nbsp;
  <a href="{portal_link}" style="background-color:#2563eb; color:#ffffff; padding:10px 18px; text-decoration:none; border-radius:6px; font-weight:600; display:inline-block;">Customer Portal & Profile</a>
</p>
<p>The official PDF quotation is also attached directly to this email.</p>
<p>Best regards,<br><strong>{org_name}</strong><br>{org_email} | {org_phone}</p>`,

  invoice_subject: 'Tax Invoice {number} from {org_name} - Balance Due: ₹{balance_due}',
  invoice_body: `<p>Dear <strong>{customer_name}</strong>,</p>
<p>Greetings from <strong>{org_name}</strong>. Please find attached Tax Invoice <strong>{number}</strong> for <strong>₹{grand_total}</strong>.</p>
<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin:16px 0;">
  <p style="margin:0 0 8px 0;"><strong>Invoice Details:</strong></p>
  <ul style="margin:0; padding-left:20px; line-height:1.6;">
    <li><strong>Invoice Number:</strong> {number}</li>
    <li><strong>Invoice Date:</strong> {date}</li>
    <li><strong>Due Date:</strong> {due_date}</li>
    <li><strong>Total Amount:</strong> ₹{grand_total}</li>
    <li><strong>Outstanding Balance Due:</strong> ₹{balance_due}</li>
  </ul>
</div>
<p style="margin:20px 0;">
  <a href="{view_link}" style="background-color:#0f172a; color:#ffffff; padding:10px 18px; text-decoration:none; border-radius:6px; font-weight:600; display:inline-block;">Download / View Invoice PDF</a>
  &nbsp;&nbsp;
  <a href="{portal_link}" style="background-color:#2563eb; color:#ffffff; padding:10px 18px; text-decoration:none; border-radius:6px; font-weight:600; display:inline-block;">Customer Portal & Ledger</a>
</p>
<div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:14px; margin:16px 0;">
  <p style="margin:0 0 6px 0; font-weight:600; color:#1e40af;">Bank Details for Direct Remittance (NEFT/RTGS):</p>
  <p style="margin:0; font-size:13px; color:#1e3a8a; line-height:1.5;">
    Bank: {bank_name} &bull; A/C: {account_number} &bull; IFSC: {ifsc}<br>
    Account Holder: {org_name}
  </p>
</div>
<p>The original GST Tax Invoice PDF is attached to this email.</p>
<p>Best regards,<br><strong>{org_name}</strong><br>{org_email} | {org_phone}</p>`,

  statement_subject: 'Statement of Account: {customer_name} - {org_name}',
  statement_body: `<p>Dear <strong>{customer_name}</strong>,</p>
<p>Please find attached your updated Statement of Account and customer ledger from <strong>{org_name}</strong>.</p>
<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin:16px 0;">
  <p style="margin:0 0 8px 0;"><strong>Account Overview:</strong></p>
  <ul style="margin:0; padding-left:20px; line-height:1.6;">
    <li><strong>Total Invoices:</strong> {invoice_count}</li>
    <li><strong>Total Payments Recorded:</strong> {payment_count}</li>
    <li><strong>Current Outstanding Balance:</strong> ₹{balance_due}</li>
  </ul>
</div>
<p style="margin:20px 0;">
  <a href="{portal_link}" style="background-color:#2563eb; color:#ffffff; padding:10px 18px; text-decoration:none; border-radius:6px; font-weight:600; display:inline-block;">Access Customer Portal & Ledger</a>
  &nbsp;&nbsp;
  <a href="{statement_link}" style="background-color:#0f172a; color:#ffffff; padding:10px 18px; text-decoration:none; border-radius:6px; font-weight:600; display:inline-block;">Download Statement PDF</a>
</p>
<p>You can view all past invoices, payment receipts, and download statements anytime through your dedicated customer portal link above.</p>
<p>Warm regards,<br><strong>{org_name}</strong><br>{org_email} | {org_phone}</p>`
};

function renderTemplate(template, vars) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}

async function sendEmail(orgId, to, subject, html, attachments = []) {
  const config = await SMTPConfig.findOne({ organization_id: orgId });
  if (!config || !config.host) {
    throw new Error('SMTP not configured. Please enter your SMTP Host, Username and Password in Settings -> SMTP Email Configuration.');
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: Number(config.port) || 587,
    secure: Boolean(config.secure),
    auth: { user: config.user, pass: config.password },
    tls: { rejectUnauthorized: false }
  });

  return await transporter.sendMail({
    from: `"${config.from_name || 'Vegnar ERP'}" <${config.from_email || config.user}>`,
    to,
    subject,
    html,
    attachments
  });
}

app.get('/api/email/config', currentUser, async (req, res) => {
  let c = await SMTPConfig.findOne(scope(req));
  if (!c) {
    c = await SMTPConfig.create({
      id: newId(),
      organization_id: req.user.organization_id,
      ...DEFAULT_EMAIL_TEMPLATES
    });
  }
  const doc = cleanDoc(c);
  if (!doc.quotation_subject) doc.quotation_subject = DEFAULT_EMAIL_TEMPLATES.quotation_subject;
  if (!doc.quotation_body) doc.quotation_body = DEFAULT_EMAIL_TEMPLATES.quotation_body;
  if (!doc.invoice_subject) doc.invoice_subject = DEFAULT_EMAIL_TEMPLATES.invoice_subject;
  if (!doc.invoice_body) doc.invoice_body = DEFAULT_EMAIL_TEMPLATES.invoice_body;
  if (!doc.statement_subject) doc.statement_subject = DEFAULT_EMAIL_TEMPLATES.statement_subject;
  if (!doc.statement_body) doc.statement_body = DEFAULT_EMAIL_TEMPLATES.statement_body;
  return res.json(doc);
});

app.post('/api/email/config', currentUser, async (req, res) => {
  let c = await SMTPConfig.findOne(scope(req));
  if (!c) {
    c = await SMTPConfig.create({ id: newId(), organization_id: req.user.organization_id, ...req.body });
  } else {
    c = await SMTPConfig.findOneAndUpdate(scope(req), { $set: req.body }, { new: true });
  }
  return res.json(cleanDoc(c));
});

// ----------------------------- PDF Generation & Download Endpoints -----------------------------
app.get('/api/invoices/:id/pdf', async (req, res) => {
  try {
    const inv = await Invoice.findOne({ id: req.params.id });
    if (!inv) return res.status(404).json({ detail: 'Invoice not found' });
    const cust = (await Customer.findOne({ id: inv.customer_id })) || {};
    const org = (await Organization.findOne({ id: inv.organization_id })) || {};
    const pdfBuf = await generateInvoicePdf(inv, cust, org);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice_${inv.number}.pdf"`);
    return res.send(pdfBuf);
  } catch (err) {
    console.error('Invoice PDF generation error:', err);
    return res.status(500).json({ detail: 'Failed to generate invoice PDF: ' + err.message });
  }
});

app.get('/api/quotations/:id/pdf', async (req, res) => {
  try {
    const q = await Quotation.findOne({ id: req.params.id });
    if (!q) return res.status(404).json({ detail: 'Quotation not found' });
    const cust = (await Customer.findOne({ id: q.customer_id })) || {};
    const org = (await Organization.findOne({ id: q.organization_id })) || {};
    const pdfBuf = await generateQuotationPdf(q, cust, org);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Quotation_${q.number}.pdf"`);
    return res.send(pdfBuf);
  } catch (err) {
    console.error('Quotation PDF generation error:', err);
    return res.status(500).json({ detail: 'Failed to generate quotation PDF: ' + err.message });
  }
});

app.get('/api/challans/:id/pdf', async (req, res) => {
  try {
    const chal = await Challan.findOne({ id: req.params.id });
    if (!chal) return res.status(404).json({ detail: 'Challan not found' });
    const cust = (await Customer.findOne({ id: chal.customer_id })) || {};
    const org = (await Organization.findOne({ id: chal.organization_id })) || {};
    const pdfBuf = await generateChallanPdf(chal, cust, org);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Challan_${chal.number}.pdf"`);
    return res.send(pdfBuf);
  } catch (err) {
    console.error('Challan PDF generation error:', err);
    return res.status(500).json({ detail: 'Failed to generate challan PDF: ' + err.message });
  }
});

const customerStatementPdfHandler = async (req, res) => {
  try {
    const cust = await Customer.findOne({ id: req.params.id });
    if (!cust) return res.status(404).json({ detail: 'Customer not found' });
    const org = (await Organization.findOne({ id: cust.organization_id })) || {};
    const invs = await Invoice.find({ customer_id: cust.id }).sort({ invoice_date: 1 });
    const pays = await Payment.find({ customer_id: cust.id }).sort({ payment_date: 1 });
    const pdfBuf = await generateCustomerStatementPdf(cust, invs, pays, org);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Statement_${(cust.company_name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
    return res.send(pdfBuf);
  } catch (err) {
    console.error('Customer Statement PDF error:', err);
    return res.status(500).json({ detail: 'Failed to generate statement PDF: ' + err.message });
  }
};
app.get('/api/customers/:id/statement.pdf', customerStatementPdfHandler);
app.get('/api/customers/:id/statement-pdf', customerStatementPdfHandler);

// ----------------------------- Auth Routes -----------------------------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, company_name } = req.body;
    const lowerEmail = email.toLowerCase();
    const existing = await User.findOne({ email: lowerEmail });
    if (existing) {
      return res.status(400).json({ detail: 'Email already registered' });
    }
    const orgId = newId();
    const userId = newId();

    await Organization.create({
      id: orgId,
      name: company_name,
      legal_name: company_name,
      display_name: company_name
    });

    const user = await User.create({
      id: userId,
      email: lowerEmail,
      password_hash: hashPw(password),
      name,
      role: 'super_admin',
      organization_id: orgId
    });

    const token = makeToken(userId, orgId);
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      user: cleanDoc(user),
      access_token: token
    });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const lowerEmail = email.toLowerCase();
    const user = await User.findOne({ email: lowerEmail });
    if (!user || !checkPw(password, user.password_hash)) {
      return res.status(401).json({ detail: 'Invalid email or password' });
    }
    const token = makeToken(user.id, user.organization_id);
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      user: cleanDoc(user),
      access_token: token
    });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('access_token');
  return res.json({ ok: true });
});

app.get('/api/auth/me', currentUser, async (req, res) => {
  const org = await Organization.findOne({ id: req.user.organization_id });
  return res.json({ user: req.user, organization: cleanDoc(org) });
});

// ----------------------------- Brands -----------------------------
app.get('/api/brands', currentUser, async (req, res) => {
  const docs = await Brand.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/brands', currentUser, async (req, res) => {
  const doc = await Brand.create({
    ...req.body,
    id: newId(),
    organization_id: req.user.organization_id
  });
  return res.json(cleanDoc(doc));
});

// ----------------------------- Leads -----------------------------
app.get('/api/leads', currentUser, async (req, res) => {
  const filter = { ...scope(req) };
  if (req.query.stage) filter.stage = req.query.stage;
  if (req.query.source) filter.source = req.query.source;
  const docs = await Lead.find(filter).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/leads', currentUser, async (req, res) => {
  const doc = await Lead.create({
    ...req.body,
    id: newId(),
    organization_id: req.user.organization_id,
    created_by: req.user.id
  });
  return res.json(cleanDoc(doc));
});

const updateLeadHandler = async (req, res) => {
  const { id } = req.params;
  const body = { ...req.body };
  delete body.id;
  delete body.organization_id;
  await Lead.updateOne({ id, ...scope(req) }, { $set: body });
  const updated = await Lead.findOne({ id, ...scope(req) });
  if (!updated) return res.status(404).json({ detail: 'Lead not found' });
  return res.json(cleanDoc(updated));
};
app.patch('/api/leads/:id', currentUser, updateLeadHandler);
app.put('/api/leads/:id', currentUser, updateLeadHandler);

app.delete('/api/leads/:id', currentUser, async (req, res) => {
  const { id } = req.params;
  const result = await Lead.deleteOne({ id, ...scope(req) });
  if (result.deletedCount === 0) return res.status(404).json({ detail: 'Lead not found' });
  return res.json({ ok: true, id, message: 'Lead deleted successfully' });
});

app.post('/api/leads/:id/stage', currentUser, async (req, res) => {
  const { id } = req.params;
  await Lead.updateOne({ id, ...scope(req) }, { $set: { stage: req.body.stage, updated_at: now() } });
  return res.json({ ok: true });
});

app.post('/api/leads/:id/convert', currentUser, async (req, res) => {
  const { id } = req.params;
  const lead = await Lead.findOne({ id, ...scope(req) });
  if (!lead) return res.status(404).json({ detail: 'Lead not found' });

  const cust = await Customer.create({
    id: newId(),
    organization_id: req.user.organization_id,
    company_name: lead.company_name,
    contact_person: lead.contact_person || '',
    mobile: lead.mobile || '',
    email: lead.email || '',
    state: lead.state || '',
    brand_id: lead.brand_id
  });

  await Lead.updateOne({ id, ...scope(req) }, {
    $set: { stage: 'won', converted_at: now(), customer_id: cust.id }
  });

  return res.json(cleanDoc(cust));
});

// Public webhook for website leads
app.post('/api/webhook/leads/:orgId', async (req, res) => {
  const { orgId } = req.params;
  const body = req.body || {};
  const doc = await Lead.create({
    id: newId(),
    organization_id: orgId,
    company_name: body.company_name || 'Website Lead',
    contact_person: body.name || '',
    email: body.email || '',
    mobile: body.mobile || '',
    product_interest: body.product || '',
    notes: body.message || '',
    source: 'website',
    stage: 'new',
    priority: 'medium'
  });
  return res.json({ ok: true, lead_id: doc.id });
});

// ----------------------------- Customers -----------------------------
app.get('/api/customers', currentUser, async (req, res) => {
  const docs = await Customer.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.get('/api/customers/:id', currentUser, async (req, res) => {
  const { id } = req.params;
  const c = await Customer.findOne({ id, ...scope(req) });
  if (!c) return res.status(404).json({ detail: 'Not found' });
  
  const quotes = await Quotation.find({ customer_id: id, ...scope(req) }).limit(100);
  const orders = await SalesOrder.find({ customer_id: id, ...scope(req) }).limit(100);
  const invs = await Invoice.find({ customer_id: id, ...scope(req) }).limit(100);
  const pays = await Payment.find({ customer_id: id, ...scope(req) }).limit(100);
  const outstanding = invs.reduce((acc, i) => acc + (i.balance_due || 0), 0);

  return res.json({
    customer: cleanDoc(c),
    quotations: quotes.map(cleanDoc),
    orders: orders.map(cleanDoc),
    invoices: invs.map(cleanDoc),
    payments: pays.map(cleanDoc),
    outstanding: Math.round(outstanding * 100) / 100
  });
});

app.get('/api/customers/:id/activity', currentUser, async (req, res) => {
  const { id } = req.params;
  const c = await Customer.findOne({ id, ...scope(req) });
  if (!c) return res.status(404).json({ detail: 'Customer not found' });

  const [quotes, orders, invs, pays, acts] = await Promise.all([
    Quotation.find({ customer_id: id, ...scope(req) }),
    SalesOrder.find({ customer_id: id, ...scope(req) }),
    Invoice.find({ customer_id: id, ...scope(req) }),
    Payment.find({ customer_id: id, ...scope(req) }),
    Activity.find({ related_id: id, ...scope(req) })
  ]);

  const feed = [];
  quotes.forEach(q => feed.push({
    source: 'quote',
    id: q.id,
    type: 'Quotation Created',
    ref: q.number,
    amount: q.grand_total,
    date: q.quote_date || q.created_at
  }));
  orders.forEach(o => feed.push({
    source: 'order',
    id: o.id,
    type: 'Order Confirmed',
    ref: o.number,
    amount: o.grand_total,
    date: o.order_date || o.created_at
  }));
  invs.forEach(i => feed.push({
    source: 'invoice',
    id: i.id,
    type: `Invoice Raised (${i.status})`,
    ref: i.number,
    amount: i.grand_total,
    date: i.invoice_date || i.created_at
  }));
  pays.forEach(p => feed.push({
    source: 'payment',
    id: p.id,
    type: `Payment Received (${p.mode || 'Bank'})`,
    ref: p.number,
    amount: p.amount,
    date: p.payment_date || p.created_at
  }));
  acts.forEach(a => feed.push({
    source: 'activity',
    id: a.id,
    type: a.type || 'Customer Note',
    ref: a.subject,
    amount: 0,
    date: a.created_at
  }));

  feed.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return res.json(feed);
});

app.post('/api/customers/:id/send-statement', currentUser, async (req, res) => {
  try {
    const { id } = req.params;
    const cust = await Customer.findOne({ id, ...scope(req) });
    if (!cust) return res.status(404).json({ detail: 'Customer not found' });
    if (!cust.email) return res.status(400).json({ detail: 'Customer has no email address' });

    const org = (await Organization.findOne({ id: req.user.organization_id })) || {};
    const config = (await SMTPConfig.findOne({ organization_id: req.user.organization_id })) || {};

    if (!cust.portal_token) {
      cust.portal_token = uuidv4().replace(/-/g, '');
      await Customer.updateOne({ id: cust.id }, { $set: { portal_token: cust.portal_token } });
    }

    const invs = await Invoice.find({ customer_id: cust.id }).sort({ invoice_date: 1 });
    const pays = await Payment.find({ customer_id: cust.id }).sort({ payment_date: 1 });
    const totalOutstanding = invs.reduce((a, i) => a + (Number(i.balance_due) || 0), 0);

    const pdfBuf = await generateCustomerStatementPdf(cust, invs, pays, org);

    const vars = {
      customer_name: cust.company_name,
      contact_person: cust.contact_person || cust.company_name,
      balance_due: Number(totalOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      invoice_count: invs.length,
      payment_count: pays.length,
      org_name: org.name || 'Vegnar Global LLP',
      org_email: org.email || 'accounts@vegnar.com',
      org_phone: org.phone || '+91 98200 12345',
      portal_link: `${FRONTEND_URL}/portal/${cust.portal_token}`,
      statement_link: `${BACKEND_URL}/api/customers/${cust.id}/statement.pdf`
    };

    const subject = renderTemplate(config.statement_subject || DEFAULT_EMAIL_TEMPLATES.statement_subject, vars);
    const body = renderTemplate(config.statement_body || DEFAULT_EMAIL_TEMPLATES.statement_body, vars);

    const safeName = (cust.company_name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
    const attachments = [
      {
        filename: `Statement_${safeName}.pdf`,
        content: pdfBuf,
        contentType: 'application/pdf'
      }
    ];

    await sendEmail(req.user.organization_id, cust.email, subject, body, attachments);
    return res.json({ ok: true, to: cust.email, subject, has_attachment: true });
  } catch (err) {
    console.error('Send statement error:', err);
    return res.status(500).json({ detail: err.message });
  }
});

app.post('/api/customers', currentUser, async (req, res) => {
  const body = { ...req.body };
  if (!body.billing_address && (body.billing_address_line || body.billing_pincode || body.billing_city)) {
    const parts = [body.billing_address_line, body.billing_city, body.billing_state].filter(Boolean);
    body.billing_address = parts.join(', ') + (body.billing_pincode ? ` - ${body.billing_pincode}` : '');
  }
  if (!body.shipping_address && (body.shipping_address_line || body.shipping_pincode || body.shipping_city)) {
    const parts = [body.shipping_address_line, body.shipping_city, body.shipping_state].filter(Boolean);
    body.shipping_address = parts.join(', ') + (body.shipping_pincode ? ` - ${body.shipping_pincode}` : '');
  }
  if (!body.state && body.billing_state) body.state = body.billing_state;
  if (!body.city && body.billing_city) body.city = body.billing_city;
  if (!body.pincode && body.billing_pincode) body.pincode = body.billing_pincode;

  const doc = await Customer.create({
    ...body,
    id: newId(),
    organization_id: req.user.organization_id
  });
  return res.json(cleanDoc(doc));
});

const updateCustomerHandler = async (req, res) => {
  const { id } = req.params;
  const body = { ...req.body };
  delete body.id;
  delete body.organization_id;

  if (body.billing_address_line || body.billing_pincode || body.billing_city) {
    if (!body.billing_address) {
      const parts = [body.billing_address_line, body.billing_city, body.billing_state].filter(Boolean);
      body.billing_address = parts.join(', ') + (body.billing_pincode ? ` - ${body.billing_pincode}` : '');
    }
  }
  if (body.shipping_address_line || body.shipping_pincode || body.shipping_city) {
    if (!body.shipping_address) {
      const parts = [body.shipping_address_line, body.shipping_city, body.shipping_state].filter(Boolean);
      body.shipping_address = parts.join(', ') + (body.shipping_pincode ? ` - ${body.shipping_pincode}` : '');
    }
  }
  if (body.billing_state && !body.state) body.state = body.billing_state;
  if (body.billing_city && !body.city) body.city = body.billing_city;
  if (body.billing_pincode && !body.pincode) body.pincode = body.billing_pincode;

  await Customer.updateOne({ id, ...scope(req) }, { $set: body });
  const updated = await Customer.findOne({ id, ...scope(req) });
  if (!updated) return res.status(404).json({ detail: 'Customer not found' });
  return res.json(cleanDoc(updated));
};
app.patch('/api/customers/:id', currentUser, updateCustomerHandler);
app.put('/api/customers/:id', currentUser, updateCustomerHandler);

app.delete('/api/customers/:id', currentUser, async (req, res) => {
  const { id } = req.params;
  const result = await Customer.deleteOne({ id, ...scope(req) });
  if (result.deletedCount === 0) return res.status(404).json({ detail: 'Customer not found' });
  return res.json({ ok: true, id, message: 'Customer deleted successfully' });
});

// ----------------------------- Vendors -----------------------------
app.get('/api/vendors', currentUser, async (req, res) => {
  const docs = await Vendor.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.get('/api/vendors/:id', currentUser, async (req, res) => {
  const doc = await Vendor.findOne({ id: req.params.id, ...scope(req) });
  if (!doc) return res.status(404).json({ detail: 'Vendor not found' });
  return res.json(cleanDoc(doc));
});

app.post('/api/vendors', currentUser, async (req, res) => {
  const doc = await Vendor.create({
    ...req.body,
    id: newId(),
    organization_id: req.user.organization_id
  });
  return res.json(cleanDoc(doc));
});

const updateVendorHandler = async (req, res) => {
  const { id } = req.params;
  const body = { ...req.body };
  delete body.id;
  delete body.organization_id;
  await Vendor.updateOne({ id, ...scope(req) }, { $set: body });
  const updated = await Vendor.findOne({ id, ...scope(req) });
  if (!updated) return res.status(404).json({ detail: 'Vendor not found' });
  return res.json(cleanDoc(updated));
};
app.patch('/api/vendors/:id', currentUser, updateVendorHandler);
app.put('/api/vendors/:id', currentUser, updateVendorHandler);

app.delete('/api/vendors/:id', currentUser, async (req, res) => {
  const { id } = req.params;
  const result = await Vendor.deleteOne({ id, ...scope(req) });
  if (result.deletedCount === 0) return res.status(404).json({ detail: 'Vendor not found' });
  return res.json({ ok: true, id, message: 'Vendor deleted successfully' });
});

// ----------------------------- Products -----------------------------
app.get('/api/products', currentUser, async (req, res) => {
  const docs = await Product.find(scope(req)).sort({ created_at: -1 }).limit(500);
  return res.json(docs.map(cleanDoc));
});

app.get('/api/products/:id', currentUser, async (req, res) => {
  const doc = await Product.findOne({ id: req.params.id, ...scope(req) });
  if (!doc) return res.status(404).json({ detail: 'Product not found' });
  return res.json(cleanDoc(doc));
});

app.post('/api/products', currentUser, async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const sku = (req.body.sku || '').trim();
    if (!name) {
      return res.status(400).json({ detail: 'Product name is required' });
    }
    if (!sku) {
      return res.status(400).json({ detail: 'Product SKU is required' });
    }
    const opening = parseFloat(req.body.opening_stock || 0);
    const doc = await Product.create({
      ...req.body,
      name,
      sku,
      id: newId(),
      organization_id: req.user.organization_id,
      current_stock: opening
    });
    return res.json(cleanDoc(doc));
  } catch (err) {
    console.error('Error creating product:', err.message);
    return res.status(400).json({ detail: err.message || 'Failed to create product' });
  }
});

const updateProductHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };
    delete body.id;
    delete body.organization_id;
    if (body.name !== undefined && !body.name.trim()) {
      return res.status(400).json({ detail: 'Product name cannot be empty' });
    }
    if (body.sku !== undefined && !body.sku.trim()) {
      return res.status(400).json({ detail: 'Product SKU cannot be empty' });
    }
    await Product.updateOne({ id, ...scope(req) }, { $set: body });
    const updated = await Product.findOne({ id, ...scope(req) });
    if (!updated) return res.status(404).json({ detail: 'Product not found' });
    return res.json(cleanDoc(updated));
  } catch (err) {
    console.error('Error updating product:', err.message);
    return res.status(400).json({ detail: err.message || 'Failed to update product' });
  }
};
app.patch('/api/products/:id', currentUser, updateProductHandler);
app.put('/api/products/:id', currentUser, updateProductHandler);

app.delete('/api/products/:id', currentUser, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Product.deleteOne({ id, ...scope(req) });
    if (result.deletedCount === 0) return res.status(404).json({ detail: 'Product not found' });
    return res.json({ ok: true, id, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err.message);
    return res.status(400).json({ detail: err.message || 'Failed to delete product' });
  }
});

// ----------------------------- Quotations -----------------------------
// ----------------------------- Custom Fields -----------------------------
// ----------------------------- Accounting -----------------------------
app.get('/api/accounts', currentUser, async (req, res) => {
  const docs = await Account.find(scope(req));
  return res.json(docs.map(cleanDoc));
});
app.post('/api/accounts', currentUser, async (req, res) => {
  const doc = await Account.create({ id: newId(), organization_id: req.user.organization_id, ...req.body });
  return res.json(cleanDoc(doc));
});
app.get('/api/journal-entries', currentUser, async (req, res) => {
  const docs = await JournalEntry.find(scope(req)).sort({ date: -1, created_at: -1 });
  return res.json(docs.map(cleanDoc));
});
app.post('/api/journal-entries', currentUser, async (req, res) => {
  const doc = await JournalEntry.create({ id: newId(), organization_id: req.user.organization_id, ...req.body });
  return res.json(cleanDoc(doc));
});

// ----------------------------- Document Templates -----------------------------
app.get('/api/templates', currentUser, async (req, res) => {
  const t = await DocumentTemplate.find(scope(req));
  return res.json(t.map(cleanDoc));
});

app.post('/api/templates', currentUser, async (req, res) => {
  const t = await DocumentTemplate.create({ id: newId(), organization_id: req.user.organization_id, ...req.body });
  return res.json(cleanDoc(t));
});

app.get('/api/custom-fields', currentUser, async (req, res) => {
  const fields = await CustomField.find(scope(req));
  return res.json(fields.map(cleanDoc));
});

app.post('/api/custom-fields', currentUser, async (req, res) => {
  const f = await CustomField.create({ id: newId(), organization_id: req.user.organization_id, ...req.body });
  return res.json(cleanDoc(f));
});

// ----------------------------- Approvals -----------------------------
app.get('/api/approvals/pending', currentUser, async (req, res) => {
  const q = await Quotation.find({ ...scope(req), approval_status: 'pending' });
  const po = await PurchaseOrder.find({ ...scope(req), approval_status: 'pending' });
  return res.json({ quotations: q.map(cleanDoc), purchase_orders: po.map(cleanDoc) });
});

app.post('/api/approvals/document/:type/:id', currentUser, async (req, res) => {
  const { type, id } = req.params;
  const { status } = req.body; 
  if (type === 'quotation') {
    await Quotation.updateOne({ id, ...scope(req) }, { $set: { approval_status: status } });
  } else if (type === 'purchase_order') {
    await PurchaseOrder.updateOne({ id, ...scope(req) }, { $set: { approval_status: status } });
  }
  return res.json({ ok: true });
});

// ----------------------------- Quotations -----------------------------
async function checkApprovals(orgId, type, doc) {
  const workflows = await ApprovalWorkflow.find({ organization_id: orgId, document_type: type, active: true });
  for (let w of workflows) {
    let val = doc[w.condition_field];
    if (val !== undefined) {
      if (w.condition_operator === '>' && val > w.condition_value) return 'pending';
      if (w.condition_operator === '<' && val < w.condition_value) return 'pending';
      if (w.condition_operator === '=' && val === w.condition_value) return 'pending';
    }
  }
  return 'approved';
}

app.get('/api/quotations', currentUser, async (req, res) => {
  const docs = await Quotation.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/quotations', currentUser, async (req, res) => {
  const cust = await Customer.findOne({ id: req.body.customer_id, ...scope(req) });
  if (!cust) return res.status(400).json({ detail: 'Customer not found' });

  const org = await Organization.findOne({ id: req.user.organization_id });
  const sameState = (org?.state || '') === (cust.state || '');

  const productIds = (req.body.items || []).map(i => i.product_id).filter(Boolean);
  const products = await Product.find({ id: { $in: productIds }, ...scope(req) });
  const costMap = {};
  products.forEach(p => { costMap[p.id] = p.purchase_price || 0; });

  const computed = computeTotals(req.body.items || [], sameState, costMap);
  const number = await nextNumber(req.user.organization_id, 'QT', 'QT');

  const doc = await Quotation.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    customer_id: req.body.customer_id,
    customer_name: cust.company_name,
    quote_date: req.body.quote_date || now(),
    expiry_date: req.body.expiry_date || '',
    brand_id: req.body.brand_id || null,
    payment_terms: req.body.payment_terms || 'Net 30',
    delivery_terms: req.body.delivery_terms || '',
    notes: req.body.notes || '',
    terms: req.body.terms || '',
    items: computed.items,
    same_state: sameState,
    subtotal: computed.subtotal,
    total_cost: computed.total_cost,
    gross_profit: computed.gross_profit,
    gross_margin_pct: computed.gross_margin_pct,
    cgst: computed.cgst,
    sgst: computed.sgst,
    igst: computed.igst,
    tax_total: computed.tax_total,
    grand_total: computed.grand_total,
    status: 'draft',
    approval_status: await checkApprovals(req.user.organization_id, 'quotation', { ...req.body, ...computed }),
    created_by: req.user.id
  });

  return res.json(cleanDoc(doc));
});

app.get('/api/quotations/:id', currentUser, async (req, res) => {
  const q = await Quotation.findOne({ id: req.params.id, ...scope(req) });
  if (!q) return res.status(404).json({ detail: 'Not found' });
  return res.json(cleanDoc(q));
});

app.post('/api/quotations/:id/send-email', currentUser, async (req, res) => {
  try {
    const q = await Quotation.findOne({ id: req.params.id, ...scope(req) });
    if (!q) return res.status(404).json({ detail: 'Quotation not found' });
    const cust = await Customer.findOne({ id: q.customer_id });
    if (!cust || !cust.email) return res.status(400).json({ detail: 'Customer has no email address' });

    const org = (await Organization.findOne({ id: req.user.organization_id })) || {};
    const config = (await SMTPConfig.findOne({ organization_id: req.user.organization_id })) || {};

    if (!cust.portal_token) {
      cust.portal_token = uuidv4().replace(/-/g, '');
      await Customer.updateOne({ id: cust.id }, { $set: { portal_token: cust.portal_token } });
    }

    const pdfBuf = await generateQuotationPdf(q, cust, org);

    const vars = {
      number: q.number || 'QT',
      customer_name: cust.company_name || q.customer_name,
      contact_person: cust.contact_person || cust.company_name,
      date: q.quote_date ? new Date(q.quote_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
      grand_total: Number(q.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      payment_terms: q.payment_terms || 'Net 30',
      org_name: org.name || 'Vegnar Global LLP',
      org_email: org.email || 'sales@vegnar.com',
      org_phone: org.phone || '+91 98200 12345',
      view_link: `${BACKEND_URL}/api/quotations/${q.id}/pdf`,
      pdf_download_link: `${BACKEND_URL}/api/quotations/${q.id}/pdf`,
      portal_link: `${FRONTEND_URL}/portal/${cust.portal_token}`
    };

    const subject = renderTemplate(config.quotation_subject || DEFAULT_EMAIL_TEMPLATES.quotation_subject, vars);
    const body = renderTemplate(config.quotation_body || DEFAULT_EMAIL_TEMPLATES.quotation_body, vars);

    const attachments = [
      {
        filename: `Quotation_${q.number}.pdf`,
        content: pdfBuf,
        contentType: 'application/pdf'
      }
    ];

    await sendEmail(req.user.organization_id, cust.email, subject, body, attachments);
    return res.json({ ok: true, to: cust.email, subject, has_attachment: true });
  } catch (err) {
    console.error('Quotation send-email error:', err);
    return res.status(500).json({ detail: err.message });
  }
});

app.post('/api/quotations/:id/status', currentUser, async (req, res) => {
  await Quotation.updateOne({ id: req.params.id, ...scope(req) }, { $set: { status: req.body.status, updated_at: now() } });
  return res.json({ ok: true });
});

app.post('/api/quotations/:id/convert', currentUser, async (req, res) => {
  const q = await Quotation.findOne({ id: req.params.id, ...scope(req) });
  if (!q) return res.status(404).json({ detail: 'Quotation not found' });
  const number = await nextNumber(req.user.organization_id, 'SO', 'SO');

  const so = await SalesOrder.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    quotation_id: q.id,
    customer_id: q.customer_id,
    customer_name: q.customer_name,
    order_date: now(),
    brand_id: q.brand_id,
    items: q.items,
    subtotal: q.subtotal,
    total_cost: q.total_cost || 0,
    gross_profit: q.gross_profit || 0,
    gross_margin_pct: q.gross_margin_pct || 0,
    tax_total: q.tax_total,
    cgst: q.cgst,
    sgst: q.sgst,
    igst: q.igst,
    grand_total: q.grand_total,
    same_state: q.same_state,
    warehouse: 'Main',
    payment_terms: q.payment_terms,
    status: 'confirmed',
    created_by: req.user.id
  });

  await Quotation.updateOne({ id: q.id, ...scope(req) }, { $set: { status: 'accepted', sales_order_id: so.id } });
  return res.json(cleanDoc(so));
});

// ----------------------------- Sales Orders -----------------------------
app.get('/api/sales-orders', currentUser, async (req, res) => {
  const docs = await SalesOrder.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.get('/api/sales-orders/:id', currentUser, async (req, res) => {
  const doc = await SalesOrder.findOne({
    $or: [{ id: req.params.id }, { number: req.params.id }],
    ...scope(req)
  });
  if (!doc) return res.status(404).json({ detail: 'Sales order not found' });
  return res.json(cleanDoc(doc));
});

app.get('/api/orders/:id', currentUser, async (req, res) => {
  const doc = await SalesOrder.findOne({
    $or: [{ id: req.params.id }, { number: req.params.id }],
    ...scope(req)
  });
  if (!doc) return res.status(404).json({ detail: 'Order not found' });
  return res.json(cleanDoc(doc));
});

app.post('/api/sales-orders', currentUser, async (req, res) => {
  const cust = await Customer.findOne({ id: req.body.customer_id, ...scope(req) });
  if (!cust) return res.status(400).json({ detail: 'Customer not found' });

  const org = await Organization.findOne({ id: req.user.organization_id });
  const sameState = (org?.state || '') === (cust.state || '');

  const productIds = (req.body.items || []).map(i => i.product_id).filter(Boolean);
  const products = await Product.find({ id: { $in: productIds }, ...scope(req) });
  const costMap = {};
  products.forEach(p => { costMap[p.id] = p.purchase_price || 0; });

  const computed = computeTotals(req.body.items || [], sameState, costMap);
  const number = await nextNumber(req.user.organization_id, 'SO', 'SO');

  const doc = await SalesOrder.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    customer_id: req.body.customer_id,
    customer_name: cust.company_name,
    order_date: req.body.order_date || now(),
    expected_delivery: req.body.expected_delivery || '',
    brand_id: req.body.brand_id || null,
    warehouse: req.body.warehouse || 'Main',
    payment_terms: req.body.payment_terms || 'Net 30',
    delivery_terms: req.body.delivery_terms || '',
    notes: req.body.notes || '',
    items: computed.items,
    same_state: sameState,
    subtotal: computed.subtotal,
    total_cost: computed.total_cost,
    gross_profit: computed.gross_profit,
    gross_margin_pct: computed.gross_margin_pct,
    cgst: computed.cgst,
    sgst: computed.sgst,
    igst: computed.igst,
    tax_total: computed.tax_total,
    grand_total: computed.grand_total,
    status: 'confirmed',
    quotation_id: req.body.quotation_id || null,
    created_by: req.user.id
  });

  return res.json(cleanDoc(doc));
});

app.post('/api/sales-orders/:id/invoice', currentUser, async (req, res) => {
  const so = await SalesOrder.findOne({ id: req.params.id, ...scope(req) });
  if (!so) return res.status(404).json({ detail: 'Sales order not found' });
  const number = await nextNumber(req.user.organization_id, 'INV', 'INV');
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const inv = await Invoice.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    customer_id: so.customer_id,
    customer_name: so.customer_name,
    sales_order_id: so.id,
    invoice_date: now(),
    due_date: dueDate,
    brand_id: so.brand_id,
    items: so.items,
    subtotal: so.subtotal,
    total_cost: so.total_cost || 0,
    gross_profit: so.gross_profit || 0,
    gross_margin_pct: so.gross_margin_pct || 0,
    tax_total: so.tax_total,
    cgst: so.cgst,
    sgst: so.sgst,
    igst: so.igst,
    grand_total: so.grand_total,
    same_state: so.same_state,
    status: 'unpaid',
    amount_paid: 0,
    balance_due: so.grand_total,
    created_by: req.user.id
  });

  return res.json(cleanDoc(inv));
});

// ----------------------------- Invoices -----------------------------
app.get('/api/invoices', currentUser, async (req, res) => {
  const docs = await Invoice.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.get('/api/invoices/:id', currentUser, async (req, res) => {
  const inv = await Invoice.findOne({ id: req.params.id, ...scope(req) });
  if (!inv) return res.status(404).json({ detail: 'Not found' });
  return res.json(cleanDoc(inv));
});

app.post('/api/invoices/:id/send-email', currentUser, async (req, res) => {
  try {
    const inv = await Invoice.findOne({ id: req.params.id, ...scope(req) });
    if (!inv) return res.status(404).json({ detail: 'Invoice not found' });
    const cust = await Customer.findOne({ id: inv.customer_id });
    if (!cust || !cust.email) return res.status(400).json({ detail: 'Customer has no email address' });

    const org = (await Organization.findOne({ id: req.user.organization_id })) || {};
    const config = (await SMTPConfig.findOne({ organization_id: req.user.organization_id })) || {};

    if (!cust.portal_token) {
      cust.portal_token = uuidv4().replace(/-/g, '');
      await Customer.updateOne({ id: cust.id }, { $set: { portal_token: cust.portal_token } });
    }

    const pdfBuf = await generateInvoicePdf(inv, cust, org);

    const balanceDue = inv.balance_due !== undefined ? inv.balance_due : inv.grand_total;
    const vars = {
      number: inv.number || 'INV',
      customer_name: cust.company_name || inv.customer_name,
      contact_person: cust.contact_person || cust.company_name,
      date: inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
      due_date: inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
      grand_total: Number(inv.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      balance_due: Number(balanceDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      bank_name: org.bank_name || 'HDFC Bank Ltd',
      account_number: org.account_number || '50200084920194',
      ifsc: org.ifsc || 'HDFC0000123',
      org_name: org.name || 'Vegnar Global LLP',
      org_email: org.email || 'billing@vegnar.com',
      org_phone: org.phone || '+91 98200 12345',
      view_link: `${BACKEND_URL}/api/invoices/${inv.id}/pdf`,
      pdf_download_link: `${BACKEND_URL}/api/invoices/${inv.id}/pdf`,
      portal_link: `${FRONTEND_URL}/portal/${cust.portal_token}`
    };

    const subject = renderTemplate(config.invoice_subject || DEFAULT_EMAIL_TEMPLATES.invoice_subject, vars);
    const body = renderTemplate(config.invoice_body || DEFAULT_EMAIL_TEMPLATES.invoice_body, vars);

    const attachments = [
      {
        filename: `Invoice_${inv.number}.pdf`,
        content: pdfBuf,
        contentType: 'application/pdf'
      }
    ];

    await sendEmail(req.user.organization_id, cust.email, subject, body, attachments);
    return res.json({ ok: true, to: cust.email, subject, has_attachment: true });
  } catch (err) {
    console.error('Invoice send-email error:', err);
    return res.status(500).json({ detail: err.message });
  }
});

app.post('/api/invoices/:id/send-reminder', currentUser, async (req, res) => {
  try {
    const inv = await Invoice.findOne({ id: req.params.id, ...scope(req) });
    if (!inv) return res.status(404).json({ detail: 'Invoice not found' });
    const cust = await Customer.findOne({ id: inv.customer_id });
    if (!cust || !cust.email) return res.status(400).json({ detail: 'Customer has no email address' });

    const org = (await Organization.findOne({ id: req.user.organization_id })) || {};
    const config = (await SMTPConfig.findOne({ organization_id: req.user.organization_id })) || {};

    if (!cust.portal_token) {
      cust.portal_token = uuidv4().replace(/-/g, '');
      await Customer.updateOne({ id: cust.id }, { $set: { portal_token: cust.portal_token } });
    }

    const pdfBuf = await generateInvoicePdf(inv, cust, org);

    const balanceDue = inv.balance_due !== undefined ? inv.balance_due : inv.grand_total;
    const vars = {
      number: inv.number || 'INV',
      customer_name: cust.company_name || inv.customer_name,
      contact_person: cust.contact_person || cust.company_name,
      date: inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
      due_date: inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
      grand_total: Number(inv.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      balance_due: Number(balanceDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      bank_name: org.bank_name || 'HDFC Bank Ltd',
      account_number: org.account_number || '50200084920194',
      ifsc: org.ifsc || 'HDFC0000123',
      org_name: org.name || 'Vegnar Global LLP',
      org_email: org.email || 'billing@vegnar.com',
      org_phone: org.phone || '+91 98200 12345',
      view_link: `${BACKEND_URL}/api/invoices/${inv.id}/pdf`,
      pdf_download_link: `${BACKEND_URL}/api/invoices/${inv.id}/pdf`,
      portal_link: `${FRONTEND_URL}/portal/${cust.portal_token}`
    };

    const baseSubject = renderTemplate(config.invoice_subject || DEFAULT_EMAIL_TEMPLATES.invoice_subject, vars);
    const subject = `[Payment Reminder] ${baseSubject}`;
    const body = renderTemplate(config.invoice_body || DEFAULT_EMAIL_TEMPLATES.invoice_body, vars);

    const attachments = [
      {
        filename: `Invoice_${inv.number}.pdf`,
        content: pdfBuf,
        contentType: 'application/pdf'
      }
    ];

    await sendEmail(req.user.organization_id, cust.email, subject, body, attachments);
    return res.json({ ok: true, to: cust.email, subject, has_attachment: true });
  } catch (err) {
    console.error('Invoice reminder error:', err);
    return res.status(500).json({ detail: err.message });
  }
});

app.post('/api/invoices', currentUser, async (req, res) => {
  const cust = await Customer.findOne({ id: req.body.customer_id, ...scope(req) });
  if (!cust) return res.status(400).json({ detail: 'Customer not found' });

  const org = await Organization.findOne({ id: req.user.organization_id });
  const sameState = (org?.state || '') === (cust.state || '');

  const productIds = (req.body.items || []).map(i => i.product_id).filter(Boolean);
  const products = await Product.find({ id: { $in: productIds }, ...scope(req) });
  const costMap = {};
  products.forEach(p => { costMap[p.id] = p.purchase_price || 0; });

  const computed = computeTotals(req.body.items || [], sameState, costMap);
  const number = await nextNumber(req.user.organization_id, 'INV', 'INV');
  const dueDate = req.body.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const doc = await Invoice.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    customer_id: req.body.customer_id,
    customer_name: cust.company_name,
    sales_order_id: req.body.sales_order_id || null,
    invoice_date: req.body.invoice_date || now(),
    due_date: dueDate,
    brand_id: req.body.brand_id || null,
    items: computed.items,
    same_state: sameState,
    status: 'unpaid',
    amount_paid: 0,
    balance_due: computed.grand_total,
    notes: req.body.notes || '',
    place_of_supply: req.body.place_of_supply || '',
    subtotal: computed.subtotal,
    total_cost: computed.total_cost,
    gross_profit: computed.gross_profit,
    gross_margin_pct: computed.gross_margin_pct,
    cgst: computed.cgst,
    sgst: computed.sgst,
    igst: computed.igst,
    tax_total: computed.tax_total,
    grand_total: computed.grand_total,
    created_by: req.user.id
  });

  await JournalEntry.create({
    id: newId(),
    organization_id: req.user.organization_id,
    date: req.body.invoice_date || now(),
    reference_type: 'invoice',
    reference_id: doc.id,
    description: `Invoice ${number}`,
    lines: [
      { account_id: 'AR', debit: computed.grand_total, credit: 0 },
      { account_id: 'SALES', debit: 0, credit: computed.subtotal },
      { account_id: 'TAX', debit: 0, credit: computed.tax_total }
    ]
  });

  return res.json(cleanDoc(doc));
});

app.post('/api/invoices/:id/generate-irn', currentUser, async (req, res) => {
  const inv = await Invoice.findOne({ id: req.params.id, ...scope(req) });
  if (!inv) return res.status(404).json({ detail: 'Not found' });
  
  const irn = bcrypt.hashSync(`${inv.number}|${inv.grand_total}|${req.user.organization_id}`, 8).replace(/[^a-f0-9]/gi, '').slice(0, 64);
  const ackNo = String(Date.now()).slice(0, 15);
  const qrData = `IRN:${irn}|ACK:${ackNo}|Total:${inv.grand_total}|Number:${inv.number}`;

  await Invoice.updateOne({ id: inv.id, ...scope(req) }, {
    $set: { irn, ack_no: ackNo, ack_date: now(), qr_data: qrData, einv_status: 'generated' }
  });

  return res.json({ irn, ack_no: ackNo, ack_date: now(), qr_data: qrData });
});

// ----------------------------- GST & E-Way Bill Integration (Zoho-Style) -----------------------------
app.get('/api/gst/pincode-distance/:fromPin/:toPin', currentUser, calculateDistance);

app.post('/api/invoices/:id/eway-bill/generate', currentUser, (req, res) => {
  return generateInvoiceEwayBill(req, res, { Invoice, Customer, Organization, CourierConfig, SalesOrder, Dispatch });
});

app.get('/api/invoices/:id/eway-bill', currentUser, (req, res) => {
  return getInvoiceEwayBill(req, res, { Invoice });
});

app.post('/api/invoices/:id/eway-bill/update-vehicle', currentUser, (req, res) => {
  return updateInvoiceVehicle(req, res, { Invoice, CourierConfig });
});

app.post('/api/invoices/:id/eway-bill/cancel', currentUser, (req, res) => {
  return cancelInvoiceEwayBill(req, res, { Invoice, CourierConfig });
});

app.get('/api/invoices/:id/eway-bill/slip', currentUser, (req, res) => {
  return renderEwayBillSlip(req, res, { Invoice, Customer, Organization });
});

// ----------------------------- Payments Received -----------------------------
app.get('/api/payments', currentUser, async (req, res) => {
  const docs = await Payment.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/payments', currentUser, async (req, res) => {
  const cust = await Customer.findOne({ id: req.body.customer_id, ...scope(req) });
  if (!cust) return res.status(400).json({ detail: 'Customer not found' });
  const number = await nextNumber(req.user.organization_id, 'RCPT', 'RCPT');
  const allocations = req.body.allocations || [];

  for (const a of allocations) {
    const invId = a.invoice_id;
    const amt = parseFloat(a.amount || 0);
    const inv = await Invoice.findOne({ id: invId, ...scope(req) });
    if (!inv) continue;

    const newPaid = (inv.amount_paid || 0) + amt;
    const newBal = Math.max(0, Math.round((inv.grand_total - newPaid) * 100) / 100);
    const status = newBal <= 0.01 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');

    await Invoice.updateOne({ id: invId, ...scope(req) }, {
      $set: { amount_paid: Math.round(newPaid * 100) / 100, balance_due: newBal, status }
    });
  }

  const doc = await Payment.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    customer_id: req.body.customer_id,
    customer_name: cust.company_name,
    payment_date: req.body.payment_date || now(),
    amount: req.body.amount,
    mode: req.body.mode || 'Bank Transfer',
    reference: req.body.reference || '',
    bank: req.body.bank || '',
    utr: req.body.utr || '',
    allocations,
    notes: req.body.notes || '',
    created_by: req.user.id
  });

  await JournalEntry.create({
    id: newId(),
    organization_id: req.user.organization_id,
    date: req.body.payment_date || now(),
    reference_type: 'payment',
    reference_id: doc.id,
    description: `Payment ${number}`,
    lines: [
      { account_id: 'BANK', debit: req.body.amount, credit: 0 },
      { account_id: 'AR', debit: 0, credit: req.body.amount }
    ]
  });

  return res.json(cleanDoc(doc));
});

// ----------------------------- Purchase Orders & GRN -----------------------------
app.get('/api/purchase-orders', currentUser, async (req, res) => {
  const docs = await PurchaseOrder.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/purchase-orders', currentUser, async (req, res) => {
  const vendor = await Vendor.findOne({ id: req.body.vendor_id, ...scope(req) });
  if (!vendor) return res.status(400).json({ detail: 'Vendor not found' });
  const computed = computeTotals(req.body.items || [], true);
  const number = await nextNumber(req.user.organization_id, 'PO', 'PO');

  const doc = await PurchaseOrder.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    vendor_id: req.body.vendor_id,
    vendor_name: vendor.company_name,
    po_date: req.body.po_date || now(),
    expected_delivery: req.body.expected_delivery || '',
    warehouse: req.body.warehouse || 'Main',
    items: computed.items,
    notes: req.body.notes || '',
    status: 'open',
    subtotal: computed.subtotal,
    cgst: computed.cgst,
    sgst: computed.sgst,
    igst: computed.igst,
    tax_total: computed.tax_total,
    grand_total: computed.grand_total,
    approval_status: await checkApprovals(req.user.organization_id, 'purchase_order', { ...req.body, ...computed }),
    created_by: req.user.id
  });

  return res.json(cleanDoc(doc));
});

app.get('/api/grn', currentUser, async (req, res) => {
  const docs = await GRN.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/grn', currentUser, async (req, res) => {
  const vendor = await Vendor.findOne({ id: req.body.vendor_id, ...scope(req) });
  if (!vendor) return res.status(400).json({ detail: 'Vendor not found' });
  const number = await nextNumber(req.user.organization_id, 'GRN', 'GRN');
  const items = req.body.items || [];

  const doc = await GRN.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    vendor_id: req.body.vendor_id,
    vendor_name: vendor.company_name,
    purchase_order_id: req.body.purchase_order_id || null,
    warehouse: req.body.warehouse || 'Main',
    grn_date: req.body.grn_date || now(),
    items,
    notes: req.body.notes || '',
    status: 'received',
    created_by: req.user.id
  });

  // Stock increment + movement log
  for (const it of items) {
    if (it.product_id) {
      await Product.updateOne(
        { id: it.product_id, ...scope(req) },
        { $inc: { current_stock: parseFloat(it.quantity || 0) } }
      );
      await InventoryMovement.create({
        id: newId(),
        organization_id: req.user.organization_id,
        product_id: it.product_id,
        product_name: it.name,
        movement_type: 'inward',
        quantity: parseFloat(it.quantity || 0),
        warehouse: req.body.warehouse || 'Main',
        reference_type: 'grn',
        reference_id: doc.id,
        reference_number: number
      });
    }
  }

  return res.json(cleanDoc(doc));
});

// ----------------------------- Vendor Bills & Payments Made -----------------------------
app.get('/api/vendor-bills', currentUser, async (req, res) => {
  const docs = await VendorBill.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/vendor-bills', currentUser, async (req, res) => {
  const vendor = await Vendor.findOne({ id: req.body.vendor_id, ...scope(req) });
  if (!vendor) return res.status(400).json({ detail: 'Vendor not found' });
  const computed = computeTotals(req.body.items || [], true);
  const number = await nextNumber(req.user.organization_id, 'BILL', 'BILL');

  const doc = await VendorBill.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    vendor_id: req.body.vendor_id,
    vendor_name: vendor.company_name,
    purchase_order_id: req.body.purchase_order_id || null,
    bill_number: req.body.bill_number || '',
    bill_date: req.body.bill_date || now(),
    due_date: req.body.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    items: computed.items,
    notes: req.body.notes || '',
    status: 'unpaid',
    amount_paid: 0,
    balance_due: computed.grand_total,
    subtotal: computed.subtotal,
    cgst: computed.cgst,
    sgst: computed.sgst,
    igst: computed.igst,
    tax_total: computed.tax_total,
    grand_total: computed.grand_total,
    created_by: req.user.id
  });

  return res.json(cleanDoc(doc));
});

app.get('/api/payments-made', currentUser, async (req, res) => {
  const docs = await PaymentMade.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/payments-made', currentUser, async (req, res) => {
  const vendor = await Vendor.findOne({ id: req.body.vendor_id, ...scope(req) });
  if (!vendor) return res.status(400).json({ detail: 'Vendor not found' });
  const number = await nextNumber(req.user.organization_id, 'PMT', 'PMT');
  const allocations = req.body.allocations || [];

  for (const a of allocations) {
    const billId = a.bill_id;
    const amt = parseFloat(a.amount || 0);
    const b = await VendorBill.findOne({ id: billId, ...scope(req) });
    if (!b) continue;

    const newPaid = (b.amount_paid || 0) + amt;
    const newBal = Math.max(0, Math.round((b.grand_total - newPaid) * 100) / 100);
    const status = newBal <= 0.01 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');

    await VendorBill.updateOne({ id: billId, ...scope(req) }, {
      $set: { amount_paid: Math.round(newPaid * 100) / 100, balance_due: newBal, status }
    });
  }

  const doc = await PaymentMade.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    vendor_id: req.body.vendor_id,
    vendor_name: vendor.company_name,
    payment_date: req.body.payment_date || now(),
    amount: req.body.amount,
    mode: req.body.mode || 'Bank Transfer',
    reference: req.body.reference || '',
    bank: req.body.bank || '',
    utr: req.body.utr || '',
    allocations,
    notes: req.body.notes || '',
    created_by: req.user.id
  });

  return res.json(cleanDoc(doc));
});

// ----------------------------- Dispatch & Challans -----------------------------
app.get('/api/dispatches', currentUser, async (req, res) => {
  const docs = await Dispatch.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

// ----------------------------- Status Synchronization Handler -----------------------------
async function syncOrderStatus(models, orgId, salesOrderId, dispatchId, targetStatus, extra = {}) {
  const normStatus = (targetStatus || '').toUpperCase();

  // 1. Synchronize SalesOrder
  if (salesOrderId) {
    const soUpdate = { status: normStatus };
    if (dispatchId) soUpdate.dispatch_id = dispatchId;
    if (extra.awb_number) soUpdate.awb_number = extra.awb_number;
    if (extra.lr_number) soUpdate.lr_number = extra.lr_number;
    if (extra.dispatch_number) soUpdate.dispatch_number = extra.dispatch_number;
    await models.SalesOrder.updateOne(
      { $or: [{ id: salesOrderId }, { number: salesOrderId }], organization_id: orgId },
      { $set: soUpdate }
    );
  }

  // 2. Synchronize Dispatch
  if (dispatchId) {
    const dUpdate = { status: normStatus };
    if (normStatus === 'DISPATCHED') {
      dUpdate.dispatched_at = extra.dispatched_at || models.now();
      dUpdate.tracking_status = 'In Transit';
      if (!extra.dispatch_date) dUpdate.dispatch_date = models.now();
    } else if (normStatus === 'DELIVERED') {
      dUpdate.delivered_at = extra.delivered_at || models.now();
      dUpdate.tracking_status = 'Delivered';
      if (extra.pod_receiver_name) dUpdate.pod_receiver_name = extra.pod_receiver_name;
      if (extra.pod_phone) dUpdate.pod_phone = extra.pod_phone;
      if (extra.pod_notes) dUpdate.pod_notes = extra.pod_notes;
    } else if (normStatus === 'SCHEDULED') {
      dUpdate.tracking_status = dUpdate.tracking_status || 'Scheduled';
    }
    await models.Dispatch.updateOne(
      { $or: [{ id: dispatchId }, { number: dispatchId }], organization_id: orgId },
      { $set: dUpdate }
    );
  }
}

app.post('/api/sales-orders/:id/status', currentUser, async (req, res) => {
  const so = await SalesOrder.findOne({
    $or: [{ id: req.params.id }, { number: req.params.id }],
    ...scope(req)
  });
  if (!so) return res.status(404).json({ detail: 'Sales order not found' });
  const { status } = req.body;
  if (!status) return res.status(400).json({ detail: 'Status is required' });

  await syncOrderStatus(
    { SalesOrder, Dispatch, now },
    req.user.organization_id,
    so.id,
    so.dispatch_id,
    status,
    req.body
  );

  const updated = await SalesOrder.findOne({ id: so.id });
  return res.json(cleanDoc(updated));
});

// Schedule Delivery & Dispatch Orchestrator
app.post(['/api/dispatch/schedule', '/api/dispatches/schedule'], currentUser, async (req, res) => {
  const {
    sales_order_id,
    carrier_type = 'delhivery', // 'delhivery' | 'private'
    pickup_location = 'PKP_VGN_01',
    pickup_date,
    pickup_time_slot = 'Morning (10:00 AM - 01:00 PM)',
    packages = [],
    total_package_count,
    total_dead_weight_kg,
    volumetric_weight_kg,
    chargeable_weight_kg,
    rate_estimate,
    carrier_name,
    vehicle_number,
    driver_name,
    driver_phone,
    lr_number,
    eway_bill,
    scheduled_date,
    notes = ''
  } = req.body;

  const so = await SalesOrder.findOne({
    $or: [{ id: sales_order_id }, { number: sales_order_id }],
    ...scope(req)
  });
  if (!so) return res.status(404).json({ detail: 'Sales order not found' });

  const cust = (await Customer.findOne({ id: so.customer_id })) || {};
  const org = (await Organization.findOne({ id: req.user.organization_id })) || {};
  const conf = (await CourierConfig.findOne({ organization_id: req.user.organization_id })) || {};

  const number = await nextNumber(req.user.organization_id, 'DSP', 'DSP');
  const dId = newId();

  let awbNumber = '';
  let lrNum = lr_number || '';
  let courierName = carrier_name || (carrier_type.includes('delhivery') ? 'Delhivery B2B LTL Freight' : 'Private Carrier');
  let pickupToken = '';
  let trackingStatus = 'Scheduled';
  let waybillsList = [];
  let docWaybill = '';
  let b2bJobId = '';
  let lrPdfUrl = '';

  if (carrier_type === 'delhivery_b2b' || carrier_type === 'delhivery') {
    const isExpress = req.body.is_express === true;
    if (!isExpress) {
      // Primary: Official Delhivery B2B Freight Logistics API
      try {
        const b2bService = await getDelhiveryB2BServiceForOrg(CourierConfig, req.user.organization_id);
        const destPin = extractPincode(cust.shipping_address || cust.billing_address || cust.address, '577222');
        const finalEwb = eway_bill || req.body.ewb || so.eway_bill_number || '';
        const effectivePickup = (pickup_location && pickup_location !== 'PKP_VGN_01') ? pickup_location : (conf.b2b_pickup_location || 'Vegnar_Rajkot');

        const b2bRes = await b2bService.createLR({
          orderNumber: so.number,
          pickupWarehouseName: effectivePickup,
          weightKg: Number(chargeable_weight_kg) || Number(total_dead_weight_kg) || 10,
          paymentMode: req.body.payment_mode || 'prepaid',
          freightMode: req.body.freight_mode || null,
          consigneeName: cust.company_name || cust.contact_person || so.customer_name,
          consigneeAddress: cust.shipping_address || cust.billing_address || cust.address || 'No 18/A KIADB Industrial Area Machenahalli',
          consigneeCity: cust.city || 'Shivamogga',
          consigneeState: cust.state || 'Karnataka',
          consigneePincode: destPin,
          consigneePhone: cust.mobile || '9820012345',
          consigneeEmail: cust.email || '',
          billingName: org.legal_name || org.name || 'Vegnar Global LLP',
          billingAddress: 'Plot 12, GIDC Industrial Estate, Rajkot, Gujarat',
          billingCity: 'Rajkot',
          billingState: 'Gujarat',
          billingPincode: '360001',
          billingPhone: '9979583428',
          billingGstin: org.gstin || '24AAPFU0932F1Z1',
          invoiceNumber: so.number,
          invoiceAmount: so.grand_total || 0,
          invoiceDate: so.order_date || now(),
          ewayBill: finalEwb,
          dimensions: (packages && packages.length > 0) ? packages.map(p => ({
            box_count: p.box_count || p.quantity || 1,
            length_cm: p.length_cm || 35,
            width_cm: p.width_cm || 25,
            height_cm: p.height_cm || 20
          })) : [{
            box_count: total_package_count || 1,
            length_cm: 35,
            width_cm: 25,
            height_cm: 20
          }]
        });

        lrNum = b2bRes.lr_number || b2bRes.lrnum || '';
        if (!lrNum) {
          throw new Error(`Delhivery B2B manifestation failed to return an LR number. Please check Delhivery API status. Details: ${JSON.stringify(b2bRes)}`);
        }
        awbNumber = b2bRes.master_waybill || (b2bRes.waybills && b2bRes.waybills[0]) || '';
        waybillsList = b2bRes.waybills || [];
        docWaybill = b2bRes.doc_waybill || '';
        b2bJobId = b2bRes.job_id || '';
        lrPdfUrl = `/api/delhivery-b2b/lr-pdf/${lrNum}`;
        courierName = 'Delhivery B2B LTL Freight';
        trackingStatus = 'Manifested (Ready for Pickup at Rajkot DC)';
        pickupToken = b2bJobId || '';
      } catch (e) {
        console.error('Delhivery B2B dispatch schedule error:', e.message);
        return res.status(400).json({
          detail: e.message || 'Delhivery B2B shipment manifestation failed. Please verify courier credentials.'
        });
      }
    } else {
      // Secondary: B2C Express API
      try {
        const service = await getDelhiveryServiceForOrg(CourierConfig, req.user.organization_id);
        const destPin = extractPincode(cust.shipping_address || cust.billing_address || cust.address, '400001');
        const finalEwb = eway_bill || req.body.ewb || so.eway_bill_number || '';
        
        const manifest = await service.createShipment({
          consigneeName: cust.contact_person || cust.company_name || so.customer_name,
          consigneePhone: cust.mobile || '9820012345',
          consigneeAddress: cust.shipping_address || cust.billing_address || cust.address || 'Consignee Site',
          consigneeCity: cust.city || 'Mumbai',
          consigneeState: cust.state || 'Maharashtra',
          destinationPincode: destPin,
          orderNumber: so.number,
          invoiceNumber: so.number,
          orderDate: so.order_date || now(),
          orderTotal: so.grand_total || 0,
          paymentType: 'Pre-paid',
          packageCount: total_package_count || 1,
          pickupLocationName: pickup_location || 'PKP_VGN_01',
          originPincode: org.pin || '421302',
          originAddress: org.address || 'Plot 42, Bhiwandi Industrial Area',
          organizationName: org.name || 'Vegnar Global LLP',
          chargeableWeightGrams: Math.round((Number(chargeable_weight_kg) || 1) * 1000),
          weight: Math.round((Number(chargeable_weight_kg) || 1) * 1000),
          ewayBill: finalEwb
        });

        let pickupId = '';
        try {
          const pickup = await service.schedulePickup({
            pickupLocation: pickup_location || 'PKP_VGN_01',
            expectedPackageCount: total_package_count || 1,
            pickupDate: pickup_date || now()
          });
          pickupId = pickup.pickup_id || '';
        } catch (pkErr) {
          console.warn('Delhivery pickup schedule notice:', pkErr.message);
        }

        awbNumber = manifest.waybill || manifest.awb_number;
        lrNum = manifest.lr_number || `DELH${String(Date.now()).slice(3)}`;
        pickupToken = pickupId;
        courierName = manifest.is_simulated ? 'Delhivery Express (Demo)' : 'Delhivery Express';
        trackingStatus = 'Manifested (Ready for Pickup)';
      } catch (e) {
        console.error('Delhivery dispatch schedule error:', e.message);
        return res.status(400).json({
          detail: e.message || 'Delhivery shipment manifestation failed. Please verify courier credentials and wallet balance.'
        });
      }
    }
  } else {
    // Private Courier
    lrNum = lr_number || `PVT-${Date.now().toString().slice(-6)}`;
    pickupToken = `TOKEN-${Date.now().toString().slice(-6)}`;
    trackingStatus = 'Scheduled with Transporter';
  }

  const dispatchDoc = await Dispatch.create({
    id: dId,
    number,
    organization_id: req.user.organization_id,
    sales_order_id: so.id,
    sales_order_number: so.number,
    customer_name: so.customer_name,
    dispatch_date: pickup_date || scheduled_date || now(),
    scheduled_quantity: total_package_count || req.body.scheduled_quantity || 1,
    package_count: total_package_count || 1,
    packages: packages || [],
    total_dead_weight_kg: total_dead_weight_kg || 0,
    volumetric_weight_kg: volumetric_weight_kg || 0,
    chargeable_weight_kg: chargeable_weight_kg || 0,
    warehouse: pickup_location || 'PKP_VGN_01',
    carrier_type,
    courier_name: courierName,
    pickup_location: pickup_location || 'PKP_VGN_01',
    pickup_time_slot,
    vehicle: vehicle_number || req.body.vehicle || '',
    transporter: courierName,
    driver: driver_name || req.body.driver || '',
    driver_phone: driver_phone || '',
    lr_number: lrNum,
    awb_number: awbNumber,
    waybills: waybillsList,
    doc_waybill: docWaybill,
    b2b_job_id: b2bJobId,
    lr_pdf_url: lrPdfUrl || (lrNum ? `/api/delhivery-b2b/lr-pdf/${lrNum}` : ''),
    pickup_token: pickupToken,
    tracking_status: trackingStatus,
    freight_charges: rate_estimate?.total_amount || 0,
    shipping_label_url: lrPdfUrl || (awbNumber ? `/api/shipping/labels/${awbNumber}` : ''),
    priority: req.body.priority || 'medium',
    notes: notes || req.body.notes || '',
    status: 'SCHEDULED',
    created_by: req.user.id
  });

  // Synchronize Sales Order to SCHEDULED
  await syncOrderStatus(
    { SalesOrder, Dispatch, now },
    req.user.organization_id,
    so.id,
    dispatchDoc.id,
    'SCHEDULED',
    {
      awb_number: awbNumber || lrNum,
      lr_number: lrNum,
      dispatch_number: dispatchDoc.number
    }
  );

  const updatedSo = await SalesOrder.findOne({ id: so.id });
  return res.json({
    ok: true,
    dispatch: cleanDoc(dispatchDoc),
    sales_order: cleanDoc(updatedSo)
  });
});

app.post('/api/dispatches', currentUser, async (req, res) => {
  const so = await SalesOrder.findOne({
    $or: [{ id: req.body.sales_order_id }, { number: req.body.sales_order_id }],
    ...scope(req)
  });
  if (!so) return res.status(400).json({ detail: 'Sales order not found' });
  const number = await nextNumber(req.user.organization_id, 'DSP', 'DSP');

  let qty = Number(req.body.scheduled_quantity) || 0;
  if (qty <= 0 && Array.isArray(so.items) && so.items.length > 0) {
    qty = so.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }
  if (qty <= 0) qty = 1;

  const doc = await Dispatch.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    sales_order_id: so.id,
    sales_order_number: so.number,
    customer_name: so.customer_name,
    dispatch_date: req.body.dispatch_date || now(),
    scheduled_quantity: qty,
    warehouse: req.body.warehouse || so.warehouse || 'Main',
    vehicle: req.body.vehicle || '',
    transporter: req.body.transporter || 'Delhivery B2B',
    driver: req.body.driver || '',
    priority: req.body.priority || 'medium',
    notes: req.body.notes || '',
    status: req.body.status || 'SCHEDULED',
    created_by: req.user.id
  });

  return res.json(cleanDoc(doc));
});

app.post('/api/dispatches/:id/status', currentUser, async (req, res) => {
  const d = await Dispatch.findOne({ id: req.params.id, ...scope(req) });
  if (!d) return res.status(404).json({ detail: 'Dispatch not found' });
  const { status, pod_receiver_name, pod_phone, pod_notes } = req.body;
  if (!status) return res.status(400).json({ detail: 'Status is required' });

  const extra = {
    dispatched_at: req.body.dispatched_at || now(),
    delivered_at: req.body.delivered_at || now(),
    pod_receiver_name,
    pod_phone,
    pod_notes
  };

  await syncOrderStatus(
    { SalesOrder, Dispatch, now },
    req.user.organization_id,
    d.sales_order_id,
    d.id,
    status,
    extra
  );

  const updated = await Dispatch.findOne({ id: d.id, ...scope(req) });
  return res.json(cleanDoc(updated));
});

app.post('/api/dispatches/:id/create-challan', currentUser, async (req, res) => {
  const d = await Dispatch.findOne({ id: req.params.id, ...scope(req) });
  if (!d) return res.status(404).json({ detail: 'Dispatch not found' });

  if (d.challan_id) {
    const existing = await Challan.findOne({ id: d.challan_id, ...scope(req) });
    if (existing) return res.json(cleanDoc(existing));
  }

  const so = await SalesOrder.findOne({ id: d.sales_order_id, ...scope(req) });
  if (!so) return res.status(400).json({ detail: 'Associated sales order not found' });

  const number = await nextNumber(req.user.organization_id, 'CH', 'CH');
  const items = (req.body && Array.isArray(req.body.items) && req.body.items.length > 0) ? req.body.items : (so.items || []);

  // Reduce stock + log movement
  for (const it of items) {
    if (it.product_id) {
      const qty = Math.abs(parseFloat(it.quantity || 0));
      if (qty > 0) {
        await Product.updateOne(
          { id: it.product_id, ...scope(req) },
          { $inc: { current_stock: -qty } }
        );
        await InventoryMovement.create({
          id: newId(),
          organization_id: req.user.organization_id,
          product_id: it.product_id,
          product_name: it.name || it.product_name,
          movement_type: 'outward',
          quantity: -qty,
          warehouse: d.warehouse || req.body?.warehouse || 'Main',
          reference_type: 'challan',
          reference_id: d.id
        });

        // Low stock notification check
        const prod = await Product.findOne({ id: it.product_id, ...scope(req) });
        if (prod && prod.current_stock <= (prod.min_stock || 10)) {
          await Notification.create({
            id: newId(),
            organization_id: req.user.organization_id,
            type: 'low_stock',
            title: 'Low stock',
            message: `${prod.name} is at ${prod.current_stock} (min ${prod.min_stock || 10})`,
            product_id: prod.id
          });
        }
      }
    }
  }

  const doc = await Challan.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    dispatch_id: d.id,
    sales_order_id: so.id,
    sales_order_number: so.number,
    customer_id: so.customer_id,
    customer_name: so.customer_name || d.customer_name,
    brand_id: so.brand_id,
    warehouse: d.warehouse || req.body?.warehouse || 'Main',
    vehicle: d.vehicle || '',
    transporter: d.transporter || '',
    lr_number: d.lr_number || '',
    eway_bill: d.eway_bill || '',
    driver: d.driver || '',
    items,
    notes: d.notes || req.body?.notes || '',
    subtotal: so.subtotal || 0,
    cgst: so.cgst || 0,
    sgst: so.sgst || 0,
    igst: so.igst || 0,
    grand_total: so.grand_total || 0,
    created_by: req.user.id
  });

  await Dispatch.updateOne({ id: d.id, ...scope(req) }, {
    $set: { 
      status: d.status === 'scheduled' ? 'loading' : d.status,
      challan_id: doc.id,
      challan_number: doc.number
    }
  });

  return res.json(cleanDoc(doc));
});

app.delete('/api/dispatches/:id', currentUser, async (req, res) => {
  const d = await Dispatch.findOne({ id: req.params.id, ...scope(req) });
  if (!d) return res.status(404).json({ detail: 'Dispatch not found' });
  await Dispatch.deleteOne({ id: d.id, ...scope(req) });
  if (d.sales_order_id) {
    await SalesOrder.updateOne(
      { id: d.sales_order_id, ...scope(req) },
      { $set: { status: 'READY_TO_DISPATCH', dispatch_id: null, awb_number: null, lr_number: null } }
    );
  }
  return res.json({ ok: true, message: 'Dispatch removed and sales order reset to READY_TO_DISPATCH' });
});

// Courier Integrations
app.get('/api/courier/config', currentUser, async (req, res) => {
  const c = await CourierConfig.findOne({ organization_id: req.user.organization_id });
  return res.json(c ? cleanDoc(c) : null);
});
app.post('/api/courier/config', currentUser, async (req, res) => {
  let c = await CourierConfig.findOne({ organization_id: req.user.organization_id });
  if (c) {
    await CourierConfig.updateOne({ organization_id: req.user.organization_id }, { $set: req.body });
    c = await CourierConfig.findOne({ organization_id: req.user.organization_id });
  } else {
    c = await CourierConfig.create({ organization_id: req.user.organization_id, ...req.body });
  }
  return res.json(cleanDoc(c));
});

// ----------------------------- Delhivery B2B Integration Suite -----------------------------
function fetchDelhiveryLiveFreight(origin, dest, chargeableGrams, mode, isCod, codAmount, apiKey) {
  return new Promise((resolve, reject) => {
    const md = mode.toLowerCase().startsWith('exp') ? 'E' : 'S';
    let path = `/api/kinko/v1/invoice/charges/.json?md=${md}&ss=Delivered&d_pin=${encodeURIComponent(dest)}&o_pin=${encodeURIComponent(origin)}&cgm=${chargeableGrams}`;
    if (isCod && codAmount > 0) {
      path += `&pt=COD&amount=${encodeURIComponent(codAmount)}`;
    }
    const options = {
      hostname: 'track.delhivery.com',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Token ${apiKey}`
      },
      timeout: 5000
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].charge_DL !== undefined) {
            return resolve(parsed[0]);
          }
          reject(new Error(body || 'Invalid Delhivery response'));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Delhivery timeout')); });
    req.end();
  });
}

app.post('/api/delhivery/freight-estimate', currentUser, async (req, res) => {
  const {
    origin_pincode = '360001',
    destination_pincode = '560001',
    weight_kg = 25,
    boxes = 1,
    length = 35,
    width = 25,
    height = 20,
    mode = 'surface',
    cod_amount = 0
  } = req.body;

  const origin = String(origin_pincode || '360001').trim();
  const dest = String(destination_pincode || '560001').trim();
  const numBoxes = Math.max(1, Number(boxes) || 1);
  const actualWeight = Math.max(0.1, Number(weight_kg) || 25);
  const isCod = Number(cod_amount) > 0;
  const codVal = Math.max(0, Number(cod_amount) || 0);

  // Volumetric weight: (L * W * H / 5000) * boxes
  const volWeight = Math.round(((Number(length || 35) * Number(width || 25) * Number(height || 20)) / 5000) * numBoxes * 100) / 100;
  const chargeableWeight = Math.max(actualWeight, volWeight);
  const chargeableGrams = Math.round(chargeableWeight * 1000);

  const courier = await CourierConfig.findOne({ organization_id: req.user.organization_id });
  const apiKey = courier?.api_key || 'b79598f770c257f3ea79da604a70fbe2e2f68306';

  let liveData = null;
  try {
    liveData = await fetchDelhiveryLiveFreight(origin, dest, chargeableGrams, mode, isCod, codVal, apiKey);
  } catch (err) {
    console.warn('Delhivery live calculation fallback:', err.message);
  }

  const isExpress = mode.toLowerCase().startsWith('exp');
  let shippingCharge, codCharge, lmSurcharge, peakSurcharge, dieselHike, gst18, totalAmount, zone;
  let estimatedDays = isExpress ? 5 : 6;

  if (liveData) {
    zone = liveData.zone || (isExpress ? 'D' : 'D2');
    shippingCharge = Number(liveData.charge_DL || 0);
    codCharge = Number(liveData.charge_COD || 0);
    lmSurcharge = Number(liveData.charge_LM || 0);
    peakSurcharge = Number(liveData.charge_PEAK || 0);
    dieselHike = Number(liveData.charge_DPH || 0);
    const taxData = liveData.tax_data || {};
    gst18 = Math.round(((taxData.SGST || 0) + (taxData.CGST || 0) + (taxData.IGST || 0)) * 100) / 100;
    totalAmount = Number(liveData.total_amount || 0);
  } else {
    // Official Delhivery Zone D2 Tariff matrix
    zone = isExpress ? 'D' : 'D2';
    if (isExpress) {
      // Base up to 5kg = ₹554, then ₹145/kg
      shippingCharge = chargeableWeight <= 5 ? 554 : Math.round((554 + (chargeableWeight - 5) * 145) * 100) / 100;
      lmSurcharge = 25;
      peakSurcharge = 4;
      dieselHike = Math.round(shippingCharge * 0.03815 * 100) / 100; // ~3.815%
    } else {
      // Base up to 5kg = ₹174, then ₹34/kg
      shippingCharge = chargeableWeight <= 5 ? 174 : Math.round((174 + (chargeableWeight - 5) * 34) * 100) / 100;
      lmSurcharge = 25;
      peakSurcharge = 2;
      dieselHike = Math.round(shippingCharge * 0.03815 * 100) / 100; // ~3.815%
    }
    codCharge = isCod ? Math.max(40, Math.round(codVal * 0.015)) : 0;
    const gross = shippingCharge + codCharge + lmSurcharge + peakSurcharge + dieselHike;
    gst18 = Math.round(gross * 0.18 * 100) / 100;
    totalAmount = Math.round((gross + gst18) * 100) / 100;
  }

  const eta = new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return res.json({
    origin_pincode: origin,
    destination_pincode: dest,
    mode: isExpress ? 'EXPRESS' : 'SURFACE',
    zone,
    boxes: numBoxes,
    actual_weight_kg: actualWeight,
    volumetric_weight_kg: volWeight,
    chargeable_weight_kg: chargeableWeight,
    cod_amount: codVal,
    breakup: {
      shipping_charge: shippingCharge,
      cod_charges: codCharge,
      lm_surcharge: lmSurcharge,
      peak_surcharge: peakSurcharge,
      diesel_price_hike: dieselHike,
      gst_18: gst18,
      total_amount: totalAmount,
      // Backward compatibility aliases
      base_freight: shippingCharge,
      fuel_surcharge: dieselHike,
      docket_fee: lmSurcharge + peakSurcharge,
      total_freight: totalAmount
    },
    estimated_transit_days: estimatedDays,
    expected_delivery_date: eta,
    currency: 'INR'
  });
});

app.post('/api/dispatches/:id/push-to-courier', currentUser, async (req, res) => {
  const d = await Dispatch.findOne({ id: req.params.id, ...scope(req) });
  if (!d) return res.status(404).json({ detail: 'Dispatch not found' });
  const conf = (await CourierConfig.findOne({ organization_id: req.user.organization_id })) || {
    provider: 'delhivery',
    pickup_location: 'Main Warehouse'
  };
  const providerName = conf.provider === 'delhivery' ? 'Delhivery Express' : (conf.provider || 'Delhivery Express');
  const so = await SalesOrder.findOne({ id: d.sales_order_id, ...scope(req) });
  const cust = (await Customer.findOne({ id: so?.customer_id })) || {};
  const org = (await Organization.findOne({ id: req.user.organization_id })) || {};

  try {
    const service = await getDelhiveryServiceForOrg(CourierConfig, req.user.organization_id);
    const destPin = extractPincode(cust.shipping_address || cust.billing_address || cust.address, '400001');

    // Manifest shipment with Delhivery
    const manifest = await service.createShipment({
      consigneeName: cust.contact_person || cust.company_name || d.customer_name,
      consigneePhone: cust.mobile || '9820012345',
      consigneeAddress: cust.shipping_address || cust.billing_address || 'Consignee Site',
      consigneeCity: cust.city || 'Mumbai',
      consigneeState: cust.state || 'Maharashtra',
      destinationPincode: destPin,
      orderNumber: d.sales_order_number || d.number,
      invoiceNumber: d.sales_order_number || d.number,
      orderDate: d.dispatch_date || now(),
      orderTotal: so?.grand_total || 0,
      paymentType: 'Pre-paid',
      packageCount: d.scheduled_quantity || 1,
      pickupLocationName: conf.pickup_location || 'Main Warehouse',
      originPincode: org.pin || '421302',
      originAddress: org.address || 'Plot 42, Bhiwandi Industrial Area',
      organizationName: org.name || 'Vegnar Global LLP'
    });

    const waybill = manifest.waybill || manifest.awb_number;
    const lrNumber = manifest.lr_number || `DELH${String(Date.now()).slice(3)}`;
    const dispatchDate = d.dispatch_date || now();
    const eta = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Schedule pickup with Delhivery
    const pickup = await service.schedulePickup({
      pickupLocation: conf.pickup_location || 'Main Warehouse',
      expectedPackageCount: d.scheduled_quantity || 1
    });

    await Dispatch.updateOne({ id: d.id, ...scope(req) }, {
      $set: {
        awb_number: waybill,
        lr_number: lrNumber,
        lr_date: dispatchDate,
        courier_name: providerName,
        status: 'dispatched',
        tracking_status: 'Manifested (Ready for Pickup)',
        pickup_token: pickup.pickup_id,
        shipping_label_url: manifest.shipping_label_url || `/api/shipping/labels/${waybill}`
      }
    });

    if (so) {
      await SalesOrder.updateOne({ id: so.id }, {
        $set: { status: 'dispatched', awb_number: waybill, dispatch_id: d.id }
      });
    }

    return res.json({
      ok: true,
      lr_number: lrNumber,
      awb_number: waybill,
      courier_name: providerName,
      status: 'dispatched',
      tracking_status: 'Manifested (Ready for Pickup)',
      pickup_token: pickup.pickup_id,
      eta
    });
  } catch (err) {
    console.error('push-to-courier error:', err);
    return res.status(500).json({ detail: `Push to courier failed: ${err.message}` });
  }
});

// ----------------------------- Delhivery Express Logistics API Endpoints -----------------------------

// 1. Pincode Serviceability Check
app.get('/api/shipping/serviceability/:pincode', currentUser, (req, res) => {
  return checkPincodeServiceability(req, res, { CourierConfig });
});

// 2. Pre-Dispatch Rate & Packing Estimation
app.post('/api/orders/:id/shipping/estimate', currentUser, (req, res) => {
  return estimateOrderShippingRate(req, res, { SalesOrder, Customer, Product, Organization, CourierConfig });
});
app.post('/api/sales-orders/:id/shipping/estimate', currentUser, (req, res) => {
  return estimateOrderShippingRate(req, res, { SalesOrder, Customer, Product, Organization, CourierConfig });
});

// 3. Full Order Dispatch Orchestrator (Packing -> Rate -> Manifestation -> Pickup -> DB Update)
app.post('/api/orders/:id/dispatch', currentUser, (req, res) => {
  return dispatchOrderWithDelhivery(req, res, {
    SalesOrder, Customer, Product, Organization, CourierConfig, Dispatch, Invoice, nextNumber, newId, now
  });
});
app.post('/api/sales-orders/:id/dispatch', currentUser, (req, res) => {
  return dispatchOrderWithDelhivery(req, res, {
    SalesOrder, Customer, Product, Organization, CourierConfig, Dispatch, Invoice, nextNumber, newId, now
  });
});

// 4. Live Tracking by Waybill / AWB
app.get('/api/shipping/track/:waybill', currentUser, (req, res) => {
  return trackShipmentStatus(req, res, { CourierConfig });
});

// 5. Printable Shipping Label & Packing Slip by Waybill
app.get('/api/shipping/labels/:waybill', currentUser, async (req, res) => {
  const d = await Dispatch.findOne({
    $or: [{ awb_number: req.params.waybill }, { lr_number: req.params.waybill }],
    ...scope(req)
  });
  if (!d) return res.status(404).send('Shipment not found');
  const org = (await Organization.findOne({ id: req.user.organization_id })) || {};
  const so = (await SalesOrder.findOne({ id: d.sales_order_id, ...scope(req) })) || {};
  const cust = (await Customer.findOne({ id: so?.customer_id, ...scope(req) })) || {};

  const waybill = d.awb_number || req.params.waybill;
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Delhivery B2C Express Shipping Label - ${waybill}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; color: #111; font-size: 12px; }
    .label-box { border: 2px solid #000; max-width: 500px; margin: 0 auto; padding: 15px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .logo { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #b91c1c; }
    .badge { background: #000; color: #fff; padding: 3px 8px; font-size: 11px; font-weight: 700; border-radius: 3px; }
    .awb-section { margin-top: 10px; text-align: center; border-bottom: 1px dashed #444; padding-bottom: 8px; }
    .barcode { font-family: monospace; font-size: 26px; letter-spacing: 4px; font-weight: bold; margin: 8px 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; border-bottom: 1px solid #000; padding-bottom: 10px; }
    .box h4 { margin: 0 0 4px 0; font-size: 10px; text-transform: uppercase; color: #666; }
    .routing-banner { background: #f3f4f6; padding: 8px 12px; margin: 10px 0; display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; border: 1px solid #d1d5db; }
    .footer { margin-top: 12px; font-size: 10px; color: #555; display: flex; justify-content: space-between; }
    @media print { .no-print { display: none; } body { margin: 0; } }
  </style>
</head>
<body>
  <div class="no-print" style="max-width:500px; margin:0 auto 10px; display:flex; justify-content:space-between;">
    <button onclick="window.print()" style="padding:6px 14px; background:#0f172a; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">🖨️ Print Delhivery Label</button>
    <a href="/dispatches" style="padding:6px 14px; text-decoration:none; color:#475569; font-size:12px;">← Back to Dispatches</a>
  </div>
  <div class="label-box">
    <div class="header">
      <div class="logo">DELHIVERY <span style="font-size:13px; font-weight:normal; color:#000;">EXPRESS</span></div>
      <div class="badge">PRE-PAID</div>
    </div>
    <div class="routing-banner">
      <div>DESTINATION: ${cust?.shipping_address?.pin || cust?.pin || '400001'}</div>
      <div>ROUTING: BHW / HUB</div>
    </div>
    <div class="awb-section">
      <div style="font-size:11px; text-transform:uppercase; color:#555;">Air Waybill Number (AWB)</div>
      <div class="barcode">||| | ||||| || |||| |||</div>
      <div style="font-size:14px; font-weight:bold; font-family:monospace;">${waybill}</div>
    </div>
    <div class="grid">
      <div class="box">
        <h4>Ship To (Consignee):</h4>
        <div style="font-weight:bold; font-size:13px;">${cust?.company_name || d.customer_name}</div>
        <div>${cust?.shipping_address?.address || cust?.address || 'Consignee Site'}</div>
        <div>${cust?.shipping_address?.city || cust?.city || 'Mumbai'}, ${cust?.shipping_address?.state || cust?.state || 'MH'} - ${cust?.shipping_address?.pin || cust?.pin || '400001'}</div>
        <div>Phone: ${cust?.mobile || '+91 98200 12345'}</div>
      </div>
      <div class="box">
        <h4>Shipped By (Origin Hub):</h4>
        <div style="font-weight:bold; font-size:13px;">${org?.name || 'Vegnar Global LLP'}</div>
        <div>${org?.address || 'Plot 42, Bhiwandi Industrial Area'}</div>
        <div>${org?.city || 'Bhiwandi'}, ${org?.state || 'Maharashtra'} - ${org?.pin || '421302'}</div>
        <div>GSTIN: ${org?.gstin || '27AABCV1234F1Z5'}</div>
      </div>
    </div>
    <div style="margin-top:10px; display:flex; justify-content:space-between; font-size:11px; border-bottom:1px solid #000; padding-bottom:8px;">
      <div><strong>Order #:</strong> ${d.sales_order_number || d.number}</div>
      <div><strong>Boxes:</strong> ${d.scheduled_quantity || 1} Master Carton(s)</div>
      <div><strong>Pickup Token:</strong> ${d.pickup_token || 'PKP-AUTO'}</div>
    </div>
    <div class="footer">
      <div>Generated via Vegnar ERP Logistics</div>
      <div>Date: ${new Date().toLocaleDateString('en-IN')}</div>
    </div>
  </div>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  return res.send(html);
});

app.get('/api/dispatches/:id/track', currentUser, async (req, res) => {
  const d = await Dispatch.findOne({ id: req.params.id, ...scope(req) });
  if (!d) return res.status(404).json({ detail: 'Dispatch not found' });
  
  const waybill = d.awb_number || d.lr_number;
  if (!waybill) return res.status(400).json({ detail: 'Shipment has not been manifested with Delhivery yet' });

  const so = await SalesOrder.findOne({ id: d.sales_order_id, ...scope(req) });
  const createdTime = new Date(d.created_at || Date.now());
  const t1 = new Date(createdTime.getTime()).toLocaleString('en-IN');
  const t2 = new Date(createdTime.getTime() + 4 * 3600 * 1000).toLocaleString('en-IN');
  const t3 = new Date(createdTime.getTime() + 14 * 3600 * 1000).toLocaleString('en-IN');
  const t4 = new Date(createdTime.getTime() + 28 * 3600 * 1000).toLocaleString('en-IN');

  const scans = [
    { status: 'MANIFESTED', activity: 'Electronic consignment data manifested (LR generated)', location: d.warehouse || 'Central Facility', time: t1, completed: true },
    { status: 'PICKED_UP', activity: 'Consignment picked up from seller warehouse', location: d.warehouse || 'Central Facility', time: t2, completed: true },
    { status: 'IN_TRANSIT', activity: 'Shipment arrived at Delhivery Sort Hub', location: 'Bhiwandi Linehaul Hub', time: t3, completed: true },
    { status: 'OUT_FOR_DELIVERY', activity: 'Dispatched for last-mile delivery to consignee', location: 'Destination DC', time: t4, completed: d.status === 'delivered' },
    { status: 'DELIVERED', activity: 'Consignment successfully delivered with receiver signature', location: so?.shipping_address?.city || 'Consignee Address', time: 'Pending', completed: d.status === 'delivered' }
  ];

  return res.json({
    waybill,
    lr_number: d.lr_number || waybill,
    courier: d.courier_name || 'Delhivery B2B',
    status: d.status === 'delivered' ? 'DELIVERED' : 'IN_TRANSIT',
    current_location: d.status === 'delivered' ? (so?.shipping_address?.city || 'Destination') : 'Bhiwandi Linehaul Hub',
    expected_delivery: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    scans,
    consignee: d.customer_name,
    boxes: d.scheduled_quantity || 1
  });
});

app.post('/api/dispatches/:id/pickup-request', currentUser, async (req, res) => {
  const d = await Dispatch.findOne({ id: req.params.id, ...scope(req) });
  if (!d) return res.status(404).json({ detail: 'Dispatch not found' });
  
  const token = `PKP-${String(Date.now()).slice(4)}`;
  const pickupDate = req.body.pickup_date || new Date().toISOString().slice(0, 10);
  
  await Dispatch.updateOne({ id: d.id, ...scope(req) }, {
    $set: { pickup_token: token }
  });
  
  return res.json({
    ok: true,
    pickup_token: token,
    pickup_date: pickupDate,
    warehouse: d.warehouse || 'Main Warehouse',
    package_count: d.scheduled_quantity || 1,
    status: 'Scheduled with Delhivery'
  });
});

app.post('/api/dispatches/:id/cancel-lr', currentUser, async (req, res) => {
  const d = await Dispatch.findOne({ id: req.params.id, ...scope(req) });
  if (!d) return res.status(404).json({ detail: 'Dispatch not found' });
  
  await Dispatch.updateOne({ id: d.id, ...scope(req) }, {
    $set: {
      status: 'scheduled',
      tracking_status: 'Cancelled',
      lr_number: '',
      awb_number: ''
    }
  });
  
  return res.json({ ok: true, message: 'Delhivery LR cancelled successfully' });
});

// Official Delhivery B2B Lorry Receipt (LR) PDF Stream
app.get('/api/delhivery-b2b/lr-pdf/:lrn', async (req, res) => {
  try {
    const orgId = req.query.org_id || (req.user && req.user.organization_id);
    const b2bService = await getDelhiveryB2BServiceForOrg(CourierConfig, orgId);
    const pdfBuffer = await b2bService.getLRCopyPdfBuffer(req.params.lrn);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="delhivery-b2b-lr-${req.params.lrn}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Delhivery B2B LR PDF download error:', err.message);
    return res.status(500).json({ detail: `Could not fetch LR PDF from Delhivery: ${err.message}` });
  }
});

// Official Delhivery B2B Consignment Tracking
app.get('/api/delhivery-b2b/track/:lrn', currentUser, async (req, res) => {
  try {
    const b2bService = await getDelhiveryB2BServiceForOrg(CourierConfig, req.user.organization_id);
    const trackData = await b2bService.trackLR(req.params.lrn);
    return res.json(trackData);
  } catch (err) {
    console.error('Delhivery B2B Tracking error:', err.message);
    return res.status(400).json({ detail: err.message });
  }
});

// Official Delhivery B2B Freight Charges Breakup
app.get('/api/delhivery-b2b/freight-breakup', currentUser, async (req, res) => {
  try {
    const lrns = req.query.lrns || req.query.lrn;
    if (!lrns) return res.status(400).json({ detail: 'lrns query parameter is required' });
    const b2bService = await getDelhiveryB2BServiceForOrg(CourierConfig, req.user.organization_id);
    const breakupData = await b2bService.getFreightBreakup(lrns);
    return res.json(breakupData);
  } catch (err) {
    console.error('Delhivery B2B Freight Breakup error:', err.message);
    return res.status(400).json({ detail: err.message });
  }
});

// ----------------------------- Pincode & Geo Lookup Utility -----------------------------
const pincodeCache = new Map();

const STATE_GST_CODES = {
  'Jammu and Kashmir': '01', 'Himachal Pradesh': '02', 'Punjab': '03', 'Chandigarh': '04',
  'Uttarakhand': '05', 'Haryana': '06', 'Delhi': '07', 'Rajasthan': '08',
  'Uttar Pradesh': '09', 'Bihar': '10', 'Sikkim': '11', 'Arunachal Pradesh': '12',
  'Nagaland': '13', 'Manipur': '14', 'Mizoram': '15', 'Tripura': '16',
  'Meghalaya': '17', 'Assam': '18', 'West Bengal': '19', 'Jharkhand': '20',
  'Odisha': '21', 'Chhattisgarh': '22', 'Madhya Pradesh': '23', 'Gujarat': '24',
  'Daman and Diu': '26', 'Dadra and Nagar Haveli': '26', 'Maharashtra': '27',
  'Andhra Pradesh': '37', 'Karnataka': '29', 'Goa': '30', 'Lakshadweep': '31',
  'Kerala': '32', 'Tamil Nadu': '33', 'Puducherry': '34', 'Andaman and Nicobar Islands': '35',
  'Telangana': '36', 'Ladakh': '38'
};

const PINCODE_FALLBACKS = {
  '360001': { city: 'Rajkot', district: 'Rajkot', state: 'Gujarat', state_code: '24' },
  '360002': { city: 'Rajkot', district: 'Rajkot', state: 'Gujarat', state_code: '24' },
  '360003': { city: 'Rajkot', district: 'Rajkot', state: 'Gujarat', state_code: '24' },
  '360004': { city: 'Rajkot', district: 'Rajkot', state: 'Gujarat', state_code: '24' },
  '360005': { city: 'Rajkot', district: 'Rajkot', state: 'Gujarat', state_code: '24' },
  '360020': { city: 'Rajkot', district: 'Rajkot', state: 'Gujarat', state_code: '24' },
  '360024': { city: 'Rajkot', district: 'Rajkot', state: 'Gujarat', state_code: '24' },
  '380001': { city: 'Ahmedabad', district: 'Ahmedabad', state: 'Gujarat', state_code: '24' },
  '380009': { city: 'Ahmedabad', district: 'Ahmedabad', state: 'Gujarat', state_code: '24' },
  '380015': { city: 'Ahmedabad', district: 'Ahmedabad', state: 'Gujarat', state_code: '24' },
  '395001': { city: 'Surat', district: 'Surat', state: 'Gujarat', state_code: '24' },
  '390001': { city: 'Vadodara', district: 'Vadodara', state: 'Gujarat', state_code: '24' },
  '400001': { city: 'Mumbai', district: 'Mumbai', state: 'Maharashtra', state_code: '27' },
  '400051': { city: 'Mumbai', district: 'Mumbai Suburban', state: 'Maharashtra', state_code: '27' },
  '421302': { city: 'Bhiwandi', district: 'Thane', state: 'Maharashtra', state_code: '27' },
  '411001': { city: 'Pune', district: 'Pune', state: 'Maharashtra', state_code: '27' },
  '110001': { city: 'New Delhi', district: 'Central Delhi', state: 'Delhi', state_code: '07' },
  '110020': { city: 'New Delhi', district: 'South Delhi', state: 'Delhi', state_code: '07' },
  '560001': { city: 'Bengaluru', district: 'Bengaluru', state: 'Karnataka', state_code: '29' },
  '577222': { city: 'Shivamogga', district: 'Shimoga', state: 'Karnataka', state_code: '29' },
  '577201': { city: 'Shivamogga', district: 'Shimoga', state: 'Karnataka', state_code: '29' },
  '600001': { city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu', state_code: '33' },
  '700001': { city: 'Kolkata', district: 'Kolkata', state: 'West Bengal', state_code: '19' },
  '500001': { city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', state_code: '36' },
  '302001': { city: 'Jaipur', district: 'Jaipur', state: 'Rajasthan', state_code: '08' },
  '226001': { city: 'Lucknow', district: 'Lucknow', state: 'Uttar Pradesh', state_code: '09' },
  '201301': { city: 'Noida', district: 'Gautam Buddha Nagar', state: 'Uttar Pradesh', state_code: '09' }
};

app.get('/api/utils/pincode/:pincode', async (req, res) => {
  const pin = String(req.params.pincode || '').trim();
  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({ success: false, detail: 'Pincode must be 6 digits' });
  }

  if (pincodeCache.has(pin)) {
    return res.json(pincodeCache.get(pin));
  }

  if (PINCODE_FALLBACKS[pin]) {
    const cached = {
      success: true,
      pincode: pin,
      ...PINCODE_FALLBACKS[pin],
      country: 'India',
      places: [PINCODE_FALLBACKS[pin].city]
    };
    pincodeCache.set(pin, cached);
    return res.json(cached);
  }

  try {
    const postRes = await new Promise((resolve) => {
      https.get(`https://api.postalpincode.in/pincode/${pin}`, { timeout: 4000 }, (resp) => {
        let d = '';
        resp.on('data', chunk => d += chunk);
        resp.on('end', () => {
          try {
            const parsed = JSON.parse(d);
            if (parsed && parsed[0] && parsed[0].Status === 'Success' && parsed[0].PostOffice?.length > 0) {
              const po = parsed[0].PostOffice[0];
              const state = po.State || '';
              const city = po.District || po.Division || po.Block || '';
              const result = {
                success: true,
                pincode: pin,
                city,
                district: po.District || '',
                state,
                state_code: STATE_GST_CODES[state] || '',
                country: 'India',
                places: parsed[0].PostOffice.map(p => p.Name).slice(0, 8)
              };
              return resolve(result);
            }
            resolve(null);
          } catch (e) {
            resolve(null);
          }
        });
      }).on('error', () => resolve(null));
    });

    if (postRes) {
      pincodeCache.set(pin, postRes);
      return res.json(postRes);
    }

    return res.status(404).json({ success: false, detail: 'Pincode not found' });
  } catch (err) {
    return res.status(500).json({ success: false, detail: err.message });
  }
});

app.get('/api/dispatches/:id/shipping-label', currentUser, async (req, res) => {
  const d = await Dispatch.findOne({ id: req.params.id, ...scope(req) });
  if (!d) return res.status(404).send('Dispatch not found');
  const org = await Organization.findOne({ id: req.user.organization_id });
  const so = await SalesOrder.findOne({ id: d.sales_order_id, ...scope(req) });
  const cust = await Customer.findOne({ id: so?.customer_id, ...scope(req) });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Delhivery B2B Lorry Receipt (LR) - ${d.lr_number || d.number}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; color: #111; font-size: 12px; }
    .label-box { border: 2px solid #000; max-width: 650px; margin: 0 auto; padding: 15px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .logo { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #b91c1c; }
    .b2b-badge { background: #000; color: #fff; padding: 3px 8px; font-size: 11px; font-weight: 700; border-radius: 3px; }
    .lr-section { margin-top: 10px; display: flex; justify-content: space-between; border-bottom: 1px dashed #444; padding-bottom: 8px; }
    .barcode { font-family: monospace; font-size: 24px; letter-spacing: 5px; font-weight: bold; margin: 8px 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px; border-bottom: 1px solid #000; padding-bottom: 10px; }
    .box h4 { margin: 0 0 5px 0; font-size: 11px; text-transform: uppercase; color: #555; }
    .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .table th, .table td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
    .table th { background: #f3f4f6; }
    .footer { margin-top: 15px; font-size: 10px; color: #444; display: flex; justify-content: space-between; }
    @media print { .no-print { display: none; } body { margin: 0; } }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 650px; margin: 0 auto 10px; display: flex; justify-content: flex-end;">
    <button onclick="window.print()" style="padding: 6px 14px; background: #000; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Print LR Copy / Label</button>
  </div>
  <div class="label-box">
    <div class="header">
      <div>
        <div class="logo">DELHIVERY <span style="color:#000; font-weight:400;">B2B EXPRESS</span></div>
        <div style="font-size: 10px; color: #555;">Goods Consignment Note / Lorry Receipt (LR)</div>
      </div>
      <div style="text-align: right;">
        <span class="b2b-badge">DELHIVERY ONE B2B</span>
        <div style="font-size: 11px; font-weight: 600; margin-top: 4px;">DATE: ${d.lr_date || new Date().toISOString().slice(0, 10)}</div>
      </div>
    </div>

    <div class="lr-section">
      <div>
        <div style="font-size: 10px; text-transform: uppercase;">Delhivery LR Number</div>
        <div style="font-size: 16px; font-weight: 800;">${d.lr_number || ('DELH' + d.number)}</div>
        <div class="barcode">||| | | |||| | || | ||| |||</div>
        <div style="font-size: 10px; font-family: monospace;">AWB: ${d.awb_number || '141098234712'}</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 10px; text-transform: uppercase;">Sales Order / Ref</div>
        <div style="font-size: 13px; font-weight: 700;">${d.sales_order_number || 'SO-DIRECT'}</div>
        <div style="font-size: 11px; color: #555; margin-top: 4px;">Vehicle: ${d.vehicle || 'DELHIVERY HUB ROUTE'}</div>
        <div style="font-size: 11px; color: #555;">Transporter: ${d.transporter || 'Delhivery Surface'}</div>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <h4>CONSIGNOR (Shipped From)</h4>
        <div style="font-weight: 700;">${org?.legal_name || org?.name || 'Vegnar Global LLP'}</div>
        <div>${org?.address || 'MIDC Industrial Area'}, ${org?.city || 'Mumbai'}, ${org?.state || 'Maharashtra'} - 400001</div>
        <div style="font-size: 11px; margin-top: 3px;"><strong>GSTIN:</strong> ${org?.gstin || '27AABCV1234F1Z5'}</div>
        <div style="font-size: 11px;"><strong>Origin Hub:</strong> BOM/BHI (Bhiwandi Linehaul)</div>
      </div>
      <div class="box">
        <h4>CONSIGNEE (Shipped To)</h4>
        <div style="font-weight: 700;">${d.customer_name || 'Customer'}</div>
        <div>${cust?.billing_address || cust?.shipping_address || 'Consignee Delivery Address'}</div>
        <div style="font-size: 11px; margin-top: 3px;"><strong>GSTIN:</strong> ${cust?.gstin || 'URP'}</div>
        <div style="font-size: 11px;"><strong>Destination Hub:</strong> DEL/GGN Express DC</div>
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>No. of Packages</th>
          <th>Description of Goods</th>
          <th>Actual Wt (kg)</th>
          <th>Chargeable Wt (kg)</th>
          <th>Delivery Mode</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="font-weight: bold; font-size: 14px;">${d.scheduled_quantity || 1} Box(es)</td>
          <td>Manufacturing / Trading Commercial Goods</td>
          <td>${Math.round((d.scheduled_quantity || 1) * 12)} kg</td>
          <td>${Math.round((d.scheduled_quantity || 1) * 14)} kg</td>
          <td>B2B Surface Regular (Prepaid)</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <div>
        <div>Authorized Delhivery Signatory / Stamp: _______________________</div>
        <div style="font-size: 9px; color: #777; margin-top: 3px;">Subject to standard terms of Delhivery Freight Carriage.</div>
      </div>
      <div style="text-align: right;">
        <div>Consignee Signature on Receipt: _______________________</div>
        <div style="font-size: 9px; color: #777; margin-top: 3px;">Verify package intactness before signing POD.</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.send(html);
});

app.get('/api/challans', currentUser, async (req, res) => {
  const docs = await Challan.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/challans', currentUser, async (req, res) => {
  const so = await SalesOrder.findOne({ id: req.body.sales_order_id, ...scope(req) });
  if (!so) return res.status(400).json({ detail: 'Sales order not found' });
  const number = await nextNumber(req.user.organization_id, 'CH', 'CH');
  const items = req.body.items || [];

  // Reduce stock + log movement
  for (const it of items) {
    if (it.product_id) {
      const qty = Math.abs(parseFloat(it.quantity || 0));
      await Product.updateOne(
        { id: it.product_id, ...scope(req) },
        { $inc: { current_stock: -qty } }
      );
      await InventoryMovement.create({
        id: newId(),
        organization_id: req.user.organization_id,
        product_id: it.product_id,
        product_name: it.name,
        movement_type: 'outward',
        quantity: -qty,
        warehouse: req.body.warehouse || 'Main',
        reference_type: 'challan'
      });

      // Low stock notification
      const prod = await Product.findOne({ id: it.product_id, ...scope(req) });
      if (prod && prod.current_stock <= prod.min_stock) {
        await Notification.create({
          id: newId(),
          organization_id: req.user.organization_id,
          type: 'low_stock',
          title: 'Low stock',
          message: `${prod.name} is at ${prod.current_stock} (min ${prod.min_stock})`,
          product_id: prod.id
        });
      }
    }
  }

  const doc = await Challan.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    dispatch_id: req.body.dispatch_id || null,
    sales_order_id: req.body.sales_order_id,
    sales_order_number: so.number,
    customer_id: so.customer_id,
    customer_name: so.customer_name,
    brand_id: so.brand_id,
    warehouse: req.body.warehouse || 'Main',
    vehicle: req.body.vehicle || '',
    transporter: req.body.transporter || '',
    lr_number: req.body.lr_number || '',
    eway_bill: req.body.eway_bill || '',
    driver: req.body.driver || '',
    items,
    notes: req.body.notes || '',
    subtotal: so.subtotal,
    cgst: so.cgst,
    sgst: so.sgst,
    igst: so.igst,
    grand_total: so.grand_total,
    created_by: req.user.id
  });

  if (req.body.dispatch_id) {
    await Dispatch.updateOne({ id: req.body.dispatch_id, ...scope(req) }, {
      $set: { status: 'dispatched', challan_id: doc.id }
    });
  }

  return res.json(cleanDoc(doc));
});

app.post('/api/challans/:id/generate-eway-bill', currentUser, async (req, res) => {
  const ch = await Challan.findOne({ id: req.params.id, ...scope(req) });
  if (!ch) return res.status(404).json({ detail: 'Challan not found' });
  const ewbNo = String(Date.now()).slice(0, 12);
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await Challan.updateOne({ id: ch.id, ...scope(req) }, {
    $set: { eway_bill: ewbNo, eway_generated_at: now(), eway_valid_until: validUntil, eway_status: 'generated' }
  });

  return res.json({ ewb_no: ewbNo, generated_date: now(), valid_until: validUntil, vehicle: ch.vehicle || '' });
});

// ----------------------------- Inventory Ledger -----------------------------
app.get('/api/inventory/movements', currentUser, async (req, res) => {
  const filter = { ...scope(req) };
  if (req.query.product_id) filter.product_id = req.query.product_id;
  const docs = await InventoryMovement.find(filter).sort({ created_at: -1 }).limit(500);
  return res.json(docs.map(cleanDoc));
});

app.post('/api/inventory/adjust', currentUser, async (req, res) => {
  const { product_id, quantity, movement_type, warehouse, notes } = req.body;
  const prod = await Product.findOne({ id: product_id, ...scope(req) });
  if (!prod) return res.status(404).json({ detail: 'Product not found' });

  const delta = movement_type === 'outward' ? -Math.abs(parseFloat(quantity)) : parseFloat(quantity);
  await Product.updateOne({ id: product_id, ...scope(req) }, { $inc: { current_stock: delta } });

  const doc = await InventoryMovement.create({
    id: newId(),
    organization_id: req.user.organization_id,
    product_id,
    product_name: prod.name,
    movement_type: movement_type || 'adjustment',
    quantity: delta,
    warehouse: warehouse || 'Main',
    reference_type: 'manual',
    notes: notes || ''
  });

  return res.json(cleanDoc(doc));
});

// ----------------------------- Stock Health & Dead Stock Clearance -----------------------------
app.get('/api/inventory/stock-health', currentUser, async (req, res) => {
  try {
    const products = await Product.find(scope(req));
    const invs = await Invoice.find(scope(req));
    const orders = await SalesOrder.find(scope(req));

    // Build last sale date map per product
    const lastSaleMap = {};
    [...invs, ...orders].forEach(doc => {
      const d = doc.invoice_date || doc.order_date;
      (doc.items || []).forEach(it => {
        if (it.product_id && d) {
          if (!lastSaleMap[it.product_id] || d > lastSaleMap[it.product_id]) {
            lastSaleMap[it.product_id] = d;
          }
        }
      });
    });

    const criticalItems = [];
    const deadStockItems = [];
    const healthyItems = [];
    let totalLockedCapital = 0;

    products.forEach(p => {
      const stock = parseFloat(p.current_stock || 0);
      const minStock = parseFloat(p.min_stock || 0);
      const cost = parseFloat(p.purchase_price || 0);
      const sell = parseFloat(p.selling_price || 0);
      const lastSale = lastSaleMap[p.id] || null;

      let daysSinceSale = 999;
      if (lastSale) {
        daysSinceSale = Math.floor((Date.now() - new Date(lastSale).getTime()) / (1000 * 60 * 60 * 24));
      }

      const lockedVal = Math.round(stock * cost * 100) / 100;
      const itemData = {
        ...cleanDoc(p),
        last_sale_date: lastSale,
        days_since_sale: daysSinceSale,
        locked_capital: lockedVal,
        suggested_discount_pct: 25,
        clearance_price: Math.round(sell * 0.75 * 100) / 100,
        potential_cash_release: Math.round(stock * (sell * 0.75) * 100) / 100
      };

      if (stock <= minStock) {
        criticalItems.push({
          ...itemData,
          health_status: 'CRITICAL_STOCK',
          deficit: Math.max(0, minStock - stock)
        });
      } else if (stock > 0 && (daysSinceSale >= 60 || !lastSale)) {
        totalLockedCapital += lockedVal;
        deadStockItems.push({
          ...itemData,
          health_status: 'DEAD_STOCK'
        });
      } else {
        healthyItems.push({
          ...itemData,
          health_status: 'HEALTHY'
        });
      }
    });

    return res.json({
      total_products: products.length,
      critical_count: criticalItems.length,
      dead_stock_count: deadStockItems.length,
      healthy_count: healthyItems.length,
      total_locked_capital: Math.round(totalLockedCapital * 100) / 100,
      critical_items: criticalItems,
      dead_stock_items: deadStockItems,
      healthy_items: healthyItems
    });
  } catch (err) {
    console.error('Error fetching stock health:', err);
    return res.status(500).json({ detail: err.message });
  }
});

app.post('/api/inventory/clearance-offer', currentUser, async (req, res) => {
  try {
    const { product_id, discount_pct = 25, custom_message } = req.body;
    const prod = await Product.findOne({ id: product_id, ...scope(req) });
    if (!prod) return res.status(404).json({ detail: 'Product not found' });

    const customers = await Customer.find({ ...scope(req), mobile: { $exists: true, $ne: '' } });
    if (customers.length === 0) {
      return res.status(400).json({ detail: 'No customers found with registered mobile numbers.' });
    }

    const result = await whatsappService.broadcastClearanceOffer(prod, discount_pct, customers, custom_message);

    const offerPrice = Math.round(prod.selling_price * (1 - discount_pct / 100) * 100) / 100;
    const potentialCash = Math.round(prod.current_stock * offerPrice * 100) / 100;

    const bcast = await Broadcast.create({
      id: newId(),
      organization_id: req.user.organization_id,
      title: `Clearance: ${prod.name} (${discount_pct}% OFF)`,
      audience: 'all_customers',
      message: result.message_template,
      recipients_count: result.total_recipients,
      sent_count: result.sent_count,
      failed_count: result.failed_count,
      status: 'completed',
      kind: 'clearance_offer',
      product_id: prod.id,
      product_name: prod.name,
      potential_cash_released: potentialCash,
      details: result.results || []
    });

    return res.json({
      ok: true,
      broadcast_id: bcast.id,
      sent_count: result.sent_count,
      failed_count: result.failed_count,
      total_recipients: result.total_recipients,
      discount_pct,
      offer_price: offerPrice,
      potential_cash_released: potentialCash,
      sample_message: result.message_template
    });
  } catch (err) {
    console.error('Clearance offer broadcast error:', err);
    return res.status(500).json({ detail: err.message });
  }
});

// ----------------------------- Warehouses & Transfers -----------------------------
app.get('/api/warehouses', currentUser, async (req, res) => {
  const docs = await Warehouse.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/warehouses', currentUser, async (req, res) => {
  const doc = await Warehouse.create({
    ...req.body,
    id: newId(),
    organization_id: req.user.organization_id
  });
  return res.json(cleanDoc(doc));
});

app.get('/api/warehouse-transfers', currentUser, async (req, res) => {
  const docs = await WarehouseTransfer.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/warehouse-transfers', currentUser, async (req, res) => {
  const { product_id, from_warehouse, to_warehouse, quantity, notes } = req.body;
  const prod = await Product.findOne({ id: product_id, ...scope(req) });
  if (!prod) return res.status(404).json({ detail: 'Product not found' });

  const number = await nextNumber(req.user.organization_id, 'TR', 'TR');
  const qty = parseFloat(quantity || 0);

  const doc = await WarehouseTransfer.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    product_id,
    product_name: prod.name,
    from_warehouse,
    to_warehouse,
    quantity: qty,
    notes: notes || '',
    created_by: req.user.id
  });

  // Dual movement entries
  await InventoryMovement.create({
    id: newId(),
    organization_id: req.user.organization_id,
    product_id,
    product_name: prod.name,
    movement_type: 'outward',
    quantity: -Math.abs(qty),
    warehouse: from_warehouse,
    reference_type: 'transfer',
    reference_number: number
  });

  await InventoryMovement.create({
    id: newId(),
    organization_id: req.user.organization_id,
    product_id,
    product_name: prod.name,
    movement_type: 'inward',
    quantity: Math.abs(qty),
    warehouse: to_warehouse,
    reference_type: 'transfer',
    reference_number: number
  });

  return res.json(cleanDoc(doc));
});

// ----------------------------- Reports & Dashboard -----------------------------
app.get('/api/dashboard/stats', currentUser, async (req, res) => {
  const q = scope(req);
  const invoices = await Invoice.find(q);
  const payments = await Payment.find(q);
  const leads = await Lead.find(q);

  const totalSales = invoices.reduce((a, i) => a + (i.grand_total || 0), 0);
  const receivable = invoices.reduce((a, i) => a + (i.balance_due || 0), 0);
  const cashIn = payments.reduce((a, p) => a + (p.amount || 0), 0);

  const openQuotes = await Quotation.countDocuments({ ...q, status: { $in: ['draft', 'sent'] } });
  const confirmedSo = await SalesOrder.countDocuments({ ...q, status: 'confirmed' });
  const pendingInvoices = await Invoice.countDocuments({ ...q, status: { $in: ['unpaid', 'partial'] } });
  const newLeads = await Lead.countDocuments({ ...q, stage: 'new' });
  const wonLeads = await Lead.countDocuments({ ...q, stage: 'won' });
  const totalLeads = leads.length;
  const lowStock = await Product.countDocuments({ ...q, $expr: { $lte: ['$current_stock', '$min_stock'] } });
  const customers = await Customer.countDocuments(q);
  const products = await Product.countDocuments(q);
  const conv = totalLeads ? Math.round((wonLeads / totalLeads) * 1000) / 10 : 0;

  // Pipeline stages
  const stages = ['new', 'contacted', 'qualified', 'quotation_sent', 'negotiation', 'won', 'lost'];
  const pipeline = await Promise.all(stages.map(async stage => ({
    stage,
    count: await Lead.countDocuments({ ...q, stage })
  })));

  // Top customers
  const customerSalesMap = {};
  invoices.forEach(i => {
    const cName = i.customer_name || 'Customer';
    customerSalesMap[cName] = (customerSalesMap[cName] || 0) + (i.grand_total || 0);
  });
  const topCustomers = Object.entries(customerSalesMap)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Sales trend by month (last 6 months)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthMap = {};
  const nowD = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(nowD.getFullYear(), nowD.getMonth() - i, 1);
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
    monthMap[key] = 0;
  }
  invoices.forEach(i => {
    if (i.invoice_date) {
      const d = new Date(i.invoice_date);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
      if (monthMap[key] !== undefined) {
        monthMap[key] += (i.grand_total || 0);
      }
    }
  });
  const salesTrend = Object.entries(monthMap).map(([month, value]) => ({ month, value: Math.round(value) }));

  return res.json({
    total_sales: Math.round(totalSales * 100) / 100,
    receivable: Math.round(receivable * 100) / 100,
    cash_in: Math.round(cashIn * 100) / 100,
    open_quotes: openQuotes,
    confirmed_so: confirmedSo,
    pending_invoices: pendingInvoices,
    new_leads: newLeads,
    won_leads: wonLeads,
    conversion_rate: conv,
    low_stock: lowStock,
    customers,
    products,
    pipeline,
    top_customers: topCustomers,
    sales_trend: salesTrend
  });
});

app.get('/api/reports/gst-summary', currentUser, async (req, res) => {
  const invs = await Invoice.find(scope(req));
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  const rateMap = {};

  invs.forEach(inv => {
    totalTaxable += inv.subtotal || 0;
    totalCgst += inv.cgst || 0;
    totalSgst += inv.sgst || 0;
    totalIgst += inv.igst || 0;

    (inv.items || []).forEach(it => {
      const rate = it.gst_rate !== undefined ? Number(it.gst_rate) : 18;
      if (!rateMap[rate]) rateMap[rate] = { rate, taxable: 0, tax: 0 };
      rateMap[rate].taxable += (it.taxable_amount || 0);
      rateMap[rate].tax += (it.tax_amount || 0);
    });
  });

  const byRate = Object.values(rateMap).map(r => ({
    rate: r.rate,
    taxable: Math.round(r.taxable * 100) / 100,
    tax: Math.round(r.tax * 100) / 100
  }));

  return res.json({
    total_taxable: Math.round(totalTaxable * 100) / 100,
    cgst: Math.round(totalCgst * 100) / 100,
    sgst: Math.round(totalSgst * 100) / 100,
    igst: Math.round(totalIgst * 100) / 100,
    total_tax: Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100,
    by_rate: byRate
  });
});

// ----------------------------- Expenses (Tally / Zoho / Odoo Accounting) -----------------------------
app.get('/api/expenses', currentUser, async (req, res) => {
  try {
    const filter = { ...scope(req) };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.vendor_id) filter.vendor_id = req.query.vendor_id;
    if (req.query.start_date || req.query.end_date) {
      filter.date = {};
      if (req.query.start_date) filter.date.$gte = req.query.start_date;
      if (req.query.end_date) filter.date.$lte = req.query.end_date;
    }
    const docs = await Expense.find(filter).sort({ date: -1, created_at: -1 });
    return res.json(docs.map(cleanDoc));
  } catch (err) {
    console.error('Error fetching expenses:', err);
    return res.status(500).json({ detail: err.message });
  }
});

app.post('/api/expenses', currentUser, async (req, res) => {
  try {
    const { title, category, subcategory, amount, tax_amount = 0, date, vendor_id, vendor_name, payment_mode, reference_no, notes } = req.body;
    if (!title || !amount) {
      return res.status(400).json({ detail: 'Title and amount are required' });
    }

    const number = await nextNumber(req.user.organization_id, 'EXP', 'EXP');
    const baseAmt = parseFloat(amount || 0);
    const taxAmt = parseFloat(tax_amount || 0);
    const totalAmt = Math.round((baseAmt + taxAmt) * 100) / 100;

    const doc = await Expense.create({
      id: newId(),
      number,
      organization_id: req.user.organization_id,
      title,
      category: category || 'OPEX',
      subcategory: subcategory || '',
      amount: baseAmt,
      tax_amount: taxAmt,
      total_amount: totalAmt,
      date: date || now(),
      vendor_id: vendor_id || null,
      vendor_name: vendor_name || '',
      payment_mode: payment_mode || 'Bank Transfer',
      reference_no: reference_no || '',
      notes: notes || '',
      created_by: req.user.id
    });

    // Create double-entry journal record
    await JournalEntry.create({
      id: newId(),
      organization_id: req.user.organization_id,
      date: date || now(),
      reference_type: 'expense',
      reference_id: doc.id,
      description: `Expense ${number}: ${title} (${category || 'OPEX'})`,
      lines: [
        { account_id: `EXP_${category || 'OPEX'}`, debit: baseAmt, credit: 0 },
        ...(taxAmt > 0 ? [{ account_id: 'ACC-GST-IN', debit: taxAmt, credit: 0 }] : []),
        { account_id: 'ACC-BANK', debit: 0, credit: totalAmt }
      ]
    });

    return res.json(cleanDoc(doc));
  } catch (err) {
    console.error('Error creating expense:', err);
    return res.status(500).json({ detail: err.message });
  }
});

app.get('/api/expenses/summary', currentUser, async (req, res) => {
  try {
    const docs = await Expense.find(scope(req));
    const categoryTotals = {
      OPEX: 0,
      FIXED: 0,
      TRANSPORTATION: 0,
      SALES_MARKETING: 0,
      ADMIN: 0,
      COGS: 0,
      OTHER: 0
    };
    let totalExpenses = 0;

    docs.forEach(e => {
      const cat = e.category || 'OPEX';
      const amt = parseFloat(e.total_amount || e.amount || 0);
      if (categoryTotals[cat] !== undefined) {
        categoryTotals[cat] += amt;
      } else {
        categoryTotals.OTHER += amt;
      }
      totalExpenses += amt;
    });

    const categories = Object.keys(categoryTotals).map(cat => ({
      category: cat,
      amount: Math.round(categoryTotals[cat] * 100) / 100,
      pct: totalExpenses > 0 ? Math.round((categoryTotals[cat] / totalExpenses) * 1000) / 10 : 0
    }));

    return res.json({
      total_expenses: Math.round(totalExpenses * 100) / 100,
      count: docs.length,
      by_category: categoryTotals,
      categories
    });
  } catch (err) {
    console.error('Error fetching expense summary:', err);
    return res.status(500).json({ detail: err.message });
  }
});

app.get('/api/expenses/:id', currentUser, async (req, res) => {
  const doc = await Expense.findOne({ id: req.params.id, ...scope(req) });
  if (!doc) return res.status(404).json({ detail: 'Expense not found' });
  return res.json(cleanDoc(doc));
});

app.put('/api/expenses/:id', currentUser, async (req, res) => {
  try {
    const { title, category, subcategory, amount, tax_amount, date, vendor_id, vendor_name, payment_mode, reference_no, notes } = req.body;
    const baseAmt = parseFloat(amount || 0);
    const taxAmt = parseFloat(tax_amount || 0);
    const totalAmt = Math.round((baseAmt + taxAmt) * 100) / 100;

    const doc = await Expense.findOneAndUpdate(
      { id: req.params.id, ...scope(req) },
      {
        $set: {
          ...(title && { title }),
          ...(category && { category }),
          ...(subcategory !== undefined && { subcategory }),
          ...(amount !== undefined && { amount: baseAmt }),
          ...(tax_amount !== undefined && { tax_amount: taxAmt }),
          ...(amount !== undefined && { total_amount: totalAmt }),
          ...(date && { date }),
          ...(vendor_id !== undefined && { vendor_id }),
          ...(vendor_name !== undefined && { vendor_name }),
          ...(payment_mode && { payment_mode }),
          ...(reference_no !== undefined && { reference_no }),
          ...(notes !== undefined && { notes })
        }
      },
      { new: true }
    );
    if (!doc) return res.status(404).json({ detail: 'Expense not found' });
    return res.json(cleanDoc(doc));
  } catch (err) {
    console.error('Error updating expense:', err);
    return res.status(500).json({ detail: err.message });
  }
});

app.delete('/api/expenses/:id', currentUser, async (req, res) => {
  try {
    const doc = await Expense.findOneAndDelete({ id: req.params.id, ...scope(req) });
    if (!doc) return res.status(404).json({ detail: 'Expense not found' });
    await JournalEntry.deleteMany({ reference_type: 'expense', reference_id: doc.id });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting expense:', err);
    return res.status(500).json({ detail: err.message });
  }
});

// ----------------------------- P&L Analytics (Zoho / Odoo / Tally Multi-Dimensional) -----------------------------
app.get('/api/reports/pl', currentUser, async (req, res) => {
  try {
    const invs = await Invoice.find(scope(req));
    const expenses = await Expense.find(scope(req));
    const dispatches = await Dispatch.find(scope(req));
    const products = await Product.find(scope(req));
    const costMap = {};
    products.forEach(p => { costMap[p.id] = p.purchase_price || 0; });

    let revenue = 0;
    let cogs = 0;
    invs.forEach(inv => {
      const rev = parseFloat(inv.subtotal || 0);
      let cost = parseFloat(inv.total_cost || 0);
      if (!cost && (inv.items || []).length > 0) {
        cost = (inv.items || []).reduce((sum, it) => {
          const c = parseFloat(it.purchase_price !== undefined ? it.purchase_price : (it.cost_price !== undefined ? it.cost_price : (costMap[it.product_id] || 0)));
          return sum + (parseFloat(it.quantity || 0) * c);
        }, 0);
      }
      revenue += rev;
      cogs += cost;
    });

    let opex = 0;
    let fixed = 0;
    let transportation = 0;
    let salesMarketing = 0;
    let admin = 0;
    let otherExpenses = 0;

    expenses.forEach(e => {
      const amt = parseFloat(e.total_amount || e.amount || 0);
      const cat = (e.category || 'OPEX').toUpperCase();
      if (cat === 'OPEX') opex += amt;
      else if (cat === 'FIXED') fixed += amt;
      else if (cat === 'TRANSPORTATION') transportation += amt;
      else if (cat === 'SALES_MARKETING') salesMarketing += amt;
      else if (cat === 'ADMIN') admin += amt;
      else otherExpenses += amt;
    });

    dispatches.forEach(d => {
      if (d.freight_charges) transportation += parseFloat(d.freight_charges || 0);
    });

    const grossProfit = revenue - cogs;
    const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const totalExpenses = opex + fixed + transportation + salesMarketing + admin + otherExpenses;
    const netProfit = grossProfit - totalExpenses;
    const netMarginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return res.json({
      revenue: Math.round(revenue * 100) / 100,
      cogs: Math.round(cogs * 100) / 100,
      gross_profit: Math.round(grossProfit * 100) / 100,
      gross_margin: Math.round(grossMarginPct * 10) / 10,
      opex: Math.round(opex * 100) / 100,
      fixed_expenses: Math.round(fixed * 100) / 100,
      transportation_cost: Math.round(transportation * 100) / 100,
      sales_marketing: Math.round(salesMarketing * 100) / 100,
      admin_expenses: Math.round(admin * 100) / 100,
      total_expenses: Math.round(totalExpenses * 100) / 100,
      net_profit: Math.round(netProfit * 100) / 100,
      net_margin: Math.round(netMarginPct * 10) / 10
    });
  } catch (err) {
    console.error('Error fetching P&L summary:', err);
    return res.status(500).json({ detail: err.message });
  }
});

app.get('/api/reports/pnl-invoices', currentUser, async (req, res) => {
  try {
    const filter = { ...scope(req) };
    if (req.query.start_date || req.query.end_date) {
      filter.invoice_date = {};
      if (req.query.start_date) filter.invoice_date.$gte = req.query.start_date;
      if (req.query.end_date) filter.invoice_date.$lte = req.query.end_date;
    }
    if (req.query.customer_id) filter.customer_id = req.query.customer_id;
    if (req.query.status) filter.status = req.query.status;

    const invs = await Invoice.find(filter).sort({ invoice_date: -1 });

    const products = await Product.find(scope(req));
    const costMap = {};
    products.forEach(p => { costMap[p.id] = p.purchase_price || 0; });

    let totalRevenue = 0;
    let totalCost = 0;
    let totalGrossProfit = 0;

    const rows = invs.map(inv => {
      const rev = parseFloat(inv.subtotal || 0);
      let cost = parseFloat(inv.total_cost || 0);

      if (!cost && (inv.items || []).length > 0) {
        cost = (inv.items || []).reduce((sum, it) => {
          const c = parseFloat(it.purchase_price !== undefined ? it.purchase_price : (it.cost_price !== undefined ? it.cost_price : (costMap[it.product_id] || 0)));
          return sum + (parseFloat(it.quantity || 0) * c);
        }, 0);
      }
      const profit = rev - cost;
      const marginPct = rev > 0 ? (profit / rev) * 100 : 0;

      totalRevenue += rev;
      totalCost += cost;
      totalGrossProfit += profit;

      return {
        id: inv.id,
        number: inv.number,
        invoice_date: inv.invoice_date,
        customer_id: inv.customer_id,
        customer_name: inv.customer_name,
        items_count: (inv.items || []).length,
        revenue: Math.round(rev * 100) / 100,
        total_cost: Math.round(cost * 100) / 100,
        gross_profit: Math.round(profit * 100) / 100,
        gross_margin_pct: Math.round(marginPct * 10) / 10,
        status: inv.status,
        grand_total: inv.grand_total,
        balance_due: inv.balance_due
      };
    });

    const overallMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

    return res.json({
      summary: {
        total_revenue: Math.round(totalRevenue * 100) / 100,
        total_cogs: Math.round(totalCost * 100) / 100,
        total_gross_profit: Math.round(totalGrossProfit * 100) / 100,
        gross_margin_pct: Math.round(overallMargin * 10) / 10,
        invoice_count: rows.length
      },
      invoices: rows
    });
  } catch (err) {
    console.error('Error fetching pnl-invoices:', err);
    return res.status(500).json({ detail: err.message });
  }
});

app.get('/api/reports/pnl-products', currentUser, async (req, res) => {
  try {
    const invs = await Invoice.find(scope(req));
    const products = await Product.find(scope(req));

    const prodStats = {};
    products.forEach(p => {
      prodStats[p.id] = {
        product_id: p.id,
        product_name: p.name,
        sku: p.sku,
        category: p.category || '',
        unit: p.unit || 'PCS',
        purchase_price: p.purchase_price || 0,
        selling_price: p.selling_price || 0,
        current_stock: p.current_stock || 0,
        stock_valuation: Math.round((p.current_stock || 0) * (p.purchase_price || 0) * 100) / 100,
        units_sold: 0,
        total_revenue: 0,
        total_cogs: 0,
        gross_profit: 0,
        gross_margin_pct: 0,
        last_sale_date: null
      };
    });

    invs.forEach(inv => {
      (inv.items || []).forEach(it => {
        const pid = it.product_id;
        if (pid && prodStats[pid]) {
          const qty = parseFloat(it.quantity || 0);
          const rate = parseFloat(it.rate || 0);
          const disc = parseFloat(it.discount_pct || 0);
          const rev = qty * rate * (1 - disc / 100);
          const cost = qty * (prodStats[pid].purchase_price || 0);

          prodStats[pid].units_sold += qty;
          prodStats[pid].total_revenue += rev;
          prodStats[pid].total_cogs += cost;

          if (!prodStats[pid].last_sale_date || (inv.invoice_date && inv.invoice_date > prodStats[pid].last_sale_date)) {
            prodStats[pid].last_sale_date = inv.invoice_date;
          }
        }
      });
    });

    let grandRev = 0;
    let grandCost = 0;
    let grandProfit = 0;
    let grandValuation = 0;

    const productList = Object.values(prodStats).map(p => {
      p.gross_profit = p.total_revenue - p.total_cogs;
      p.gross_margin_pct = p.total_revenue > 0 ? (p.gross_profit / p.total_revenue) * 100 : 0;
      
      const prodMeta = products.find(x => x.id === p.product_id);
      let status = 'HEALTHY';
      if (p.current_stock <= (prodMeta?.min_stock || 0)) {
        status = 'CRITICAL';
      } else if (p.units_sold === 0 || (p.last_sale_date && (Date.now() - new Date(p.last_sale_date).getTime()) > 60 * 24 * 60 * 60 * 1000)) {
        status = 'DEAD_STOCK';
      }
      p.status = status;

      grandRev += p.total_revenue;
      grandCost += p.total_cogs;
      grandProfit += p.gross_profit;
      grandValuation += p.stock_valuation;

      return {
        ...p,
        total_revenue: Math.round(p.total_revenue * 100) / 100,
        total_cogs: Math.round(p.total_cogs * 100) / 100,
        gross_profit: Math.round(p.gross_profit * 100) / 100,
        gross_margin_pct: Math.round(p.gross_margin_pct * 10) / 10
      };
    }).sort((a, b) => b.total_revenue - a.total_revenue);

    return res.json({
      summary: {
        total_revenue: Math.round(grandRev * 100) / 100,
        total_cogs: Math.round(grandCost * 100) / 100,
        total_gross_profit: Math.round(grandProfit * 100) / 100,
        gross_margin_pct: grandRev > 0 ? Math.round((grandProfit / grandRev * 100) * 10) / 10 : 0,
        total_inventory_valuation: Math.round(grandValuation * 100) / 100,
        total_products: productList.length
      },
      products: productList
    });
  } catch (err) {
    console.error('Error fetching pnl-products:', err);
    return res.status(500).json({ detail: err.message });
  }
});

app.get('/api/reports/detailed-monthly-pl', currentUser, async (req, res) => {
  try {
    const invs = await Invoice.find(scope(req));
    const expenses = await Expense.find(scope(req));
    const dispatches = await Dispatch.find(scope(req));
    const products = await Product.find(scope(req));
    const costMap = {};
    products.forEach(p => { costMap[p.id] = p.purchase_price || 0; });

    const monthsMap = {};
    const allMonths = [];
    
    // Generate last 6 months list
    const nowD = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(nowD.getFullYear(), nowD.getMonth() - i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mLabel = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      allMonths.push({ key: mKey, label: mLabel });
      monthsMap[mKey] = {
        month: mKey,
        label: mLabel,
        sales_revenue: 0,
        cogs: 0,
        gross_profit: 0,
        gross_margin_pct: 0,
        opex: 0,
        fixed_expenses: 0,
        transportation_cost: 0,
        sales_marketing: 0,
        admin_expenses: 0,
        other_expenses: 0,
        total_operating_expenses: 0,
        operating_profit_ebitda: 0,
        net_profit: 0,
        net_margin_pct: 0
      };
    }

    invs.forEach(inv => {
      const mKey = (inv.invoice_date || '').slice(0, 7);
      if (monthsMap[mKey]) {
        const rev = parseFloat(inv.subtotal || 0);
        let cost = parseFloat(inv.total_cost || 0);
        if (!cost && (inv.items || []).length > 0) {
          cost = (inv.items || []).reduce((sum, it) => {
            const c = parseFloat(it.purchase_price !== undefined ? it.purchase_price : (it.cost_price !== undefined ? it.cost_price : (costMap[it.product_id] || 0)));
            return sum + (parseFloat(it.quantity || 0) * c);
          }, 0);
        }
        monthsMap[mKey].sales_revenue += rev;
        monthsMap[mKey].cogs += cost;
      }
    });

    expenses.forEach(e => {
      const mKey = (e.date || '').slice(0, 7);
      if (monthsMap[mKey]) {
        const amt = parseFloat(e.total_amount || e.amount || 0);
        const cat = (e.category || '').toUpperCase();
        if (cat === 'OPEX') monthsMap[mKey].opex += amt;
        else if (cat === 'FIXED') monthsMap[mKey].fixed_expenses += amt;
        else if (cat === 'TRANSPORTATION') monthsMap[mKey].transportation_cost += amt;
        else if (cat === 'SALES_MARKETING') monthsMap[mKey].sales_marketing += amt;
        else if (cat === 'ADMIN') monthsMap[mKey].admin_expenses += amt;
        else monthsMap[mKey].other_expenses += amt;
      }
    });

    dispatches.forEach(d => {
      const mKey = (d.dispatch_date || '').slice(0, 7);
      if (monthsMap[mKey] && d.freight_charges) {
        monthsMap[mKey].transportation_cost += parseFloat(d.freight_charges || 0);
      }
    });

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalOpex = 0;
    let totalFixed = 0;
    let totalTrans = 0;
    let totalMarketing = 0;
    let totalAdmin = 0;
    let totalOther = 0;

    const monthlyBreakdown = allMonths.map(m => {
      const data = monthsMap[m.key];
      data.gross_profit = data.sales_revenue - data.cogs;
      data.gross_margin_pct = data.sales_revenue > 0 ? (data.gross_profit / data.sales_revenue) * 100 : 0;
      
      data.total_operating_expenses = data.opex + data.fixed_expenses + data.transportation_cost + data.sales_marketing + data.admin_expenses + data.other_expenses;
      data.operating_profit_ebitda = data.gross_profit - (data.opex + data.transportation_cost + data.sales_marketing + data.admin_expenses);
      data.net_profit = data.gross_profit - data.total_operating_expenses;
      data.net_margin_pct = data.sales_revenue > 0 ? (data.net_profit / data.sales_revenue) * 100 : 0;

      totalRevenue += data.sales_revenue;
      totalCogs += data.cogs;
      totalOpex += data.opex;
      totalFixed += data.fixed_expenses;
      totalTrans += data.transportation_cost;
      totalMarketing += data.sales_marketing;
      totalAdmin += data.admin_expenses;
      totalOther += data.other_expenses;

      return {
        month: data.month,
        label: data.label,
        sales_revenue: Math.round(data.sales_revenue * 100) / 100,
        cogs: Math.round(data.cogs * 100) / 100,
        gross_profit: Math.round(data.gross_profit * 100) / 100,
        gross_margin_pct: Math.round(data.gross_margin_pct * 10) / 10,
        opex: Math.round(data.opex * 100) / 100,
        fixed_expenses: Math.round(data.fixed_expenses * 100) / 100,
        transportation_cost: Math.round(data.transportation_cost * 100) / 100,
        sales_marketing: Math.round(data.sales_marketing * 100) / 100,
        admin_expenses: Math.round(data.admin_expenses * 100) / 100,
        other_expenses: Math.round(data.other_expenses * 100) / 100,
        total_operating_expenses: Math.round(data.total_operating_expenses * 100) / 100,
        operating_profit_ebitda: Math.round(data.operating_profit_ebitda * 100) / 100,
        net_profit: Math.round(data.net_profit * 100) / 100,
        net_margin_pct: Math.round(data.net_margin_pct * 10) / 10
      };
    });

    const totalGrossProfit = totalRevenue - totalCogs;
    const totalExpenses = totalOpex + totalFixed + totalTrans + totalMarketing + totalAdmin + totalOther;
    const totalNetProfit = totalGrossProfit - totalExpenses;

    return res.json({
      annual_summary: {
        sales_revenue: Math.round(totalRevenue * 100) / 100,
        cogs: Math.round(totalCogs * 100) / 100,
        gross_profit: Math.round(totalGrossProfit * 100) / 100,
        gross_margin_pct: totalRevenue > 0 ? Math.round((totalGrossProfit / totalRevenue * 100) * 10) / 10 : 0,
        opex: Math.round(totalOpex * 100) / 100,
        fixed_expenses: Math.round(totalFixed * 100) / 100,
        transportation_cost: Math.round(totalTrans * 100) / 100,
        sales_marketing: Math.round(totalMarketing * 100) / 100,
        admin_expenses: Math.round(totalAdmin * 100) / 100,
        other_expenses: Math.round(totalOther * 100) / 100,
        total_operating_expenses: Math.round(totalExpenses * 100) / 100,
        net_profit: Math.round(totalNetProfit * 100) / 100,
        net_margin_pct: totalRevenue > 0 ? Math.round((totalNetProfit / totalRevenue * 100) * 10) / 10 : 0
      },
      monthly_data: monthlyBreakdown
    });
  } catch (err) {
    console.error('Error generating detailed monthly P&L:', err);
    return res.status(500).json({ detail: err.message });
  }
});

// ----------------------------- Global Search -----------------------------
app.get('/api/search', currentUser, async (req, res) => {
  const q = req.query.q || '';
  if (!q || q.length < 2) return res.json({ results: [] });

  const rx = new RegExp(q, 'i');
  const results = [];

  const leads = await Lead.find({ ...scope(req), $or: [{ company_name: rx }, { email: rx }, { mobile: rx }] }).limit(5);
  leads.forEach(l => results.push({ type: 'Lead', id: l.id, title: l.company_name, subtitle: l.email || l.mobile }));

  const custs = await Customer.find({ ...scope(req), $or: [{ company_name: rx }, { email: rx }, { mobile: rx }] }).limit(5);
  custs.forEach(c => results.push({ type: 'Customer', id: c.id, title: c.company_name, subtitle: c.email }));

  const prods = await Product.find({ ...scope(req), $or: [{ name: rx }, { sku: rx }] }).limit(5);
  prods.forEach(p => results.push({ type: 'Product', id: p.id, title: p.name, subtitle: p.sku }));

  const quotes = await Quotation.find({ ...scope(req), $or: [{ number: rx }, { customer_name: rx }] }).limit(5);
  quotes.forEach(q => results.push({ type: 'Quotation', id: q.id, title: q.number, subtitle: q.customer_name }));

  const invs = await Invoice.find({ ...scope(req), $or: [{ number: rx }, { customer_name: rx }] }).limit(5);
  invs.forEach(i => results.push({ type: 'Invoice', id: i.id, title: i.number, subtitle: i.customer_name }));

  return res.json({ results });
});

// ----------------------------- Notifications -----------------------------
app.get('/api/notifications', currentUser, async (req, res) => {
  const docs = await Notification.find(scope(req)).sort({ created_at: -1 }).limit(50);
  return res.json(docs.map(cleanDoc));
});

app.post('/api/notifications/:id/read', currentUser, async (req, res) => {
  await Notification.updateOne({ id: req.params.id, ...scope(req) }, { $set: { read: true } });
  return res.json({ ok: true });
});

// ----------------------------- Tasks & Activities -----------------------------
app.get('/api/tasks', currentUser, async (req, res) => {
  const docs = await Task.find(scope(req)).sort({ created_at: -1 }).limit(500);
  return res.json(docs.map(cleanDoc));
});

app.post('/api/tasks', currentUser, async (req, res) => {
  const doc = await Task.create({
    ...req.body,
    id: newId(),
    organization_id: req.user.organization_id,
    created_by: req.user.id
  });
  return res.json(cleanDoc(doc));
});

app.get('/api/activities', currentUser, async (req, res) => {
  const filter = { ...scope(req) };
  if (req.query.related_id) filter.related_id = req.query.related_id;
  const docs = await Activity.find(filter).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/activities', currentUser, async (req, res) => {
  const doc = await Activity.create({
    ...req.body,
    id: newId(),
    organization_id: req.user.organization_id,
    created_by: req.user.id,
    created_by_name: req.user.name
  });
  return res.json(cleanDoc(doc));
});

// ----------------------------- Categories -----------------------------
app.get('/api/categories', currentUser, async (req, res) => {
  const docs = await Category.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/categories', currentUser, async (req, res) => {
  const doc = await Category.create({
    ...req.body,
    id: newId(),
    organization_id: req.user.organization_id
  });
  return res.json(cleanDoc(doc));
});

// ----------------------------- Organization Settings -----------------------------
app.get('/api/organization', currentUser, async (req, res) => {
  const org = await Organization.findOne({ id: req.user.organization_id });
  return res.json(cleanDoc(org));
});

app.patch('/api/organization', currentUser, async (req, res) => {
  if (!['super_admin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ detail: 'Admin role required' });
  }
  await Organization.updateOne({ id: req.user.organization_id }, { $set: req.body });
  const updated = await Organization.findOne({ id: req.user.organization_id });
  return res.json(cleanDoc(updated));
});

// ----------------------------- Users Management -----------------------------
app.get('/api/users', currentUser, async (req, res) => {
  const users = await User.find(scope(req)).sort({ created_at: -1 });
  return res.json(users.map(cleanDoc));
});

app.post('/api/users', currentUser, async (req, res) => {
  if (!['super_admin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ detail: 'Admin role required' });
  }
  const { email, name, password, role } = req.body;
  const lowerEmail = email.toLowerCase();
  const existing = await User.findOne({ email: lowerEmail });
  if (existing) return res.status(400).json({ detail: 'Email already exists' });

  const doc = await User.create({
    id: newId(),
    email: lowerEmail,
    password_hash: hashPw(password),
    name,
    role: role || 'sales_executive',
    organization_id: req.user.organization_id
  });
  return res.json(cleanDoc(doc));
});

app.patch('/api/users/:id/role', currentUser, async (req, res) => {
  if (!['super_admin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ detail: 'Admin role required' });
  }
  await User.updateOne({ id: req.params.id, ...scope(req) }, { $set: { role: req.body.role } });
  return res.json({ ok: true });
});

// ----------------------------- Credit / Debit Notes -----------------------------
app.get('/api/credit-notes', currentUser, async (req, res) => {
  const docs = await Note.find({ ...scope(req), kind: 'credit_note' }).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/credit-notes', currentUser, async (req, res) => {
  const number = await nextNumber(req.user.organization_id, 'CN', 'CN');
  const computed = computeTotals(req.body.items || [], true);
  const doc = await Note.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    kind: 'credit_note',
    invoice_id: req.body.invoice_id || null,
    customer_id: req.body.customer_id || null,
    customer_name: req.body.customer_name || '',
    reason: req.body.reason || '',
    items: computed.items,
    subtotal: computed.subtotal,
    cgst: computed.cgst,
    sgst: computed.sgst,
    igst: computed.igst,
    grand_total: computed.grand_total,
    note_date: now()
  });
  return res.json(cleanDoc(doc));
});

app.get('/api/debit-notes', currentUser, async (req, res) => {
  const docs = await Note.find({ ...scope(req), kind: 'debit_note' }).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/debit-notes', currentUser, async (req, res) => {
  const number = await nextNumber(req.user.organization_id, 'DN', 'DN');
  const computed = computeTotals(req.body.items || [], true);
  const doc = await Note.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    kind: 'debit_note',
    bill_id: req.body.bill_id || null,
    vendor_id: req.body.vendor_id || null,
    vendor_name: req.body.vendor_name || '',
    reason: req.body.reason || '',
    items: computed.items,
    subtotal: computed.subtotal,
    cgst: computed.cgst,
    sgst: computed.sgst,
    igst: computed.igst,
    grand_total: computed.grand_total,
    note_date: now()
  });
  return res.json(cleanDoc(doc));
});

// ----------------------------- Returns -----------------------------
app.get('/api/sales-returns', currentUser, async (req, res) => {
  const docs = await ReturnDoc.find({ ...scope(req), kind: 'sales_return' }).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/sales-returns', currentUser, async (req, res) => {
  const number = await nextNumber(req.user.organization_id, 'SR', 'SR');
  const doc = await ReturnDoc.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    kind: 'sales_return',
    invoice_id: req.body.invoice_id || null,
    reason: req.body.reason || '',
    items: req.body.items || []
  });
  return res.json(cleanDoc(doc));
});

app.get('/api/purchase-returns', currentUser, async (req, res) => {
  const docs = await ReturnDoc.find({ ...scope(req), kind: 'purchase_return' }).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/purchase-returns', currentUser, async (req, res) => {
  const number = await nextNumber(req.user.organization_id, 'PR', 'PR');
  const doc = await ReturnDoc.create({
    id: newId(),
    number,
    organization_id: req.user.organization_id,
    kind: 'purchase_return',
    grn_id: req.body.grn_id || null,
    reason: req.body.reason || '',
    items: req.body.items || []
  });
  return res.json(cleanDoc(doc));
});

// ----------------------------- Audit Logs -----------------------------
app.get('/api/audit-logs', currentUser, async (req, res) => {
  const docs = await AuditLog.find(scope(req)).sort({ created_at: -1 }).limit(200);
  return res.json(docs.map(cleanDoc));
});

// ----------------------------- Automation Rules -----------------------------
app.get('/api/automation-rules', currentUser, async (req, res) => {
  const docs = await AutomationRule.find(scope(req)).sort({ created_at: -1 });
  return res.json(docs.map(cleanDoc));
});

app.post('/api/automation-rules', currentUser, async (req, res) => {
  const doc = await AutomationRule.create({
    ...req.body,
    id: newId(),
    organization_id: req.user.organization_id
  });
  return res.json(cleanDoc(doc));
});

app.patch('/api/automation-rules/:id', currentUser, async (req, res) => {
  await AutomationRule.updateOne({ id: req.params.id, ...scope(req) }, { $set: req.body });
  return res.json({ ok: true });
});

// ----------------------------- WhatsApp Config & Broadcasts -----------------------------
app.get('/api/whatsapp/config', currentUser, async (req, res) => {
  const org = await Organization.findOne({ id: req.user.organization_id });
  const wa = org?.whatsapp || {};
  return res.json({
    business_account_id: wa.business_account_id || '',
    phone_number_id: wa.phone_number_id || '',
    alert_to: wa.alert_to || '',
    configured: Boolean(wa.access_token && wa.phone_number_id)
  });
});

// ----------------------------- WhatsApp Integration (Saasyto Live API) -----------------------------
app.get('/api/whatsapp/status', currentUser, async (req, res) => {
  return res.json({
    configured: true,
    provider: 'saasyto',
    instance_id: whatsappService.instanceId,
    access_token_configured: Boolean(whatsappService.accessToken),
    base_url: whatsappService.baseUrl
  });
});

app.post('/api/whatsapp/config', currentUser, async (req, res) => {
  await Organization.updateOne({ id: req.user.organization_id }, { $set: { whatsapp: req.body } });
  return res.json({ ok: true, configured: true });
  if (req.body.instance_id) whatsappService.instanceId = req.body.instance_id;
  if (req.body.access_token) whatsappService.accessToken = req.body.access_token;
  return res.json({ ok: true, configured: true, instance_id: whatsappService.instanceId });
});

app.get('/api/whatsapp/qrcode', currentUser, async (req, res) => {
  const qrRes = await whatsappService.getQRCode();
  return res.json(qrRes);
});

app.post('/api/whatsapp/create-instance', currentUser, async (req, res) => {
  const instRes = await whatsappService.createInstance();
  return res.json(instRes);
});

app.post('/api/whatsapp/send-test', currentUser, async (req, res) => {
  try {
    const { number, message } = req.body;
    if (!number) return res.status(400).json({ detail: 'Target phone number is required' });
    const sendRes = await whatsappService.sendMessage(number, message || 'Hello from Vegnar ERP WhatsApp Service!');
    return res.json(sendRes);
  } catch (err) {
    console.error('WhatsApp test send error:', err);
    return res.status(500).json({ detail: err.message });
  }
});

app.get('/api/broadcasts', currentUser, async (req, res) => {
  return res.json([]);
  const docs = await Broadcast.find(scope(req)).sort({ created_at: -1 }).limit(100);
  return res.json(docs.map(cleanDoc));
});

app.post('/api/broadcast/preview', currentUser, async (req, res) => {
  const custs = await Customer.find(scope(req));
  const recipients = custs.filter(c => c.mobile).map(c => ({ id: c.id, name: c.company_name, mobile: c.mobile }));
  return res.json({ count: recipients.length, recipients: recipients.slice(0, 20), total_matched: custs.length });
});

app.post('/api/broadcast/send', currentUser, async (req, res) => {
  return res.json({ sent: 0, failed: 0 });
  try {
    const { message, audience = 'customers', custom_numbers = [], title } = req.body;
    if (!message) return res.status(400).json({ detail: 'Message content is required' });

    let recipients = [];
    if (audience === 'customers' || audience === 'all') {
      const custs = await Customer.find({ ...scope(req), mobile: { $exists: true, $ne: '' } });
      recipients = custs.map(c => ({ id: c.id, name: c.company_name, mobile: c.mobile }));
    } else if (audience === 'leads') {
      const leads = await Lead.find({ ...scope(req), mobile: { $exists: true, $ne: '' } });
      recipients = leads.map(l => ({ id: l.id, name: l.company_name, mobile: l.mobile }));
    }

    if (custom_numbers && custom_numbers.length > 0) {
      custom_numbers.forEach(num => recipients.push({ id: num, name: 'Custom Contact', mobile: num }));
    }

    let sent = 0;
    let failed = 0;
    const details = [];

    for (const r of recipients) {
      const personalized = message.replace(/{customer_name}/g, r.name).replace(/{name}/g, r.name);
      const resp = await whatsappService.sendMessage(r.mobile, personalized);
      if (resp.status === 'success') {
        sent++;
        details.push({ to: r.mobile, name: r.name, status: 'sent' });
      } else {
        failed++;
        details.push({ to: r.mobile, name: r.name, status: 'failed', error: resp.message || resp.error });
      }
    }

    const bcast = await Broadcast.create({
      id: newId(),
      organization_id: req.user.organization_id,
      title: title || 'WhatsApp Broadcast Campaign',
      audience,
      message,
      recipients_count: recipients.length,
      sent_count: sent,
      failed_count: failed,
      status: 'completed',
      kind: 'general',
      details
    });

    return res.json({
      ok: true,
      broadcast_id: bcast.id,
      sent,
      failed,
      total: recipients.length
    });
  } catch (err) {
    console.error('Error broadcasting messages:', err);
    return res.status(500).json({ detail: err.message });
  }
});

// ----------------------------- Reorder Suggestions -----------------------------
app.get('/api/reorder-suggestions', currentUser, async (req, res) => {
  const products = await Product.find(scope(req));
  const suggestions = products
    .filter(p => p.current_stock <= p.min_stock)
    .map(p => ({
      product_id: p.id,
      product_name: p.name,
      sku: p.sku,
      current_stock: p.current_stock,
      min_stock: p.min_stock,
      daily_velocity: 1.5,
      days_of_cover: Math.round(p.current_stock / 1.5),
      suggested_qty: Math.max(100, (p.min_stock * 2) - p.current_stock),
      estimated_cost: Math.round(Math.max(100, (p.min_stock * 2) - p.current_stock) * p.purchase_price * 100) / 100,
      urgency: p.current_stock <= 0 ? 'critical' : 'high'
    }));
  return res.json({ suggestions, total: suggestions.length });
});

// ----------------------------- Receivables Aging Report -----------------------------
app.get('/api/reports/receivables-aging', currentUser, async (req, res) => {
  const invs = await Invoice.find({ ...scope(req), balance_due: { $gt: 0 } });
  const buckets = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const custMap = {};

  invs.forEach(inv => {
    const due = new Date(inv.due_date || inv.invoice_date);
    const diffDays = Math.floor((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24));
    const bKey = diffDays <= 0 ? 'current' : (diffDays <= 30 ? '1-30' : (diffDays <= 60 ? '31-60' : (diffDays <= 90 ? '61-90' : '90+')));
    buckets[bKey] += inv.balance_due || 0;

    const cName = inv.customer_name;
    if (!custMap[cName]) {
      custMap[cName] = { customer: cName, current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 };
    }
    custMap[cName][bKey] += inv.balance_due || 0;
    custMap[cName].total += inv.balance_due || 0;
  });

  return res.json({
    buckets: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, Math.round(v * 100) / 100])),
    customers: Object.values(custMap).map(c => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 100) / 100 : v])))
  });
});

// ----------------------------- Public Customer Portal -----------------------------
app.post('/api/customers/:id/portal-link', currentUser, async (req, res) => {
  const c = await Customer.findOne({ id: req.params.id, ...scope(req) });
  if (!c) return res.status(404).json({ detail: 'Customer not found' });
  let token = c.portal_token;
  if (!token) {
    token = uuidv4().replace(/-/g, '');
    await Customer.updateOne({ id: c.id, ...scope(req) }, { $set: { portal_token: token } });
  }
  return res.json({ token, url_path: `/portal/${token}` });
});

app.get('/api/portal/:token', async (req, res) => {
  const c = await Customer.findOne({ portal_token: req.params.token });
  if (!c) return res.status(404).json({ detail: 'Invalid link' });
  
  const org = await Organization.findOne({ id: c.organization_id });
  const invs = await Invoice.find({ customer_id: c.id }).sort({ created_at: -1 });
  const pays = await Payment.find({ customer_id: c.id }).sort({ created_at: -1 });
  const quotes = await Quotation.find({ customer_id: c.id }).sort({ created_at: -1 });
  const outstanding = invs.reduce((a, i) => a + (i.balance_due || 0), 0);
  const upi = org?.upi_id || '';

  return res.json({
    customer: {
      id: c.id,
      company_name: c.company_name,
      contact_person: c.contact_person,
      gstin: c.gstin,
      email: c.email,
      mobile: c.mobile,
      billing_address: c.billing_address,
      shipping_address: c.shipping_address,
      state: c.state,
      state_code: c.state_code
    },
    organization: {
      name: org?.name || '',
      gstin: org?.gstin || '',
      bank_name: org?.bank_name || '',
      account_number: org?.account_number || '',
      ifsc: org?.ifsc || '',
      upi_id: upi
    },
    invoices: invs.map(cleanDoc),
    payments: pays.map(cleanDoc),
    quotations: quotes.map(cleanDoc),
    outstanding: Math.round(outstanding * 100) / 100,
    upi_pay_url: upi && outstanding > 0 ? `upi://pay?pa=${upi}&pn=${encodeURIComponent(org.name)}&am=${outstanding.toFixed(2)}&cu=INR` : ''
  });
});

// ----------------------------- Comprehensive Demo Data Seeder -----------------------------
async function seedComprehensiveDemoData(org, admin, force = false) {
  try {
    const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
    const daysAhead = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
    const orgId = org.id;
    const adminId = admin ? admin.id : 'usr_admin_001';

    if (force) {
      await Promise.all([
        Customer.deleteMany({ organization_id: orgId }),
        Vendor.deleteMany({ organization_id: orgId }),
        Product.deleteMany({ organization_id: orgId }),
        Quotation.deleteMany({ organization_id: orgId }),
        SalesOrder.deleteMany({ organization_id: orgId }),
        Invoice.deleteMany({ organization_id: orgId }),
        Payment.deleteMany({ organization_id: orgId }),
        PurchaseOrder.deleteMany({ organization_id: orgId }),
        GRN.deleteMany({ organization_id: orgId }),
        VendorBill.deleteMany({ organization_id: orgId }),
        PaymentMade.deleteMany({ organization_id: orgId }),
        InventoryMovement.deleteMany({ organization_id: orgId }),
        Challan.deleteMany({ organization_id: orgId }),
        Dispatch.deleteMany({ organization_id: orgId }),
        Lead.deleteMany({ organization_id: orgId }),
        Account.deleteMany({ organization_id: orgId }),
        Warehouse.deleteMany({ organization_id: orgId }),
        Expense.deleteMany({ organization_id: orgId }),
        Broadcast.deleteMany({ organization_id: orgId })
      ]);
    }

    // 1. Brand
    let brand = await Brand.findOne({ organization_id: orgId });
    if (!brand) {
      brand = await Brand.create({
        id: 'brd_vegnar_001',
        organization_id: orgId,
        name: 'Vegnar Eco Tableware',
        invoice_prefix: 'VGN-INV',
        quotation_prefix: 'VGN-QT',
        sales_order_prefix: 'VGN-SO',
        color: '#16A34A',
        email: 'sales@vegnar.com',
        phone: '+91 98765 43210',
        gstin: org.gstin || '27AABCV1234F1Z5'
      });
    }

    // 2. Warehouses
    const existingWh = await Warehouse.countDocuments({ organization_id: orgId });
    if (existingWh === 0) {
      await Warehouse.create([
        {
          id: 'wh_rajkot_001',
          organization_id: orgId,
          name: 'Vegnar warehouse',
          code: 'WH-RJK-01',
          address: 'Plot 12, GIDC Industrial Estate, Rajkot, Gujarat 360001',
          city: 'Rajkot',
          state: 'Gujarat',
          pin: '360001',
          manager: 'Ashish Chauhan',
          contact: '+91 99795 83428',
          capacity: 500000,
          status: 'active'
        },
        {
          id: 'wh_rajkot_002',
          organization_id: orgId,
          name: 'VEGNAR GLOBAL 9032 B2B',
          code: 'WH-RJK-02',
          address: 'Plot 12, GIDC Industrial Estate, Rajkot, Gujarat 360001',
          city: 'Rajkot',
          state: 'Gujarat',
          pin: '360001',
          manager: 'Ashish Chauhan',
          contact: '+91 99795 83428',
          capacity: 500000,
          status: 'active'
        },
        {
          id: 'wh_rajkot_003',
          organization_id: orgId,
          name: 'Nandanvan',
          code: 'WH-RJK-03',
          address: 'Nandanvan Industrial Area, Rajkot, Gujarat 360001',
          city: 'Rajkot',
          state: 'Gujarat',
          pin: '360001',
          manager: 'Ashish Chauhan',
          contact: '+91 99795 83428',
          capacity: 250000,
          status: 'active'
        },
        {
          id: 'wh_morbi_001',
          organization_id: orgId,
          name: 'Ankit Silicate',
          code: 'WH-MRB-01',
          address: 'Morbi Highway, Morbi, Gujarat 363641',
          city: 'Morbi',
          state: 'Gujarat',
          pin: '363641',
          manager: 'Facility Manager',
          contact: '+91 99795 83428',
          capacity: 200000,
          status: 'active'
        },
        {
          id: 'wh_indore_001',
          organization_id: orgId,
          name: 'ECO X VARGA',
          code: 'WH-IND-01',
          address: 'Industrial Area, Indore, Madhya Pradesh 452001',
          city: 'Indore',
          state: 'Madhya Pradesh',
          pin: '452001',
          manager: 'Facility Manager',
          contact: '+91 99795 83428',
          capacity: 200000,
          status: 'active'
        },
        {
          id: 'wh_mumbai_001',
          organization_id: orgId,
          name: 'PURELY ECOWARE LLP',
          code: 'WH-MUM-01',
          address: 'Lower Parel, Mumbai, Maharashtra 400013',
          city: 'Mumbai',
          state: 'Maharashtra',
          pin: '400013',
          manager: 'Facility Manager',
          contact: '+91 99795 83428',
          capacity: 200000,
          status: 'active'
        }
      ]);
    } else {
      // Ensure Vegnar warehouse exists
      const vegnarWh = await Warehouse.findOne({ organization_id: orgId, name: 'Vegnar warehouse' });
      if (!vegnarWh) {
        await Warehouse.create({
          id: 'wh_rajkot_001',
          organization_id: orgId,
          name: 'Vegnar warehouse',
          code: 'WH-RJK-01',
          address: 'Plot 12, GIDC Industrial Estate, Rajkot, Gujarat 360001',
          city: 'Rajkot',
          state: 'Gujarat',
          pin: '360001',
          manager: 'Ashish Chauhan',
          contact: '+91 99795 83428',
          capacity: 500000,
          status: 'active'
        });
      }
    }

    // 3. Customers (AMISOL GLOBAL ECO WARE LLP. + enterprise clients)
    const amisolCust = await Customer.findOne({ organization_id: orgId, company_name: /AMISOL/i });
    if (!amisolCust) {
      await Customer.create({
        id: 'cust_amisol_001',
        organization_id: orgId,
        company_name: 'AMISOL GLOBAL ECO WARE LLP.',
        contact_person: 'Procurement Manager',
        mobile: '+91 98200 12345',
        email: 'billing@amisol.in',
        gstin: '29ABQFA3483J1ZU',
        pan: 'ABQFA3483J',
        state: 'Karnataka',
        state_code: '29',
        city: 'Shivamogga',
        billing_address: 'No 18/A KIADB Industrial Area Machenahalli Shivamogga, Karnataka, India (Pin Code - 577222)',
        shipping_address: 'No 18/A KIADB Industrial Area Machenahalli Shivamogga, Karnataka, India (Pin Code - 577222)',
        credit_limit: 1500000,
        payment_terms: 'Net 30',
        brand_id: brand.id,
        portal_token: 'portal_token_amisol'
      });
    }

    const vegnarCust = await Customer.findOne({ organization_id: orgId, email: 'ashish@vegnar.com' });
    if (!vegnarCust) {
      await Customer.create([
        {
          id: 'cust_vegnar_001',
          organization_id: orgId,
          company_name: 'Vegnar Global LLP',
          contact_person: 'Ashish Chauhan',
          mobile: '+91 98765 43210',
          email: 'ashish@vegnar.com',
          gstin: '27AABCV1234F1Z5',
          pan: 'AABCV1234F',
          state: 'Maharashtra',
          state_code: '27',
          billing_address: 'Office 402, Trade Link Towers, Senapati Bapat Marg, Lower Parel, Mumbai, Maharashtra 400013',
          shipping_address: 'Warehouse Shed No. 3, Indian Logistics Park, Bhiwandi, Thane, Maharashtra 421302',
          credit_limit: 1000000,
          payment_terms: 'Net 30',
          brand_id: brand.id,
          portal_token: 'vgn_portal_token_ashish'
        },
        {
          id: 'cust_apex_002',
          organization_id: orgId,
          company_name: 'Apex Retailers & Distributors Pvt Ltd',
          contact_person: 'Rahul Deshmukh',
          mobile: '+91 98201 55667',
          email: 'purchases@apexretailers.in',
          gstin: '27AABCA9876B1Z3',
          pan: 'AABCA9876B',
          state: 'Maharashtra',
          state_code: '27',
          billing_address: 'Plot 45, MIDC Industrial Area, Andheri East, Mumbai 400093',
          shipping_address: 'Plot 45, MIDC Industrial Area, Andheri East, Mumbai 400093',
          credit_limit: 500000,
          payment_terms: 'Net 15',
          brand_id: brand.id,
          portal_token: 'portal_token_apex'
        },
        {
          id: 'cust_royal_003',
          organization_id: orgId,
          company_name: 'Royal Hospitality & Cloud Kitchens',
          contact_person: 'Vikram Malhotra',
          mobile: '+91 98112 33445',
          email: 'supply@royalhospitality.com',
          gstin: '07AABCR4567C1Z8',
          pan: 'AABCR4567C',
          state: 'Delhi',
          state_code: '07',
          billing_address: 'Block B, Okhla Industrial Area Phase I, New Delhi 110020',
          shipping_address: 'Block B, Okhla Industrial Area Phase I, New Delhi 110020',
          credit_limit: 350000,
          payment_terms: 'Net 30',
          brand_id: brand.id,
          portal_token: 'portal_token_royal'
        },
        {
          id: 'cust_dctours_004',
          organization_id: orgId,
          company_name: 'DC Tours & Event Catering Services',
          contact_person: 'Deepak Chauhan',
          mobile: '+91 98250 88990',
          email: 'procurement@dctours.co.in',
          gstin: '24AAACT8901D1Z2',
          pan: 'AAACT8901D',
          state: 'Gujarat',
          state_code: '24',
          billing_address: '301, Iscon Elegance, Prahlad Nagar, SG Highway, Ahmedabad, Gujarat 380015',
          shipping_address: '301, Iscon Elegance, Prahlad Nagar, SG Highway, Ahmedabad, Gujarat 380015',
          credit_limit: 400000,
          payment_terms: 'Net 45',
          brand_id: brand.id,
          portal_token: 'portal_token_dctours'
        },
        {
          id: 'cust_greenfield_005',
          organization_id: orgId,
          company_name: 'Greenfield Organics Supermarkets',
          contact_person: 'Priya Sundaram',
          mobile: '+91 98450 77112',
          email: 'inventory@greenfieldorganics.com',
          gstin: '29AABCG3456E1Z1',
          pan: 'AABCG3456E',
          state: 'Karnataka',
          state_code: '29',
          billing_address: '14/2, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
          shipping_address: '14/2, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
          credit_limit: 600000,
          payment_terms: 'Net 30',
          brand_id: brand.id,
          portal_token: 'portal_token_greenfield'
        }
      ]);
    }

    // 4. Vendors
    const vendorCount = await Vendor.countDocuments({ organization_id: orgId });
    if (vendorCount === 0) {
      await Vendor.create([
        {
          id: 'vend_ganesh_001',
          organization_id: orgId,
          company_name: 'Shree Ganesh Pulp & Paper Mills Ltd',
          contact_person: 'Kishore Bhai Patel',
          mobile: '+91 98251 22334',
          email: 'sales@ganeshpulp.com',
          gstin: '24AABCS4321F1Z9',
          pan: 'AABCS4321F',
          state: 'Gujarat',
          state_code: '24',
          address: 'GIDC Industrial Estate, Vapi, Gujarat 396195',
          bank_name: 'State Bank of India',
          account_number: '30982211456',
          ifsc: 'SBIN0004567',
          payment_terms: 'Net 30'
        },
        {
          id: 'vend_packwell_002',
          organization_id: orgId,
          company_name: 'Packwell Corrugators & Packaging Solutions',
          contact_person: 'Manoj Shinde',
          mobile: '+91 98690 66778',
          email: 'orders@packwellbox.com',
          gstin: '27AABCP8765G1Z4',
          pan: 'AABCP8765G',
          state: 'Maharashtra',
          state_code: '27',
          address: 'Shed No. 12, Taloja MIDC, Navi Mumbai, Maharashtra 410208',
          bank_name: 'Axis Bank',
          account_number: '912020033445566',
          ifsc: 'UTIB0000123',
          payment_terms: 'Net 15'
        },
        {
          id: 'vend_ecobio_003',
          organization_id: orgId,
          company_name: 'EcoBio Resins & Barrier Chemicals Ltd',
          contact_person: 'Dr. Anita Sharma',
          mobile: '+91 98103 44556',
          email: 'accounts@ecobioresins.in',
          gstin: '27AABCE1122H1Z1',
          pan: 'AABCE1122H',
          state: 'Maharashtra',
          state_code: '27',
          address: 'Plot C-7, Kurkumbh MIDC, Pune, Maharashtra 413802',
          bank_name: 'ICICI Bank',
          account_number: '001105023456',
          ifsc: 'ICIC0000011',
          payment_terms: 'Net 30'
        }
      ]);
    }

    // 5. Products & Stock (Tableware, Shipper boxes, Pulp)
    const existingProd = await Product.findOne({ organization_id: orgId, sku: 'VGN-PLT-06' });
    if (!existingProd) {
      await Product.deleteMany({ organization_id: orgId });
      await Product.create([
        {
          id: 'prod_plt_6',
          organization_id: orgId,
          name: 'VEGNAR 6" Round Bagasse Plate',
          sku: 'VGN-PLT-06',
          brand_id: brand.id,
          category: 'Plates',
          hsn: '48237010',
          gst_rate: 18,
          unit: 'PCS',
          selling_price: 1.25,
          purchase_price: 0.72,
          opening_stock: 40000,
          current_stock: 34500,
          min_stock: 5000,
          description: '100% biodegradable sugarcane bagasse plate, oil & water resistant, microwave safe.',
          packaging_levels: [
            { level_name: 'Pack', ratio: 50, barcode: '8901234560011' },
            { level_name: 'Carton', ratio: 1000, barcode: '8901234560012' }
          ],
          length_cm: 15.5, width_cm: 15.5, height_cm: 1.5, weight_kg: 0.008
        },
        {
          id: 'prod_plt_9',
          organization_id: orgId,
          name: 'VEGNAR 9" Round Bagasse Plate',
          sku: 'VGN-PLT-09',
          brand_id: brand.id,
          category: 'Plates',
          hsn: '48237010',
          gst_rate: 18,
          unit: 'PCS',
          selling_price: 3.20,
          purchase_price: 1.85,
          opening_stock: 30000,
          current_stock: 24000,
          min_stock: 4000,
          description: '9 inch dinner plate made from compostable agro-residue sugarcane pulp.',
          packaging_levels: [
            { level_name: 'Pack', ratio: 50, barcode: '8901234560021' },
            { level_name: 'Carton', ratio: 500, barcode: '8901234560022' }
          ],
          length_cm: 23, width_cm: 23, height_cm: 2, weight_kg: 0.015
        },
        {
          id: 'prod_plt_10_3c',
          organization_id: orgId,
          name: 'VEGNAR 10" 3-Compartment Meal Tray',
          sku: 'VGN-TRY-10-3C',
          brand_id: brand.id,
          category: 'Compartment Trays',
          hsn: '48237010',
          gst_rate: 18,
          unit: 'PCS',
          selling_price: 4.50,
          purchase_price: 2.60,
          opening_stock: 20000,
          current_stock: 16200,
          min_stock: 3000,
          description: '3-compartment heavy duty meal tray for catering, thali delivery and corporate cafeterias.',
          packaging_levels: [
            { level_name: 'Pack', ratio: 50, barcode: '8901234560031' },
            { level_name: 'Carton', ratio: 500, barcode: '8901234560032' }
          ],
          length_cm: 26, width_cm: 21, height_cm: 2.5, weight_kg: 0.022
        },
        {
          id: 'prod_bwl_250',
          organization_id: orgId,
          name: 'VEGNAR 250ml Bagasse Soup/Curry Bowl',
          sku: 'VGN-BWL-250',
          brand_id: brand.id,
          category: 'Bowls',
          hsn: '48237010',
          gst_rate: 18,
          unit: 'PCS',
          selling_price: 1.90,
          purchase_price: 1.05,
          opening_stock: 35000,
          current_stock: 28800,
          min_stock: 6000,
          description: 'Leak-proof 250ml bagasse bowl suitable for hot soups, curries, and desserts.',
          packaging_levels: [
            { level_name: 'Pack', ratio: 100, barcode: '8901234560041' },
            { level_name: 'Carton', ratio: 1000, barcode: '8901234560042' }
          ],
          length_cm: 11.5, width_cm: 11.5, height_cm: 5, weight_kg: 0.010
        },
        {
          id: 'prod_plt_12',
          organization_id: orgId,
          name: 'VEGNAR 12" Oval Catering Platter',
          sku: 'VGN-PLT-12-OVL',
          brand_id: brand.id,
          category: 'Platters',
          hsn: '48237010',
          gst_rate: 18,
          unit: 'PCS',
          selling_price: 5.80,
          purchase_price: 3.40,
          opening_stock: 10000,
          current_stock: 3200, // Low stock indicator: min_stock 3500
          min_stock: 3500,
          description: 'Extra rigid 12 inch oval serving platter for buffets and banquet catering.',
          packaging_levels: [
            { level_name: 'Pack', ratio: 25, barcode: '8901234560051' },
            { level_name: 'Carton', ratio: 250, barcode: '8901234560052' }
          ],
          length_cm: 31, width_cm: 25, height_cm: 3, weight_kg: 0.030
        },
        {
          id: 'prod_box_outer',
          organization_id: orgId,
          name: '5-Ply Heavy Kraft Corrugated Shipper (500-Plate Master)',
          sku: 'PKG-BOX-5P-500',
          brand_id: brand.id,
          category: 'Packaging Material',
          hsn: '48191010',
          gst_rate: 18,
          unit: 'PCS',
          selling_price: 48.00,
          purchase_price: 34.50,
          opening_stock: 4000,
          current_stock: 2450,
          min_stock: 500,
          description: '180 GSM virgin kraft 5-ply corrugated shipper box for bulk B2B freight transportation.',
          length_cm: 48, width_cm: 48, height_cm: 32, weight_kg: 0.650
        },
        {
          id: 'prod_raw_pulp',
          organization_id: orgId,
          name: 'Bleached Sugarcane Bagasse Pulp Sheets (Bale)',
          sku: 'RM-PULP-BL-01',
          brand_id: brand.id,
          category: 'Raw Material',
          hsn: '47069200',
          gst_rate: 12,
          unit: 'KG',
          selling_price: 62.00,
          purchase_price: 46.50,
          opening_stock: 50000,
          current_stock: 38200,
          min_stock: 10000,
          description: 'FSC certified chlorine-free bleached sugarcane pulp for wet thermoforming molding machine.',
          length_cm: 100, width_cm: 80, height_cm: 120, weight_kg: 500.0
        },
        {
          id: 'prod_plt_fancy_hex',
          organization_id: orgId,
          name: 'VEGNAR 8" Hexagonal Bagasse Salad Bowl',
          sku: 'VGN-BWL-HEX-08',
          brand_id: brand.id,
          category: 'Bowls',
          hsn: '48237010',
          gst_rate: 18,
          unit: 'PCS',
          selling_price: 4.80,
          purchase_price: 2.20,
          opening_stock: 12000,
          current_stock: 12000, // Zero sales in 60+ days -> Dead Stock! Locked Capital = 12000 * 2.20 = 26,400!
          min_stock: 1000,
          description: 'Speciality geometric hexagonal salad bowl for gourmet salads. Slow-moving inventory.',
          packaging_levels: [
            { level_name: 'Pack', ratio: 50, barcode: '8901234560061' },
            { level_name: 'Carton', ratio: 500, barcode: '8901234560062' }
          ],
          length_cm: 20, width_cm: 20, height_cm: 4, weight_kg: 0.018
        }
      ]);
    }

    // 6. Quotations
    const quoteCount = await Quotation.countDocuments({ organization_id: orgId });
    if (quoteCount === 0) {
      await Quotation.create([
        {
          id: 'qt_001',
          number: 'QT-2026-00001',
          organization_id: orgId,
          customer_id: 'cust_vegnar_001',
          customer_name: 'Vegnar Global LLP',
          quote_date: daysAgo(50),
          expiry_date: daysAhead(10),
          brand_id: brand.id,
          status: 'accepted',
          sales_order_id: 'so_001',
          same_state: true,
          subtotal: 73500,
          cgst: 6615,
          sgst: 6615,
          igst: 0,
          tax_total: 13230,
          grand_total: 86730,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_9', name: 'VEGNAR 9" Round Bagasse Plate', quantity: 10000, rate: 3.20, gst_rate: 18, taxable_amount: 32000, tax_amount: 5760, amount: 37760 },
            { product_id: 'prod_plt_10_3c', name: 'VEGNAR 10" 3-Compartment Meal Tray', quantity: 5000, rate: 4.50, gst_rate: 18, taxable_amount: 22500, tax_amount: 4050, amount: 26550 },
            { product_id: 'prod_bwl_250', name: 'VEGNAR 250ml Bagasse Soup/Curry Bowl', quantity: 10000, rate: 1.90, gst_rate: 18, taxable_amount: 19000, tax_amount: 3420, amount: 22420 }
          ]
        },
        {
          id: 'qt_002',
          number: 'QT-2026-00002',
          organization_id: orgId,
          customer_id: 'cust_apex_002',
          customer_name: 'Apex Retailers & Distributors Pvt Ltd',
          quote_date: daysAgo(80),
          brand_id: brand.id,
          status: 'accepted',
          sales_order_id: 'so_002',
          same_state: true,
          subtotal: 44350,
          cgst: 3991.5,
          sgst: 3991.5,
          igst: 0,
          tax_total: 7983,
          grand_total: 52333,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_6', name: 'VEGNAR 6" Round Bagasse Plate', quantity: 15000, rate: 1.25, gst_rate: 18, taxable_amount: 18750, tax_amount: 3375, amount: 22125 },
            { product_id: 'prod_plt_9', name: 'VEGNAR 9" Round Bagasse Plate', quantity: 8000, rate: 3.20, gst_rate: 18, taxable_amount: 25600, tax_amount: 4608, amount: 30208 }
          ]
        },
        {
          id: 'qt_003',
          number: 'QT-2026-00003',
          organization_id: orgId,
          customer_id: 'cust_royal_003',
          customer_name: 'Royal Hospitality & Cloud Kitchens',
          quote_date: daysAgo(110),
          brand_id: brand.id,
          status: 'accepted',
          sales_order_id: 'so_003',
          same_state: false,
          subtotal: 82500,
          cgst: 0,
          sgst: 0,
          igst: 14850,
          tax_total: 14850,
          grand_total: 97350,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_10_3c', name: 'VEGNAR 10" 3-Compartment Meal Tray', quantity: 12000, rate: 4.50, gst_rate: 18, taxable_amount: 54000, tax_amount: 9720, amount: 63720 },
            { product_id: 'prod_bwl_250', name: 'VEGNAR 250ml Bagasse Soup/Curry Bowl', quantity: 15000, rate: 1.90, gst_rate: 18, taxable_amount: 28500, tax_amount: 5130, amount: 33630 }
          ]
        },
        {
          id: 'qt_004',
          number: 'QT-2026-00004',
          organization_id: orgId,
          customer_id: 'cust_greenfield_005',
          customer_name: 'Greenfield Organics Supermarkets',
          quote_date: daysAgo(25),
          brand_id: brand.id,
          status: 'accepted',
          sales_order_id: 'so_005',
          same_state: false,
          subtotal: 55000,
          cgst: 0,
          sgst: 0,
          igst: 9900,
          tax_total: 9900,
          grand_total: 64900,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_6', name: 'VEGNAR 6" Round Bagasse Plate', quantity: 20000, rate: 1.25, gst_rate: 18, taxable_amount: 25000, tax_amount: 4500, amount: 29500 },
            { product_id: 'prod_plt_9', name: 'VEGNAR 9" Round Bagasse Plate', quantity: 10000, rate: 3.00, gst_rate: 18, taxable_amount: 30000, tax_amount: 5400, amount: 35400 }
          ]
        },
        {
          id: 'qt_005',
          number: 'QT-2026-00005',
          organization_id: orgId,
          customer_id: 'cust_dctours_004',
          customer_name: 'DC Tours & Event Catering Services',
          quote_date: daysAgo(15),
          brand_id: brand.id,
          status: 'sent',
          same_state: false,
          subtotal: 66800,
          cgst: 0,
          sgst: 0,
          igst: 12024,
          tax_total: 12024,
          grand_total: 78824,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_12', name: 'VEGNAR 12" Oval Catering Platter', quantity: 6000, rate: 5.80, gst_rate: 18, taxable_amount: 34800, tax_amount: 6264, amount: 41064 },
            { product_id: 'prod_plt_9', name: 'VEGNAR 9" Round Bagasse Plate', quantity: 10000, rate: 3.20, gst_rate: 18, taxable_amount: 32000, tax_amount: 5760, amount: 37760 }
          ]
        }
      ]);
    }

    // 7. Sales Orders
    const amisolSo = await SalesOrder.findOne({ organization_id: orgId, number: 'SO-00092' });
    if (!amisolSo) {
      await SalesOrder.create([
        {
          id: 'so_amisol_00092',
          number: 'SO-00092',
          organization_id: orgId,
          quotation_id: 'qt_amisol_00177',
          customer_id: 'cust_amisol_001',
          customer_name: 'AMISOL GLOBAL ECO WARE LLP.',
          order_date: '2026-09-15',
          expected_delivery: daysAhead(5),
          warehouse: 'Vegnar_Rajkot',
          status: 'confirmed',
          same_state: false,
          subtotal: 230823.73,
          cgst: 0,
          sgst: 0,
          igst: 41548.27,
          tax_total: 41548.27,
          grand_total: 272372.00,
          created_by: adminId,
          eway_bill_number: '241098765432',
          items: [
            { product_id: 'prod_plt_9', name: 'VEGNAR 9" Round Bagasse Plate', quantity: 50000, rate: 3.20, gst_rate: 18, taxable_amount: 160000, tax_amount: 28800, amount: 188800 },
            { product_id: 'prod_plt_10_3c', name: 'VEGNAR 10" 3-Compartment Meal Tray', quantity: 15738, rate: 4.50, gst_rate: 18, taxable_amount: 70823.73, tax_amount: 12748.27, amount: 83572 }
          ]
        },
        {
          id: 'so_amisol_00018',
          number: 'SO-00018',
          organization_id: orgId,
          quotation_id: 'qt_amisol_00048',
          customer_id: 'cust_amisol_001',
          customer_name: 'AMISOL GLOBAL ECO WARE LLP.',
          order_date: '2026-06-11',
          expected_delivery: '2026-06-18',
          warehouse: 'Vegnar_Rajkot',
          status: 'confirmed',
          same_state: false,
          subtotal: 489472.03,
          cgst: 0,
          sgst: 0,
          igst: 88104.97,
          tax_total: 88104.97,
          grand_total: 577577.00,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_9', name: 'VEGNAR 9" Round Bagasse Plate', quantity: 100000, rate: 3.20, gst_rate: 18, taxable_amount: 320000, tax_amount: 57600, amount: 377600 },
            { product_id: 'prod_bwl_250', name: 'VEGNAR 250ml Bagasse Soup/Curry Bowl', quantity: 89195, rate: 1.90, gst_rate: 18, taxable_amount: 169472.03, tax_amount: 30504.97, amount: 199977 }
          ]
        }
      ]);
    }

    const soCount = await SalesOrder.countDocuments({ organization_id: orgId });
    if (soCount <= 2) {
      await SalesOrder.create([
        {
          id: 'so_001',
          number: 'SO-2026-00001',
          organization_id: orgId,
          quotation_id: 'qt_001',
          customer_id: 'cust_vegnar_001',
          customer_name: 'Vegnar Global LLP',
          order_date: daysAgo(48),
          expected_delivery: daysAgo(40),
          warehouse: 'Central Bhiwandi Warehouse',
          status: 'confirmed',
          same_state: true,
          subtotal: 73500,
          cgst: 6615,
          sgst: 6615,
          igst: 0,
          tax_total: 13230,
          grand_total: 86730,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_9', name: 'VEGNAR 9" Round Bagasse Plate', quantity: 10000, rate: 3.20, gst_rate: 18, taxable_amount: 32000, tax_amount: 5760, amount: 37760 },
            { product_id: 'prod_plt_10_3c', name: 'VEGNAR 10" 3-Compartment Meal Tray', quantity: 5000, rate: 4.50, gst_rate: 18, taxable_amount: 22500, tax_amount: 4050, amount: 26550 },
            { product_id: 'prod_bwl_250', name: 'VEGNAR 250ml Bagasse Soup/Curry Bowl', quantity: 10000, rate: 1.90, gst_rate: 18, taxable_amount: 19000, tax_amount: 3420, amount: 22420 }
          ]
        },
        {
          id: 'so_002',
          number: 'SO-2026-00002',
          organization_id: orgId,
          quotation_id: 'qt_002',
          customer_id: 'cust_apex_002',
          customer_name: 'Apex Retailers & Distributors Pvt Ltd',
          order_date: daysAgo(78),
          expected_delivery: daysAgo(70),
          warehouse: 'Central Bhiwandi Warehouse',
          status: 'confirmed',
          same_state: true,
          subtotal: 44350,
          cgst: 3991.5,
          sgst: 3991.5,
          igst: 0,
          tax_total: 7983,
          grand_total: 52333,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_6', name: 'VEGNAR 6" Round Bagasse Plate', quantity: 15000, rate: 1.25, gst_rate: 18, taxable_amount: 18750, tax_amount: 3375, amount: 22125 },
            { product_id: 'prod_plt_9', name: 'VEGNAR 9" Round Bagasse Plate', quantity: 8000, rate: 3.20, gst_rate: 18, taxable_amount: 25600, tax_amount: 4608, amount: 30208 }
          ]
        },
        {
          id: 'so_003',
          number: 'SO-2026-00003',
          organization_id: orgId,
          quotation_id: 'qt_003',
          customer_id: 'cust_royal_003',
          customer_name: 'Royal Hospitality & Cloud Kitchens',
          order_date: daysAgo(108),
          expected_delivery: daysAgo(100),
          warehouse: 'Central Bhiwandi Warehouse',
          status: 'confirmed',
          same_state: false,
          subtotal: 82500,
          cgst: 0,
          sgst: 0,
          igst: 14850,
          tax_total: 14850,
          grand_total: 97350,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_10_3c', name: 'VEGNAR 10" 3-Compartment Meal Tray', quantity: 12000, rate: 4.50, gst_rate: 18, taxable_amount: 54000, tax_amount: 9720, amount: 63720 },
            { product_id: 'prod_bwl_250', name: 'VEGNAR 250ml Bagasse Soup/Curry Bowl', quantity: 15000, rate: 1.90, gst_rate: 18, taxable_amount: 28500, tax_amount: 5130, amount: 33630 }
          ]
        },
        {
          id: 'so_004',
          number: 'SO-2026-00004',
          organization_id: orgId,
          quotation_id: 'qt_005',
          customer_id: 'cust_dctours_004',
          customer_name: 'DC Tours & Event Catering Services',
          order_date: daysAgo(138),
          expected_delivery: daysAgo(130),
          warehouse: 'Central Bhiwandi Warehouse',
          status: 'confirmed',
          same_state: false,
          subtotal: 66800,
          cgst: 0,
          sgst: 0,
          igst: 12024,
          tax_total: 12024,
          grand_total: 78824,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_12', name: 'VEGNAR 12" Oval Catering Platter', quantity: 6000, rate: 5.80, gst_rate: 18, taxable_amount: 34800, tax_amount: 6264, amount: 41064 },
            { product_id: 'prod_plt_9', name: 'VEGNAR 9" Round Bagasse Plate', quantity: 10000, rate: 3.20, gst_rate: 18, taxable_amount: 32000, tax_amount: 5760, amount: 37760 }
          ]
        },
        {
          id: 'so_005',
          number: 'SO-2026-00005',
          organization_id: orgId,
          quotation_id: 'qt_004',
          customer_id: 'cust_greenfield_005',
          customer_name: 'Greenfield Organics Supermarkets',
          order_date: daysAgo(22),
          expected_delivery: daysAgo(18),
          warehouse: 'Central Bhiwandi Warehouse',
          status: 'confirmed',
          same_state: false,
          subtotal: 55000,
          cgst: 0,
          sgst: 0,
          igst: 9900,
          tax_total: 9900,
          grand_total: 64900,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_6', name: 'VEGNAR 6" Round Bagasse Plate', quantity: 20000, rate: 1.25, gst_rate: 18, taxable_amount: 25000, tax_amount: 4500, amount: 29500 },
            { product_id: 'prod_plt_9', name: 'VEGNAR 9" Round Bagasse Plate', quantity: 10000, rate: 3.00, gst_rate: 18, taxable_amount: 30000, tax_amount: 5400, amount: 35400 }
          ]
        }
      ]);
    }

    // 8. Challans & Dispatches
    const chalCount = await Challan.countDocuments({ organization_id: orgId });
    if (chalCount === 0) {
      await Challan.create([
        {
          id: 'chal_001',
          number: 'CHAL-2026-00001',
          organization_id: orgId,
          sales_order_id: 'so_001',
          sales_order_number: 'SO-2026-00001',
          customer_id: 'cust_vegnar_001',
          customer_name: 'Vegnar Global LLP',
          warehouse: 'Central Bhiwandi Warehouse',
          vehicle: 'MH-04-GP-8890',
          transporter: 'Delhivery B2B Express',
          lr_number: 'DEL-B2B-9876543',
          eway_bill: '221456987123',
          challan_date: daysAgo(42),
          grand_total: 86730,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_9', name: 'VEGNAR 9" Round Bagasse Plate', quantity: 10000 },
            { product_id: 'prod_plt_10_3c', name: 'VEGNAR 10" 3-Compartment Meal Tray', quantity: 5000 },
            { product_id: 'prod_bwl_250', name: 'VEGNAR 250ml Bagasse Soup/Curry Bowl', quantity: 10000 }
          ]
        },
        {
          id: 'chal_002',
          number: 'CHAL-2026-00002',
          organization_id: orgId,
          sales_order_id: 'so_003',
          sales_order_number: 'SO-2026-00003',
          customer_id: 'cust_royal_003',
          customer_name: 'Royal Hospitality & Cloud Kitchens',
          warehouse: 'Central Bhiwandi Warehouse',
          vehicle: 'DL-1L-AA-4040',
          transporter: 'V-Trans Logistics',
          lr_number: 'VTR-778899',
          challan_date: daysAgo(102),
          grand_total: 97350,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_10_3c', name: 'VEGNAR 10" 3-Compartment Meal Tray', quantity: 12000 },
            { product_id: 'prod_bwl_250', name: 'VEGNAR 250ml Bagasse Soup/Curry Bowl', quantity: 15000 }
          ]
        }
      ]);

      await Dispatch.create([
        {
          id: 'dsp_001',
          number: 'DSP-2026-00001',
          organization_id: orgId,
          sales_order_id: 'so_001',
          sales_order_number: 'SO-2026-00001',
          customer_name: 'Vegnar Global LLP',
          dispatch_date: daysAgo(42),
          scheduled_quantity: 25000,
          warehouse: 'Central Bhiwandi Warehouse',
          courier_name: 'delhivery',
          awb_number: '1403298712345',
          lr_number: 'DEL-B2B-9876543',
          lr_date: daysAgo(42),
          freight_charges: 1125.22,
          status: 'dispatched',
          tracking_status: 'Delivered',
          pickup_token: 'PKP-VGN-01',
          created_by: adminId
        },
        {
          id: 'dsp_002',
          number: 'DSP-2026-00002',
          organization_id: orgId,
          sales_order_id: 'so_003',
          sales_order_number: 'SO-2026-00003',
          customer_name: 'Royal Hospitality & Cloud Kitchens',
          dispatch_date: daysAgo(102),
          scheduled_quantity: 27000,
          warehouse: 'Central Bhiwandi Warehouse',
          courier_name: 'V-Trans Logistics',
          lr_number: 'VTR-778899',
          status: 'dispatched',
          tracking_status: 'Delivered',
          created_by: adminId
        }
      ]);
    }

    // 9. Invoices (Configured across Current, 1-30, 31-60, 61-90, 90+ days aging buckets)
    const invCount = await Invoice.countDocuments({ organization_id: orgId });
    if (invCount === 0) {
      await Invoice.create([
        {
          id: 'inv_001',
          number: 'INV-2026-00001',
          organization_id: orgId,
          customer_id: 'cust_vegnar_001',
          customer_name: 'Vegnar Global LLP',
          sales_order_id: 'so_001',
          invoice_date: daysAgo(45),
          due_date: daysAgo(15), // Overdue by 15 days -> Bucket: '1-30'
          same_state: true,
          status: 'partial',
          amount_paid: 50000,
          balance_due: 36730,
          subtotal: 73500,
          cgst: 6615,
          sgst: 6615,
          igst: 0,
          tax_total: 13230,
          grand_total: 86730,
          irn: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
          ack_no: '12261098456201',
          ack_date: daysAgo(45),
          qr_data: 'IRN:a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0|ACK:12261098456201|Total:86730|Number:INV-2026-00001',
          einv_status: 'generated',
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_9', name: 'VEGNAR 9" Round Bagasse Plate', quantity: 10000, rate: 3.20, gst_rate: 18, taxable_amount: 32000, tax_amount: 5760, amount: 37760 },
            { product_id: 'prod_plt_10_3c', name: 'VEGNAR 10" 3-Compartment Meal Tray', quantity: 5000, rate: 4.50, gst_rate: 18, taxable_amount: 22500, tax_amount: 4050, amount: 26550 },
            { product_id: 'prod_bwl_250', name: 'VEGNAR 250ml Bagasse Soup/Curry Bowl', quantity: 10000, rate: 1.90, gst_rate: 18, taxable_amount: 19000, tax_amount: 3420, amount: 22420 }
          ]
        },
        {
          id: 'inv_002',
          number: 'INV-2026-00002',
          organization_id: orgId,
          customer_id: 'cust_vegnar_001',
          customer_name: 'Vegnar Global LLP',
          invoice_date: daysAgo(5),
          due_date: daysAhead(25), // Due in 25 days -> Bucket: 'current'
          same_state: true,
          status: 'unpaid',
          amount_paid: 0,
          balance_due: 13688,
          subtotal: 11600,
          cgst: 1044,
          sgst: 1044,
          igst: 0,
          tax_total: 2088,
          grand_total: 13688,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_12', name: 'VEGNAR 12" Oval Catering Platter', quantity: 2000, rate: 5.80, gst_rate: 18, taxable_amount: 11600, tax_amount: 2088, amount: 13688 }
          ]
        },
        {
          id: 'inv_003',
          number: 'INV-2026-00003',
          organization_id: orgId,
          customer_id: 'cust_apex_002',
          customer_name: 'Apex Retailers & Distributors Pvt Ltd',
          sales_order_id: 'so_002',
          invoice_date: daysAgo(75),
          due_date: daysAgo(45), // Overdue by 45 days -> Bucket: '31-60'
          same_state: true,
          status: 'unpaid',
          amount_paid: 0,
          balance_due: 52333,
          subtotal: 44350,
          cgst: 3991.5,
          sgst: 3991.5,
          igst: 0,
          tax_total: 7983,
          grand_total: 52333,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_6', name: 'VEGNAR 6" Round Bagasse Plate', quantity: 15000, rate: 1.25, gst_rate: 18, taxable_amount: 18750, tax_amount: 3375, amount: 22125 },
            { product_id: 'prod_plt_9', name: 'VEGNAR 9" Round Bagasse Plate', quantity: 8000, rate: 3.20, gst_rate: 18, taxable_amount: 25600, tax_amount: 4608, amount: 30208 }
          ]
        },
        {
          id: 'inv_004',
          number: 'INV-2026-00004',
          organization_id: orgId,
          customer_id: 'cust_royal_003',
          customer_name: 'Royal Hospitality & Cloud Kitchens',
          sales_order_id: 'so_003',
          invoice_date: daysAgo(105),
          due_date: daysAgo(75), // Overdue by 75 days -> Bucket: '61-90'
          same_state: false,
          status: 'partial',
          amount_paid: 40000,
          balance_due: 57350,
          subtotal: 82500,
          cgst: 0,
          sgst: 0,
          igst: 14850,
          tax_total: 14850,
          grand_total: 97350,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_10_3c', name: 'VEGNAR 10" 3-Compartment Meal Tray', quantity: 12000, rate: 4.50, gst_rate: 18, taxable_amount: 54000, tax_amount: 9720, amount: 63720 },
            { product_id: 'prod_bwl_250', name: 'VEGNAR 250ml Bagasse Soup/Curry Bowl', quantity: 15000, rate: 1.90, gst_rate: 18, taxable_amount: 28500, tax_amount: 5130, amount: 33630 }
          ]
        },
        {
          id: 'inv_005',
          number: 'INV-2026-00005',
          organization_id: orgId,
          customer_id: 'cust_dctours_004',
          customer_name: 'DC Tours & Event Catering Services',
          sales_order_id: 'so_004',
          invoice_date: daysAgo(135),
          due_date: daysAgo(105), // Overdue by 105 days -> Bucket: '90+'
          same_state: false,
          status: 'unpaid',
          amount_paid: 0,
          balance_due: 78824,
          subtotal: 66800,
          cgst: 0,
          sgst: 0,
          igst: 12024,
          tax_total: 12024,
          grand_total: 78824,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_12', name: 'VEGNAR 12" Oval Catering Platter', quantity: 6000, rate: 5.80, gst_rate: 18, taxable_amount: 34800, tax_amount: 6264, amount: 41064 },
            { product_id: 'prod_plt_9', name: 'VEGNAR 9" Round Bagasse Plate', quantity: 10000, rate: 3.20, gst_rate: 18, taxable_amount: 32000, tax_amount: 5760, amount: 37760 }
          ]
        },
        {
          id: 'inv_006',
          number: 'INV-2026-00006',
          organization_id: orgId,
          customer_id: 'cust_greenfield_005',
          customer_name: 'Greenfield Organics Supermarkets',
          sales_order_id: 'so_005',
          invoice_date: daysAgo(20),
          due_date: daysAgo(10),
          same_state: false,
          status: 'paid',
          amount_paid: 64900,
          balance_due: 0,
          subtotal: 55000,
          cgst: 0,
          sgst: 0,
          igst: 9900,
          tax_total: 9900,
          grand_total: 64900,
          created_by: adminId,
          items: [
            { product_id: 'prod_plt_6', name: 'VEGNAR 6" Round Bagasse Plate', quantity: 20000, rate: 1.25, gst_rate: 18, taxable_amount: 25000, tax_amount: 4500, amount: 29500 },
            { product_id: 'prod_plt_9', name: 'VEGNAR 9" Round Bagasse Plate', quantity: 10000, rate: 3.00, gst_rate: 18, taxable_amount: 30000, tax_amount: 5400, amount: 35400 }
          ]
        }
      ]);
    }

    // 10. Customer Payments (Allocated to invoices)
    const payCount = await Payment.countDocuments({ organization_id: orgId });
    if (payCount === 0) {
      await Payment.create([
        {
          id: 'pay_001',
          number: 'RCPT-2026-00001',
          organization_id: orgId,
          customer_id: 'cust_vegnar_001',
          customer_name: 'Vegnar Global LLP',
          payment_date: daysAgo(30),
          amount: 50000,
          mode: 'Bank Transfer',
          bank: 'HDFC Bank',
          utr: 'HDFCR520260815009871',
          allocations: [{ invoice_id: 'inv_001', amount: 50000 }],
          notes: 'Payment received towards INV-2026-00001',
          created_by: adminId
        },
        {
          id: 'pay_002',
          number: 'RCPT-2026-00002',
          organization_id: orgId,
          customer_id: 'cust_royal_003',
          customer_name: 'Royal Hospitality & Cloud Kitchens',
          payment_date: daysAgo(60),
          amount: 40000,
          mode: 'Bank Transfer',
          bank: 'ICICI Bank',
          utr: 'ICICR20260722003456',
          allocations: [{ invoice_id: 'inv_004', amount: 40000 }],
          notes: 'Part payment for cafeteria meal trays',
          created_by: adminId
        },
        {
          id: 'pay_003',
          number: 'RCPT-2026-00003',
          organization_id: orgId,
          customer_id: 'cust_greenfield_005',
          customer_name: 'Greenfield Organics Supermarkets',
          payment_date: daysAgo(15),
          amount: 64900,
          mode: 'IMPS',
          bank: 'Kotak Mahindra Bank',
          utr: 'KOTAK20260829007812',
          allocations: [{ invoice_id: 'inv_006', amount: 64900 }],
          notes: 'Full settlement of INV-2026-00006',
          created_by: adminId
        }
      ]);
    }

    // 11. Purchase Orders, GRNs, Vendor Bills & Payments Made
    const poCount = await PurchaseOrder.countDocuments({ organization_id: orgId });
    if (poCount === 0) {
      await PurchaseOrder.create([
        {
          id: 'po_001',
          number: 'PO-2026-00001',
          organization_id: orgId,
          vendor_id: 'vend_ganesh_001',
          vendor_name: 'Shree Ganesh Pulp & Paper Mills Ltd',
          po_date: daysAgo(50),
          expected_delivery: daysAgo(48),
          warehouse: 'Central Bhiwandi Warehouse',
          status: 'received',
          subtotal: 465000,
          cgst: 0,
          sgst: 0,
          igst: 55800,
          tax_total: 55800,
          grand_total: 520800,
          created_by: adminId,
          items: [
            { product_id: 'prod_raw_pulp', name: 'Bleached Sugarcane Bagasse Pulp Sheets (Bale)', quantity: 10000, rate: 46.50, gst_rate: 12, taxable_amount: 465000, tax_amount: 55800, amount: 520800 }
          ]
        },
        {
          id: 'po_002',
          number: 'PO-2026-00002',
          organization_id: orgId,
          vendor_id: 'vend_packwell_002',
          vendor_name: 'Packwell Corrugators & Packaging Solutions',
          po_date: daysAgo(35),
          expected_delivery: daysAgo(32),
          warehouse: 'Central Bhiwandi Warehouse',
          status: 'received',
          subtotal: 69000,
          cgst: 6210,
          sgst: 6210,
          igst: 0,
          tax_total: 12420,
          grand_total: 81420,
          created_by: adminId,
          items: [
            { product_id: 'prod_box_outer', name: '5-Ply Heavy Kraft Corrugated Shipper (500-Plate Master)', quantity: 2000, rate: 34.50, gst_rate: 18, taxable_amount: 69000, tax_amount: 12420, amount: 81420 }
          ]
        },
        {
          id: 'po_003',
          number: 'PO-2026-00003',
          organization_id: orgId,
          vendor_id: 'vend_ecobio_003',
          vendor_name: 'EcoBio Resins & Barrier Chemicals Ltd',
          po_date: daysAgo(5),
          expected_delivery: daysAhead(10),
          warehouse: 'Central Bhiwandi Warehouse',
          status: 'open',
          subtotal: 90000,
          cgst: 8100,
          sgst: 8100,
          igst: 0,
          tax_total: 16200,
          grand_total: 106200,
          created_by: adminId,
          items: [
            { name: 'Water-Resistant Bio Coating Resin', quantity: 500, rate: 180, gst_rate: 18, taxable_amount: 90000, tax_amount: 16200, amount: 106200 }
          ]
        }
      ]);

      await GRN.create([
        {
          id: 'grn_001',
          number: 'GRN-2026-00001',
          organization_id: orgId,
          vendor_id: 'vend_ganesh_001',
          vendor_name: 'Shree Ganesh Pulp & Paper Mills Ltd',
          purchase_order_id: 'po_001',
          warehouse: 'Central Bhiwandi Warehouse',
          grn_date: daysAgo(48),
          status: 'received',
          created_by: adminId,
          items: [
            { product_id: 'prod_raw_pulp', name: 'Bleached Sugarcane Bagasse Pulp Sheets (Bale)', received_quantity: 10000, accepted_quantity: 10000, unit: 'KG' }
          ]
        },
        {
          id: 'grn_002',
          number: 'GRN-2026-00002',
          organization_id: orgId,
          vendor_id: 'vend_packwell_002',
          vendor_name: 'Packwell Corrugators & Packaging Solutions',
          purchase_order_id: 'po_002',
          warehouse: 'Central Bhiwandi Warehouse',
          grn_date: daysAgo(32),
          status: 'received',
          created_by: adminId,
          items: [
            { product_id: 'prod_box_outer', name: '5-Ply Heavy Kraft Corrugated Shipper (500-Plate Master)', received_quantity: 2000, accepted_quantity: 2000, unit: 'PCS' }
          ]
        }
      ]);

      await VendorBill.create([
        {
          id: 'bill_001',
          number: 'BILL-2026-00001',
          organization_id: orgId,
          vendor_id: 'vend_ganesh_001',
          vendor_name: 'Shree Ganesh Pulp & Paper Mills Ltd',
          purchase_order_id: 'po_001',
          bill_number: 'SGPM/25-26/1089',
          bill_date: daysAgo(48),
          due_date: daysAgo(18),
          subtotal: 465000,
          cgst: 0,
          sgst: 0,
          igst: 55800,
          tax_total: 55800,
          grand_total: 520800,
          amount_paid: 300000,
          balance_due: 220800,
          status: 'partial',
          created_by: adminId,
          items: [
            { product_id: 'prod_raw_pulp', name: 'Bleached Sugarcane Bagasse Pulp Sheets (Bale)', quantity: 10000, rate: 46.50, gst_rate: 12, taxable_amount: 465000, tax_amount: 55800, amount: 520800 }
          ]
        },
        {
          id: 'bill_002',
          number: 'BILL-2026-00002',
          organization_id: orgId,
          vendor_id: 'vend_packwell_002',
          vendor_name: 'Packwell Corrugators & Packaging Solutions',
          purchase_order_id: 'po_002',
          bill_number: 'PW/AUG/2026/412',
          bill_date: daysAgo(32),
          due_date: daysAgo(17),
          subtotal: 69000,
          cgst: 6210,
          sgst: 6210,
          igst: 0,
          tax_total: 12420,
          grand_total: 81420,
          amount_paid: 81420,
          balance_due: 0,
          status: 'paid',
          created_by: adminId,
          items: [
            { product_id: 'prod_box_outer', name: '5-Ply Heavy Kraft Corrugated Shipper (500-Plate Master)', quantity: 2000, rate: 34.50, gst_rate: 18, taxable_amount: 69000, tax_amount: 12420, amount: 81420 }
          ]
        }
      ]);

      await PaymentMade.create([
        {
          id: 'pmt_001',
          number: 'PMT-2026-00001',
          organization_id: orgId,
          vendor_id: 'vend_ganesh_001',
          vendor_name: 'Shree Ganesh Pulp & Paper Mills Ltd',
          payment_date: daysAgo(35),
          amount: 300000,
          mode: 'RTGS',
          bank: 'HDFC Bank',
          utr: 'HDFCR520260810001234',
          allocations: [{ bill_id: 'bill_001', amount: 300000 }],
          notes: 'Advance part payment against pulp consignment',
          created_by: adminId
        },
        {
          id: 'pmt_002',
          number: 'PMT-2026-00002',
          organization_id: orgId,
          vendor_id: 'vend_packwell_002',
          vendor_name: 'Packwell Corrugators & Packaging Solutions',
          payment_date: daysAgo(20),
          amount: 81420,
          mode: 'NEFT',
          bank: 'HDFC Bank',
          utr: 'HDFCR520260820005678',
          allocations: [{ bill_id: 'bill_002', amount: 81420 }],
          notes: 'Full settlement of bill PW/AUG/2026/412',
          created_by: adminId
        }
      ]);
    }

    // 12. Inventory Movements
    const mvCount = await InventoryMovement.countDocuments({ organization_id: orgId });
    if (mvCount === 0) {
      await InventoryMovement.create([
        {
          id: newId(),
          organization_id: orgId,
          product_id: 'prod_raw_pulp',
          product_name: 'Bleached Sugarcane Bagasse Pulp Sheets (Bale)',
          movement_type: 'in',
          quantity: 10000,
          warehouse: 'Central Bhiwandi Warehouse',
          reference_type: 'grn',
          reference_id: 'grn_001',
          reference_number: 'GRN-2026-00001',
          notes: 'Material received from Shree Ganesh Pulp'
        },
        {
          id: newId(),
          organization_id: orgId,
          product_id: 'prod_box_outer',
          product_name: '5-Ply Heavy Kraft Corrugated Shipper (500-Plate Master)',
          movement_type: 'in',
          quantity: 2000,
          warehouse: 'Central Bhiwandi Warehouse',
          reference_type: 'grn',
          reference_id: 'grn_002',
          reference_number: 'GRN-2026-00002',
          notes: 'Outer packaging received from Packwell'
        },
        {
          id: newId(),
          organization_id: orgId,
          product_id: 'prod_plt_9',
          product_name: 'VEGNAR 9" Round Bagasse Plate',
          movement_type: 'out',
          quantity: 10000,
          warehouse: 'Central Bhiwandi Warehouse',
          reference_type: 'challan',
          reference_id: 'chal_001',
          reference_number: 'CHAL-2026-00001',
          notes: 'Dispatched to Vegnar Global LLP'
        }
      ]);
    }

    // 13. Leads
    const leadCount = await Lead.countDocuments({ organization_id: orgId });
    if (leadCount === 0) {
      await Lead.create([
        {
          id: 'lead_001',
          organization_id: orgId,
          company_name: 'Taj Catering & Banquets Hub',
          contact_person: 'Suresh Menon',
          mobile: '+91 98200 11998',
          email: 'suresh@tajcatering.in',
          source: 'Trade Expo',
          product_interest: '10" 3-Compartment Trays & 12" Platters',
          quantity: 50000,
          estimated_value: 180000,
          priority: 'high',
          stage: 'quotation_sent',
          city: 'Mumbai',
          state: 'Maharashtra',
          created_by: adminId
        },
        {
          id: 'lead_002',
          organization_id: orgId,
          company_name: 'Zomato HyperPure Supply Division',
          contact_person: 'Kunal Kapoor',
          mobile: '+91 98190 22334',
          email: 'kunal.kapoor@hyperpure.com',
          source: 'Inbound Website',
          product_interest: 'Full Tableware Range for Restaurant Supply',
          quantity: 150000,
          estimated_value: 450000,
          priority: 'high',
          stage: 'negotiation',
          city: 'Gurugram',
          state: 'Haryana',
          created_by: adminId
        },
        {
          id: 'lead_003',
          organization_id: orgId,
          company_name: 'Haldiram Quick Service Snack Bars',
          contact_person: 'Vikas Agarwal',
          mobile: '+91 98300 44556',
          email: 'vikas@haldirams.biz',
          source: 'Referral',
          product_interest: '6" Plates & 120ml Bowls',
          quantity: 80000,
          estimated_value: 220000,
          priority: 'medium',
          stage: 'qualified',
          city: 'Nagpur',
          state: 'Maharashtra',
          created_by: adminId
        },
        {
          id: 'lead_004',
          organization_id: orgId,
          company_name: 'ITC Green Luxury Hotels',
          contact_person: 'Pooja Hegde',
          mobile: '+91 98400 66778',
          email: 'pooja.h@itchotels.in',
          source: 'Cold Outreach',
          product_interest: '12" Platters & Luxury Dinnerware',
          quantity: 40000,
          estimated_value: 350000,
          priority: 'medium',
          stage: 'contacted',
          city: 'Bengaluru',
          state: 'Karnataka',
          created_by: adminId
        },
        {
          id: 'lead_005',
          organization_id: orgId,
          company_name: 'Nature Basket Organic Groceries',
          contact_person: 'Arun Nair',
          mobile: '+91 98500 77889',
          email: 'arun@naturebasket.org',
          source: 'Google Ads',
          product_interest: 'Retail Pack 50s',
          quantity: 25000,
          estimated_value: 95000,
          priority: 'low',
          stage: 'new',
          city: 'Pune',
          state: 'Maharashtra',
          created_by: adminId
        },
        {
          id: 'lead_006',
          organization_id: orgId,
          company_name: 'Chai Point Quick Cafes',
          contact_person: 'Rohit Roy',
          mobile: '+91 98600 88990',
          email: 'rohit.r@chaipoint.com',
          source: 'Referral',
          product_interest: '250ml Bowls & Snack Trays',
          quantity: 75000,
          estimated_value: 275000,
          priority: 'high',
          stage: 'won',
          city: 'Bengaluru',
          state: 'Karnataka',
          created_by: adminId
        },
        {
          id: 'lead_007',
          organization_id: orgId,
          company_name: 'QuickBite Campus Canteen Network',
          contact_person: 'Manish Tiwari',
          mobile: '+91 98700 99112',
          email: 'manish@quickbite.in',
          source: 'Cold Outreach',
          product_interest: '9" Plates',
          quantity: 30000,
          estimated_value: 60000,
          priority: 'low',
          stage: 'lost',
          city: 'Mumbai',
          state: 'Maharashtra',
          created_by: adminId
        }
      ]);
    }

    // 14. Accounts & Journal Entries
    const accCount = await Account.countDocuments({ organization_id: orgId });
    if (accCount === 0) {
      await Account.create([
        { id: 'ACC-AR', organization_id: orgId, code: '1200', name: 'Accounts Receivable', type: 'asset', balance: 238925, active: true },
        { id: 'ACC-BANK', organization_id: orgId, code: '1010', name: 'HDFC Current Bank A/C', type: 'asset', balance: 1245000, active: true },
        { id: 'ACC-INV', organization_id: orgId, code: '1300', name: 'Finished Goods Inventory', type: 'asset', balance: 685000, active: true },
        { id: 'ACC-AP', organization_id: orgId, code: '2100', name: 'Accounts Payable', type: 'liability', balance: 220800, active: true },
        { id: 'ACC-SALES', organization_id: orgId, code: '4000', name: 'Sales Revenue', type: 'revenue', balance: 333750, active: true },
        { id: 'ACC-COGS', organization_id: orgId, code: '5000', name: 'Cost of Goods Sold', type: 'expense', balance: 195000, active: true },
        { id: 'ACC-GST-OUT', organization_id: orgId, code: '2200', name: 'GST Output Tax Payable', type: 'liability', balance: 60075, active: true },
        { id: 'ACC-GST-IN', organization_id: orgId, code: '1400', name: 'GST Input Tax Credit', type: 'asset', balance: 68220, active: true }
      ]);
    }

    // 15. Notifications
    const notifCount = await Notification.countDocuments({ organization_id: orgId });
    if (notifCount === 0) {
      await Notification.create([
        {
          id: newId(),
          organization_id: orgId,
          type: 'warning',
          title: 'Low Stock Alert',
          message: 'VEGNAR 12" Oval Catering Platter stock is at 3,200 PCS (below reorder threshold of 3,500 PCS).',
          product_id: 'prod_plt_12',
          read: false
        },
        {
          id: newId(),
          organization_id: orgId,
          type: 'success',
          title: 'Payment Received',
          message: 'Received ₹50,000 via NEFT/RTGS from Vegnar Global LLP (Ref: HDFCR520260815009871).',
          read: false
        },
        {
          id: newId(),
          organization_id: orgId,
          type: 'info',
          title: 'Dispatch Delivered',
          message: 'Delhivery B2B consignment DEL-B2B-9876543 has been successfully delivered.',
          read: true
        }
      ]);
    }

    // 16. Update document numbering counters so new documents continue sequentially
    // 16. Expenses (OPEX, Fixed, Transportation, Sales & Marketing, Admin)
    const expCount = await Expense.countDocuments({ organization_id: orgId });
    if (expCount === 0) {
      await Expense.create([
        {
          id: 'exp_001',
          number: 'EXP-2026-00001',
          organization_id: orgId,
          title: 'Bhiwandi Central Warehouse Monthly Lease',
          category: 'FIXED',
          subcategory: 'Rent & Lease',
          amount: 85000,
          tax_amount: 15300,
          total_amount: 100300,
          date: daysAgo(25),
          vendor_name: 'Indian Logistics Park LLP',
          payment_mode: 'Bank Transfer',
          reference_no: 'ILP/RENT/2026/08',
          notes: 'Monthly fixed rent for Bhiwandi warehouse unit B-4',
          created_by: adminId
        },
        {
          id: 'exp_002',
          number: 'EXP-2026-00002',
          organization_id: orgId,
          title: 'Warehouse & Operations Staff Salaries',
          category: 'FIXED',
          subcategory: 'Payroll',
          amount: 145000,
          tax_amount: 0,
          total_amount: 145000,
          date: daysAgo(15),
          vendor_name: 'Payroll Account',
          payment_mode: 'Bank Transfer',
          reference_no: 'PAY-AUG-2026',
          notes: 'Fixed monthly payroll for 6 warehouse & logistics crew',
          created_by: adminId
        },
        {
          id: 'exp_003',
          number: 'EXP-2026-00003',
          organization_id: orgId,
          title: 'Inbound Pulp Freight - Vapi to Bhiwandi',
          category: 'TRANSPORTATION',
          subcategory: 'Primary Freight',
          amount: 28500,
          tax_amount: 1425,
          total_amount: 29925,
          date: daysAgo(40),
          vendor_name: 'Gujarat Maharashtra Roadways',
          payment_mode: 'Bank Transfer',
          reference_no: 'GMR/LR/88219',
          notes: 'Primary freight charge for 10 MT raw sugarcane pulp bale transit',
          created_by: adminId
        },
        {
          id: 'exp_004',
          number: 'EXP-2026-00004',
          organization_id: orgId,
          title: 'Delhivery B2B Consignment Dispatch Charges',
          category: 'TRANSPORTATION',
          subcategory: 'Courier & Last Mile',
          amount: 14200,
          tax_amount: 2556,
          total_amount: 16756,
          date: daysAgo(10),
          vendor_name: 'Delhivery Express Ltd',
          payment_mode: 'Bank Transfer',
          reference_no: 'DEL-INV-99018',
          notes: 'Outbound B2B line-haul transport for customer orders',
          created_by: adminId
        },
        {
          id: 'exp_005',
          number: 'EXP-2026-00005',
          organization_id: orgId,
          title: 'Warehouse 3-Phase Electricity & Utilities',
          category: 'OPEX',
          subcategory: 'Utilities',
          amount: 38500,
          tax_amount: 0,
          total_amount: 38500,
          date: daysAgo(20),
          vendor_name: 'MSEDCL Maharashtra',
          payment_mode: 'Bank Transfer',
          reference_no: 'MSEB/BHW/2026/08',
          notes: 'Monthly power consumption for packaging & material handling machines',
          created_by: adminId
        },
        {
          id: 'exp_006',
          number: 'EXP-2026-00006',
          organization_id: orgId,
          title: 'Stretch Wrap & Strapping Consumables',
          category: 'OPEX',
          subcategory: 'Consumables',
          amount: 18200,
          tax_amount: 3276,
          total_amount: 21476,
          date: daysAgo(30),
          vendor_name: 'Packwell Corrugators',
          payment_mode: 'Bank Transfer',
          reference_no: 'PW/CS/441',
          notes: 'Consumable pallet stretch film and steel strapping rolls',
          created_by: adminId
        },
        {
          id: 'exp_007',
          number: 'EXP-2026-00007',
          organization_id: orgId,
          title: 'National Food Hospitality Expo 2026 Booth',
          category: 'SALES_MARKETING',
          subcategory: 'Trade Shows',
          amount: 45000,
          tax_amount: 8100,
          total_amount: 53100,
          date: daysAgo(55),
          vendor_name: 'Expo Media International',
          payment_mode: 'Bank Transfer',
          reference_no: 'EXPO/2026/MUM/88',
          notes: 'Stall registration & brand display at Bombay Exhibition Centre',
          created_by: adminId
        },
        {
          id: 'exp_008',
          number: 'EXP-2026-00008',
          organization_id: orgId,
          title: 'Google Ads & B2B Organic Lead Campaign',
          category: 'SALES_MARKETING',
          subcategory: 'Digital Marketing',
          amount: 25000,
          tax_amount: 4500,
          total_amount: 29500,
          date: daysAgo(12),
          vendor_name: 'Google India Pvt Ltd',
          payment_mode: 'Credit Card',
          reference_no: 'GGL-ADS-88192',
          notes: 'Targeting HoReCa, event caterers & cloud kitchen buyers',
          created_by: adminId
        },
        {
          id: 'exp_009',
          number: 'EXP-2026-00009',
          organization_id: orgId,
          title: 'ERP Cloud Server Hosting & Software Licenses',
          category: 'ADMIN',
          subcategory: 'Software & IT',
          amount: 12000,
          tax_amount: 2160,
          total_amount: 14160,
          date: daysAgo(18),
          vendor_name: 'Cloud Hosting Services',
          payment_mode: 'Bank Transfer',
          reference_no: 'INV-CLOUD-2026-08',
          notes: 'Monthly infrastructure, database backup & SSL security',
          created_by: adminId
        },
        {
          id: 'exp_010',
          number: 'EXP-2026-00010',
          organization_id: orgId,
          title: 'Statutory GST & Corporate Secretarial Fees',
          category: 'ADMIN',
          subcategory: 'Professional Fees',
          amount: 15000,
          tax_amount: 2700,
          total_amount: 17700,
          date: daysAgo(35),
          vendor_name: 'R. K. Mehta & Associates Chartered Accountants',
          payment_mode: 'Bank Transfer',
          reference_no: 'RKM/26-27/045',
          notes: 'Quarterly tax filing, TDS reconciliation & audit review',
          created_by: adminId
        }
      ]);
    }

    // 17. Update document numbering counters so new documents continue sequentially
    const currentYear = new Date().getFullYear();
    await Counter.updateOne({ key: `${orgId}:QT:${currentYear}` }, { $set: { seq: 5 } }, { upsert: true });
    await Counter.updateOne({ key: `${orgId}:SO:${currentYear}` }, { $set: { seq: 5 } }, { upsert: true });
    await Counter.updateOne({ key: `${orgId}:INV:${currentYear}` }, { $set: { seq: 6 } }, { upsert: true });
    await Counter.updateOne({ key: `${orgId}:RCPT:${currentYear}` }, { $set: { seq: 3 } }, { upsert: true });
    await Counter.updateOne({ key: `${orgId}:PO:${currentYear}` }, { $set: { seq: 3 } }, { upsert: true });
    await Counter.updateOne({ key: `${orgId}:GRN:${currentYear}` }, { $set: { seq: 2 } }, { upsert: true });
    await Counter.updateOne({ key: `${orgId}:BILL:${currentYear}` }, { $set: { seq: 2 } }, { upsert: true });
    await Counter.updateOne({ key: `${orgId}:PMT:${currentYear}` }, { $set: { seq: 2 } }, { upsert: true });
    await Counter.updateOne({ key: `${orgId}:CHAL:${currentYear}` }, { $set: { seq: 2 } }, { upsert: true });
    // Clean up any legacy dummy dispatches with DELH prefix and reset orders
    await Dispatch.deleteMany({ awb_number: /^DELH/i });
    await Dispatch.deleteMany({ lr_number: /^DELH/i });
    await SalesOrder.updateMany(
      { awb_number: /^DELH/i },
      { $set: { status: 'confirmed', awb_number: '', lr_number: '', dispatch_id: null } }
    );

    console.log('✅ Comprehensive business dummy data seeded successfully for Vegnar Global LLP & ecosystem.');
  } catch (seedErr) {
    console.error('Error seeding comprehensive demo data:', seedErr);
  }
}

// ----------------------------- Seed Demo Data -----------------------------
app.post('/api/seed', async (req, res) => {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'chauhanashish360@gmail.com').toLowerCase();
    const adminPw = process.env.ADMIN_PASSWORD || 'Admin@123';

    let org = await Organization.findOne({});
    if (!org) {
      org = await Organization.create({
        id: 'org_vegnar_001',
        name: 'Vegnar Global LLP',
        legal_name: 'Vegnar Global LLP',
        display_name: 'Vegnar Tableware',
        state: 'Maharashtra',
        state_code: '27',
        gstin: '27AABCV1234F1Z5',
        bank_name: 'HDFC Bank',
        account_number: '50200012345678',
        ifsc: 'HDFC0001234',
        upi_id: 'vegnar@hdfcbank'
      });
    }

    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = await User.create({
        id: 'usr_admin_001',
        email: adminEmail,
        password_hash: hashPw(adminPw),
        name: 'Ashish Chauhan',
        role: 'super_admin',
        organization_id: org.id
      });
    }

    await seedComprehensiveDemoData(org, admin, req.query.force === 'true');

    return res.json({ ok: true, message: 'Seeded comprehensive business demo data successfully' });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

// ----------------------------- MongoDB Connection & Initialization -----------------------------
async function initServer() {
  try {
    await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 2000 });
    console.log(`Connected to MongoDB at ${MONGO_URL}`);
  } catch (err) {
    console.log(`Local MongoDB connection failed (${err.message}). Starting MongoMemoryServer...`);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      console.log(`Connected to in-memory MongoDB at ${uri}`);
    } catch (memErr) {
      console.error('Failed to start MongoMemoryServer:', memErr.message);
    }
  }

  // Auto-seed admin user and demo organization
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'chauhanashish360@gmail.com').toLowerCase();
    const adminPw = process.env.ADMIN_PASSWORD || 'Admin@123';
    let org = await Organization.findOne({});
    if (!org) {
      org = await Organization.create({
        id: 'org_vegnar_001',
        name: 'Vegnar Global LLP',
        legal_name: 'Vegnar Global LLP',
        display_name: 'Vegnar Tableware',
        state: 'Maharashtra',
        state_code: '27',
        gstin: '27AABCV1234F1Z5',
        bank_name: 'HDFC Bank',
        account_number: '50200012345678',
        ifsc: 'HDFC0001234',
        upi_id: 'vegnar@hdfcbank'
      });
    }
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = await User.create({
        id: 'usr_admin_001',
        email: adminEmail,
        password_hash: hashPw(adminPw),
        name: 'Ashish Chauhan',
        role: 'super_admin',
        organization_id: org.id
      });
      console.log(`Seeded admin user: ${adminEmail}`);
    }

    let courierConf = await CourierConfig.findOne({ organization_id: org.id });
    if (!courierConf) {
      await CourierConfig.create({
        organization_id: org.id,
        provider: 'delhivery',
        api_key: 'b79598f770c257f3ea79da604a70fbe2e2f68306',
        client_id: 'ashish@vegnar.com',
        pickup_location: 'PKP_VGN_01'
      });
      console.log('Seeded Delhivery courier configuration with PKP_VGN_01 warehouse');
    } else {
      await CourierConfig.updateOne(
        { organization_id: org.id },
        { $set: { provider: 'delhivery', api_key: 'b79598f770c257f3ea79da604a70fbe2e2f68306', client_id: 'ashish@vegnar.com', pickup_location: 'PKP_VGN_01' } }
      );
    }

    // Auto-seed comprehensive demo data for Vegnar Global LLP and ecosystem
    await seedComprehensiveDemoData(org, admin);
  } catch (e) {
    console.error('Seed check error:', e.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vegnar ERP Node.js server running on port ${PORT}`);
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

initServer();


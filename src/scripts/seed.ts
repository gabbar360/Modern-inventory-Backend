import { connectDB } from '../config/database';
import { authService } from '../modules/auth/auth.service';
import { productsService } from '../modules/products/products.service';
import { salesService } from '../modules/sales/sales.service';
import { inventoryService } from '../modules/inventory/inventory.service';
import { logger } from '../config/logger';

async function seed() {
  logger.info('🌱 Starting database seed script...');
  await connectDB();

  // 1. Admin User
  await authService.seedDefaultAdmin();

  // 2. Demo Warehouse
  const orgId = 'org_vegnar_01';
  await inventoryService.createWarehouse({
    name: 'Main Central Warehouse',
    code: 'WH-MAIN-01',
    location: 'Mumbai, India',
    capacity: 50000
  }, orgId);

  // 3. Demo Products
  await productsService.create({
    name: 'Industrial Valve A1',
    sku: 'SKU-VALVE-01',
    category: 'Hardware',
    price: 1500,
    cost_price: 900,
    stock_quantity: 120
  }, orgId);

  await productsService.create({
    name: 'Hydraulic Cylinder X200',
    sku: 'SKU-HYD-200',
    category: 'Machinery',
    price: 12500,
    cost_price: 8500,
    stock_quantity: 45
  }, orgId);

  // 4. Demo Customer
  await salesService.createCustomer({
    name: 'Acme Enterprises Ltd',
    email: 'purchasing@acme.com',
    phone: '+91 9876543210',
    company: 'Acme Ltd',
    address: 'Andheri East, Mumbai',
    gstin: '27AAAAA0000A1Z5'
  }, orgId);

  logger.info('✅ Seeding completed successfully!');
  process.exit(0);
}

seed().catch(err => {
  logger.error('❌ Seeding failed:', err);
  process.exit(1);
});

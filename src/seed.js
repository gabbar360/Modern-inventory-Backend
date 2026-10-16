import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Role } from './models/Role.js';
import { Organization } from './models/Organization.js';
import { User } from './models/User.js';

// ── System Roles ──────────────────────────────────────────────────────────────
const SYSTEM_ROLES = [
  { name: 'Super Admin', slug: 'SUPER_ADMIN', is_system: true },
  { name: 'Admin',       slug: 'admin',       is_system: true },
  { name: 'Manager',     slug: 'manager',     is_system: true },
  { name: 'Sales',       slug: 'sales',       is_system: true },
  { name: 'Inventory',   slug: 'inventory',   is_system: true },
  { name: 'Accountant',  slug: 'accountant',  is_system: true },
  { name: 'Viewer',      slug: 'viewer',      is_system: true },
];

// ── Company Details ───────────────────────────────────────────────────────────
const COMPANY = {
  name:           'Vegnar Global LLP',
  legal_name:     'Vegnar Global LLP',
  display_name:   'Vegnar Tableware',
  email:          'vegnarglobal@gmail.com',
  phone:          '9998040482',
  website:        'https://vegnar.com',
  address:        'RK Iconic B623, 150 Feet Ring Rd, Sheetal Park, Puneet Nagar, Bajrang Wadi, Rajkot, Gujarat 360006',
  city:           'Rajkot',
  state:          'Gujarat',
  state_code:     '24',
  country:        'India',
  pin:            '360007',
  gstin:          '24ABAFV3901A1ZV',
  pan:            'ABAFV3901A',
  cin:            '',
  tan:            'RKTV06637B',
  bank_name:      'AXIS Bank',
  account_holder: 'Vegnar Global LLP',
  account_number: '925020013383048',
  ifsc:           'UTIB0005420',
  swift:          'AXISINBB087',
  branch:         'Rajkot Branch KKV Road',
  upi_id:         'vegnar@axisbank',
};

// ── Super Admin Credentials ───────────────────────────────────────────────────
const SUPER_ADMIN = {
  name:     'Super Admin',
  email:    'superadmin@vegnar.com',
  password: 'Pass@1234',
};

// ── Seed ──────────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 5000 });
  console.log('✅  MongoDB connected\n');

  // 1. Roles
  console.log('── Seeding roles ─────────────────────────────────');
  for (const r of SYSTEM_ROLES) {
    const exists = await Role.findOne({ slug: r.slug });
    if (exists) {
      console.log(`   ⚠️   Already exists : ${r.slug}`);
    } else {
      await Role.create(r);
      console.log(`   ✅  Created        : ${r.slug}`);
    }
  }

  // 2. Organization
  console.log('\n── Seeding organization ──────────────────────────────');
  let org = await Organization.findOne({ name: COMPANY.name });
  if (org) {
    console.log(`   ⚠️   Already exists : ${org.name} (${org._id})`);
  } else {
    org = await Organization.create(COMPANY);
    console.log(`   ✅  Created : ${org.name} (${org._id})`);
  }

  // 3. SUPER_ADMIN user
  console.log('\n── Seeding super admin user ──────────────────────────');
  const existingUser = await User.findOne({ email: SUPER_ADMIN.email.toLowerCase() });
  if (existingUser) {
    if (!existingUser.organization_id) {
      existingUser.organization_id = org._id;
      await existingUser.save();
      console.log(`   🔧  Fixed organization_id for : ${existingUser.email}`);
    } else {
      console.log(`   ⚠️   Already exists : ${existingUser.email}`);
    }
    await mongoose.disconnect();
    return;
  }

  const superAdminRole = await Role.findOne({ slug: 'SUPER_ADMIN' });
  const password_hash  = await bcrypt.hash(SUPER_ADMIN.password, 10);

  const user = await User.create({
    name:            SUPER_ADMIN.name,
    email:           SUPER_ADMIN.email.toLowerCase(),
    password_hash,
    roleId:          superAdminRole._id,
    organization_id: org._id,
    status:          'active',
  });

  console.log(`   ✅  SUPER_ADMIN created:`);
  console.log(`        Email           : ${SUPER_ADMIN.email}`);
  console.log(`        Password        : ${SUPER_ADMIN.password}`);
  console.log(`        Role            : SUPER_ADMIN`);
  console.log(`        organization_id : ${user.organization_id}`);
  console.log(`        Org             : ${org.name}`);
  console.log('\n🎉  Seed complete. You can now login.');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});

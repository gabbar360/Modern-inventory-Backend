import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ── Models ────────────────────────────────────────────────────────────────────
const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  is_system: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
});

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
  organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
  phone: { type: String, default: '' },
  status: { type: String, default: 'active' },
  created_at: { type: Date, default: Date.now },
});

const Role = mongoose.models.Role || mongoose.model('Role', RoleSchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);

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

// ── Config from .env ──────────────────────────────────────────────────────────
const { MONGO_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'Super Admin' } = process.env;

if (!MONGO_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('❌  Missing required env vars: MONGO_URL, ADMIN_EMAIL, ADMIN_PASSWORD');
  process.exit(1);
}

// ── Seed ──────────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 5000 });
  console.log('✅  MongoDB connected\n');

  // 1. Roles seed karo
  console.log('── Seeding roles ────────────────────────────');
  for (const r of SYSTEM_ROLES) {
    const existing = await Role.findOne({ slug: r.slug });
    if (existing) {
      console.log(`   ⚠️  Role already exists: ${r.slug}`);
    } else {
      await Role.create(r);
      console.log(`   ✅  Role created: ${r.slug}`);
    }
  }

  // 2. SUPER_ADMIN user seed karo
  console.log('\n── Seeding super admin user ─────────────────');
  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    console.log(`   ⚠️  User already exists: ${existing.email}`);
    console.log('        Delete the user from DB first to re-seed.');
    await mongoose.disconnect();
    return;
  }

  const superAdminRole = await Role.findOne({ slug: 'SUPER_ADMIN' });
  const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL.toLowerCase(),
    password_hash,
    roleId: superAdminRole._id,   // Role reference
    organization_id: null,        // SUPER_ADMIN ko organization nahi chahiye
    status: 'active',
  });

  console.log(`   ✅  SUPER_ADMIN created:`);
  console.log(`        Email    : ${ADMIN_EMAIL}`);
  console.log(`        Password : ${ADMIN_PASSWORD}`);
  console.log(`        Role     : SUPER_ADMIN (${superAdminRole._id})`);
  console.log(`        Org      : none`);
  console.log('\n🎉  Seed complete. You can now login.');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});

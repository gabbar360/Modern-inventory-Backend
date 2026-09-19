export const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
  USER: 'User',
} as const;

export const PERMISSIONS = {
  // Sales
  SALES_VIEW: 'sales:view',
  SALES_CREATE: 'sales:create',
  SALES_EDIT: 'sales:edit',
  SALES_DELETE: 'sales:delete',
  SALES_APPROVE: 'sales:approve',
  SALES_EXPORT: 'sales:export',

  // Inventory
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_EDIT: 'inventory:edit',
  INVENTORY_DELETE: 'inventory:delete',
  INVENTORY_TRANSFER: 'inventory:transfer',
  INVENTORY_ADJUST: 'inventory:adjust',

  // Purchase
  PURCHASE_VIEW: 'purchase:view',
  PURCHASE_CREATE: 'purchase:create',
  PURCHASE_EDIT: 'purchase:edit',
  PURCHASE_DELETE: 'purchase:delete',

  // Finance
  FINANCE_VIEW: 'finance:view',
  FINANCE_MANAGE: 'finance:manage',

  // Settings & Users
  USERS_MANAGE: 'users:manage',
  ROLES_MANAGE: 'roles:manage',
  SETTINGS_MANAGE: 'settings:manage',
} as const;

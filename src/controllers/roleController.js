import { Role } from '../models/Role.js';
import { User } from '../models/User.js';

// GET /roles — sabhi roles
export const getRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ created_at: 1 });
    res.json(roles);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

// GET /roles/:id — single role
export const getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ detail: 'Role not found' });
    res.json(role);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

// POST /roles — naya role banao (sirf SUPER_ADMIN)
export const createRole = async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug)
      return res.status(400).json({ detail: 'name and slug are required' });

    const existing = await Role.findOne({ slug });
    if (existing)
      return res.status(400).json({ detail: `Role with slug '${slug}' already exists` });

    const role = await Role.create({ name, slug, is_system: false });
    res.status(201).json(role);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

// PATCH /roles/:id — role update karo (sirf SUPER_ADMIN)
export const updateRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ detail: 'Role not found' });

    const { name, slug } = req.body;

    // system role ka slug change nahi ho sakta
    if (role.is_system && slug && slug !== role.slug)
      return res.status(400).json({ detail: 'Cannot change slug of a system role' });

    if (slug && slug !== role.slug) {
      const existing = await Role.findOne({ slug });
      if (existing)
        return res.status(400).json({ detail: `Role with slug '${slug}' already exists` });
    }

    if (name) role.name = name;
    if (slug && !role.is_system) role.slug = slug;
    await role.save();

    res.json(role);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

// DELETE /roles/:id — role delete karo (sirf SUPER_ADMIN, system roles nahi)
export const deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ detail: 'Role not found' });

    if (role.is_system)
      return res.status(400).json({ detail: 'System roles cannot be deleted' });

    // Check karo koi user is role pe hai toh nahi
    const usersWithRole = await User.countDocuments({ roleId: role._id });
    if (usersWithRole > 0)
      return res.status(400).json({
        detail: `Cannot delete role. ${usersWithRole} user(s) are assigned this role.`,
      });

    await role.deleteOne();
    res.json({ success: true, message: 'Role deleted' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export default { getRoles, getRoleById, createRole, updateRole, deleteRole };

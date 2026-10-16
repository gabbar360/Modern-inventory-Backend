import Organization from '../models/Organization.js';
import User from '../models/User.js';

export const updateOrganization = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user?.organization_id)
      return res.status(400).json({ detail: 'No organization linked to this account' });

    const allowed = ['name','legal_name','display_name','logo','email','phone','website',
      'address','city','state','state_code','country','pin',
      'gstin','pan','cin','tan',
      'bank_name','account_holder','account_number','ifsc','swift','branch','upi_id'];

    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const org = await Organization.findByIdAndUpdate(
      user.organization_id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!org) return res.status(404).json({ detail: 'Organization not found' });
    res.json({ organization: org });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    const users = await User.find({ organization_id: req.user.organization_id }).select('-password_hash');
    res.json(users);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const inviteUser = async (req, res) => {
  res.status(201).json({ success: true, message: 'User invited successfully' });
};

export const updateUserRole = async (req, res) => {
  res.json({ success: true, message: 'User role updated' });
};

export default { updateOrganization, getUsers, inviteUser, updateUserRole };

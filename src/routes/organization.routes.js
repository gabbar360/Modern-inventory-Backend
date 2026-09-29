import express from 'express';
import organizationController from '../controllers/organizationController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.patch('/organization', organizationController.updateOrganization);
router.post('/custom-fields', organizationController.saveCustomFields);
router.post('/import', organizationController.importData);
router.get('/users', organizationController.getUsers);
router.post('/users', organizationController.inviteUser);
router.patch('/users/:id/role', organizationController.updateUserRole);

export default router;

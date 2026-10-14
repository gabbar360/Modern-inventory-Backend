import express from 'express';
import roleController from '../controllers/roleController.js';
import { authenticateToken } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/',        roleController.getRoles);
router.get('/:id',     roleController.getRoleById);
router.post('/',       requireRole(['SUPER_ADMIN']), roleController.createRole);
router.patch('/:id',   requireRole(['SUPER_ADMIN']), roleController.updateRole);
router.delete('/:id',  requireRole(['SUPER_ADMIN']), roleController.deleteRole);

export default router;

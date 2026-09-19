import { Router } from 'express';
import { productsController } from './products.controller';
import { authMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);
router.get('/', productsController.getAll);
router.get('/:id', productsController.getById);
router.post('/', productsController.create);
router.put('/:id', productsController.update);
router.delete('/:id', productsController.delete);

export default router;

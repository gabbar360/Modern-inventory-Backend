import express from 'express';
import productController from '../controllers/productController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/products', productController.getProducts);
router.get('/products/:id', productController.getProductById);
router.post('/products', productController.createProduct);
router.put('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

export default router;

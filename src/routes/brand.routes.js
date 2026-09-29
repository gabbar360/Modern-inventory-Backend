import express from 'express';
import brandController from '../controllers/brandController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/brands', brandController.getBrands);
router.post('/brands', brandController.createBrand);

export default router;

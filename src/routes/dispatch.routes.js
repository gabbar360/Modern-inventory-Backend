import express from 'express';
import dispatchController from '../controllers/dispatchController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/dispatches', dispatchController.getDispatches);
router.post('/dispatches', dispatchController.createDispatch);
router.get('/dispatches/:id/track', dispatchController.trackDispatch);
router.delete('/dispatches/:id', dispatchController.cancelDispatch);
router.post('/dispatch/schedule', dispatchController.createDispatch);

router.get('/gst/pincode-distance/:pincode', dispatchController.getPincodeInfo);
router.get('/utils/pincode/:pincode', dispatchController.getPincodeInfo);
router.post('/delhivery/freight-estimate', dispatchController.getFreightEstimate);
router.get('/courier/config', dispatchController.getCourierConfig);

export default router;

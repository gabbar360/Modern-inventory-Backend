import express from 'express';
import taskController from '../controllers/taskController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/tasks', taskController.getTasks);
router.post('/tasks', taskController.createTask);
router.patch('/tasks/:id', taskController.updateTask);

export default router;

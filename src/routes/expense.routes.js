import express from 'express';
import expenseController from '../controllers/expenseController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', expenseController.getExpenses);
router.get('/summary', expenseController.getExpenseSummary);
router.post('/', expenseController.createExpense);
router.delete('/:id', expenseController.deleteExpense);

export default router;

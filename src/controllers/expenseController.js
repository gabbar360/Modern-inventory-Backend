const { v4: uuidv4 } = require('uuid');
const { Expense } = require('../models/Inventory');

exports.getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ organization_id: req.user.organization_id }).sort({ date: -1, created_at: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getExpenseSummary = async (req, res) => {
  try {
    const expenses = await Expense.find({ organization_id: req.user.organization_id });
    
    let totalExpenses = 0;
    let totalTax = 0;
    const categoryTotals = {
      OPEX: 0,
      FIXED: 0,
      TRANSPORTATION: 0,
      SALES_MARKETING: 0,
      ADMIN: 0,
      COGS: 0,
      OTHER: 0
    };

    expenses.forEach((exp) => {
      const amt = Number(exp.amount || 0);
      const tax = Number(exp.tax_amount || 0);
      totalExpenses += amt;
      totalTax += tax;

      const cat = exp.category || 'OTHER';
      if (categoryTotals[cat] !== undefined) {
        categoryTotals[cat] += amt;
      } else {
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
      }
    });

    res.json({
      total_expenses: totalExpenses,
      total_tax: totalTax,
      count: expenses.length,
      category_totals: categoryTotals,
      opex_total: categoryTotals.OPEX || 0,
      fixed_total: categoryTotals.FIXED || 0
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const { title, category, subcategory, amount, tax_amount, date, vendor_name, payment_mode, reference_no, notes, description } = req.body;
    
    if (!amount) {
      return res.status(400).json({ detail: 'Amount is required' });
    }

    const id = `exp_${uuidv4().slice(0, 8)}`;
    const expenseDate = date ? new Date(date) : new Date();

    const expense = new Expense({
      id,
      organization_id: req.user.organization_id,
      title: title || category || 'Expense',
      category: category || 'OPEX',
      subcategory: subcategory || '',
      amount: Number(amount),
      tax_amount: Number(tax_amount || 0),
      payment_mode: payment_mode || 'Bank Transfer',
      reference_no: reference_no || '',
      vendor_name: vendor_name || '',
      notes: notes || '',
      description: description || notes || title || '',
      date: expenseDate,
      expense_date: expenseDate
    });

    await expense.save();
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Expense.findOneAndDelete({ id, organization_id: req.user.organization_id });
    if (!deleted) {
      return res.status(404).json({ detail: 'Expense record not found' });
    }
    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

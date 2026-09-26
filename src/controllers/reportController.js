const { Invoice, Quotation, SalesOrder } = require('../models/Invoice');
const { Product } = require('../models/Product');
const { Customer } = require('../models/Customer');
const { Expense } = require('../models/Inventory');

exports.getDashboardMetrics = async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    const [invoices, customers, products, expenses] = await Promise.all([
      Invoice.find({ organization_id: orgId }),
      Customer.find({ organization_id: orgId }),
      Product.find({ organization_id: orgId }),
      Expense.find({ organization_id: orgId })
    ]);

    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
    const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const outstandingReceivables = invoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const lowStockCount = products.filter(p => p.stock <= (p.min_stock_alert || 5)).length;

    res.json({
      total_revenue: totalRevenue,
      total_invoiced: totalInvoiced,
      outstanding_receivables: outstandingReceivables,
      total_customers: customers.length,
      total_products: products.length,
      total_expenses: totalExpenses,
      low_stock_count: lowStockCount,
      total_invoices_count: invoices.length
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getPnLAnalytics = async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    const [invoices, expenses] = await Promise.all([
      Invoice.find({ organization_id: orgId }),
      Expense.find({ organization_id: orgId })
    ]);

    const grossSales = invoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
    const totalTaxCollected = invoices.reduce((sum, inv) => sum + (inv.total_tax || 0), 0);
    const operatingExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const netProfit = grossSales - operatingExpenses;

    res.json({
      gross_sales: grossSales,
      tax_collected: totalTaxCollected,
      operating_expenses: operatingExpenses,
      net_profit: netProfit,
      margin_percentage: grossSales > 0 ? Number(((netProfit / grossSales) * 100).toFixed(2)) : 0
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getPnLInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({ organization_id: req.user.organization_id });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getPnLProducts = async (req, res) => {
  try {
    const products = await Product.find({ organization_id: req.user.organization_id });
    res.json(products);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getDetailedMonthlyPl = async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const [invoices, expenses] = await Promise.all([
      Invoice.find({ organization_id: orgId }),
      Expense.find({ organization_id: orgId })
    ]);

    const monthlyData = {};
    invoices.forEach((inv) => {
      const dateStr = inv.invoice_date || inv.created_at;
      const month = dateStr ? new Date(dateStr).toISOString().slice(0, 7) : 'Unknown';
      if (!monthlyData[month]) monthlyData[month] = { month, sales: 0, expenses: 0, profit: 0 };
      monthlyData[month].sales += (inv.subtotal || inv.total || 0);
    });

    expenses.forEach((exp) => {
      const dateStr = exp.date || exp.expense_date || exp.created_at;
      const month = dateStr ? new Date(dateStr).toISOString().slice(0, 7) : 'Unknown';
      if (!monthlyData[month]) monthlyData[month] = { month, sales: 0, expenses: 0, profit: 0 };
      monthlyData[month].expenses += (exp.amount || 0);
    });

    Object.values(monthlyData).forEach((m) => {
      m.profit = m.sales - m.expenses;
    });

    res.json(Object.values(monthlyData));
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ organization_id: req.user.organization_id }).sort({ expense_date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getGstSummary = async (req, res) => {
  try {
    const invoices = await Invoice.find({ organization_id: req.user.organization_id });
    const totalTaxable = invoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
    const totalCgst = invoices.reduce((sum, inv) => sum + (inv.cgst || 0), 0);
    const totalSgst = invoices.reduce((sum, inv) => sum + (inv.sgst || 0), 0);
    const totalIgst = invoices.reduce((sum, inv) => sum + (inv.igst || 0), 0);
    const totalTax = invoices.reduce((sum, inv) => sum + (inv.total_tax || 0), 0);

    res.json({
      total_taxable: totalTaxable,
      total_cgst: totalCgst,
      total_sgst: totalSgst,
      total_igst: totalIgst,
      total_tax: totalTax
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getReceivablesAging = async (req, res) => {
  try {
    const invoices = await Invoice.find({ organization_id: req.user.organization_id, status: { $ne: 'paid' } });
    const now = new Date();
    
    let current = 0;
    let days30 = 0;
    let days60 = 0;
    let days90Plus = 0;

    invoices.forEach((inv) => {
      const due = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date || inv.created_at);
      const diffDays = Math.floor((now - due) / (1000 * 60 * 60 * 24));
      const bal = inv.balance_due || inv.total || 0;

      if (diffDays <= 0) current += bal;
      else if (diffDays <= 30) days30 += bal;
      else if (diffDays <= 60) days60 += bal;
      else days90Plus += bal;
    });

    res.json({
      current,
      days_1_30: days30,
      days_31_60: days60,
      days_61_plus: days90Plus,
      total_due: current + days30 + days60 + days90Plus
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

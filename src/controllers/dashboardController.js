import { Invoice } from '../models/Invoice.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Expense } from '../models/Expense.js';
import { Quotation } from '../models/Quotation.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { Lead } from '../models/Lead.js';

export const getDashboardStats = async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const [invoices, customers, products, expenses, quotations, salesOrders, leads] = await Promise.all([
      Invoice.find({ organization_id: orgId }).lean(),
      Customer.find({ organization_id: orgId }).lean(),
      Product.find({ organization_id: orgId }).lean(),
      Expense.find({ organization_id: orgId }).lean(),
      Quotation.find({ organization_id: orgId }).lean(),
      SalesOrder.find({ organization_id: orgId }).lean(),
      Lead.find({ organization_id: orgId }).lean()
    ]);

    const totalInvoiced = invoices.reduce((s, i) => s + (i.grand_total || i.total || 0), 0);
    const totalPaid = invoices.reduce((s, i) => s + (i.paid_amount || 0), 0);
    const totalReceivable = invoices.reduce((s, i) => s + (i.balance_due || 0), 0);

    // Calculate dynamic last 6 months sales trend
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const sales_trend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIndex = d.getMonth();
      const year = d.getFullYear();
      const mName = monthNames[mIndex];

      const monthTotal = invoices
        .filter(inv => {
          const invDate = new Date(inv.invoice_date || inv.created_at);
          return invDate.getMonth() === mIndex && invDate.getFullYear() === year;
        })
        .reduce((sum, inv) => sum + (inv.grand_total || inv.total || 0), 0);

      sales_trend.push({ month: mName, value: monthTotal });
    }

    // Dynamic pipeline from real leads
    const stages = ["new", "contacted", "proposal", "won"];
    const pipeline = stages.map(stage => ({
      stage,
      count: leads.filter(l => (l.status || '').toLowerCase() === stage).length
    }));

    // Dynamic top customers by invoice totals
    const customerSpendMap = {};
    for (const inv of invoices) {
      const cName = inv.customer_name || 'Customer';
      const amt = (inv.grand_total || inv.total || 0);
      customerSpendMap[cName] = (customerSpendMap[cName] || 0) + amt;
    }
    const top_customers = Object.entries(customerSpendMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const wonLeadsCount = leads.filter(l => (l.status || '').toLowerCase() === 'won').length;
    const conversion_rate = leads.length > 0 ? Math.round((wonLeadsCount / leads.length) * 100) : 0;

    res.json({
      total_sales: totalInvoiced,
      total_invoiced: totalInvoiced,
      receivable: totalReceivable,
      cash_in: totalPaid,
      total_revenue: totalPaid,
      customers: customers.length,
      total_customers: customers.length,
      open_quotes: quotations.filter(q => (q.status || '').toLowerCase() !== 'rejected' && (q.status || '').toLowerCase() !== 'cancelled').length,
      confirmed_so: salesOrders.filter(so => (so.status || '').toLowerCase() === 'confirmed' || (so.status || '').toLowerCase() === 'approved').length,
      pending_invoices: invoices.filter(i => (i.balance_due && i.balance_due > 0) || (i.status || '').toLowerCase() !== 'paid').length,
      new_leads: leads.length,
      conversion_rate,
      sales_trend,
      pipeline,
      top_customers
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ results: [] });

    const regex = new RegExp(q, 'i');
    const orgId = req.user.organization_id;

    const [customers, products, invoices] = await Promise.all([
      Customer.find({ organization_id: orgId, $or: [{ company_name: regex }, { name: regex }] }).limit(5).lean(),
      Product.find({ organization_id: orgId, $or: [{ name: regex }, { sku: regex }] }).limit(5).lean(),
      Invoice.find({ organization_id: orgId, $or: [{ invoice_number: regex }, { customer_name: regex }] }).limit(5).lean()
    ]);

    const results = [
      ...customers.map(c => ({ id: c.id, type: 'Customer', title: c.company_name || c.name, subtitle: c.email })),
      ...products.map(p => ({ id: p.id, type: 'Product', title: p.name, subtitle: `SKU: ${p.sku}` })),
      ...invoices.map(i => ({ id: i.id, type: 'Invoice', title: i.invoice_number, subtitle: i.customer_name }))
    ];

    res.json({ results });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getNotifications = async (req, res) => {
  res.json([
    { id: 'notif_1', title: 'Low Stock Alert', message: 'Resin Polymer stock below reorder level (4 units left)', type: 'warning', created_at: new Date().toISOString() },
    { id: 'notif_2', title: 'Pending Approval', message: 'Sales Manager submitted Quotation QT-1024 for review', type: 'info', created_at: new Date().toISOString() }
  ]);
};

export const markNotificationRead = async (req, res) => res.json({ success: true });
export const scanLowStock = async (req, res) => res.json({ success: true, count: 2 });

export const getWhatsappConfig = async (req, res) => res.json({ enabled: true, phone_number: '+919876543210' });
export const getWhatsappStatus = async (req, res) => res.json({ connected: true, status: 'authenticated' });
export const getWhatsappQrcode = async (req, res) => res.json({ qrcode: 'data:image/png;base64,mockqr' });
export const getEmailConfig = async (req, res) => res.json({ smtp_host: 'smtp.gmail.com', smtp_port: 587, sender_email: 'noreply@vegnar.com' });

export default {
  getDashboardStats,
  globalSearch,
  getNotifications,
  markNotificationRead,
  scanLowStock,
  getWhatsappConfig,
  getWhatsappStatus,
  getWhatsappQrcode,
  getEmailConfig
};

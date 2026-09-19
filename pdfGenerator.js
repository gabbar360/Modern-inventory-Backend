const PDFDocument = require('pdfkit');

function fmtDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(d);
  }
}

function fmtMoney(num) {
  const n = Number(num) || 0;
  return 'Rs. ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numToWordsIndian(num) {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n) {
    if (n < 20) return a[n];
    const tens = b[Math.floor(n / 10)];
    const ones = a[n % 10];
    return tens + (ones ? ' ' + ones : '');
  }

  function convertHundreds(n) {
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 0) {
      str += convertTwoDigits(n);
    }
    return str.trim();
  }

  const rounded = Math.round(Number(num) || 0);
  if (rounded === 0) return 'Zero Rupees Only';

  let n = Math.abs(rounded);
  let crore = Math.floor(n / 10000000);
  n %= 10000000;
  let lakh = Math.floor(n / 100000);
  n %= 100000;
  let thousand = Math.floor(n / 1000);
  n %= 1000;
  let hundred = n;

  let res = '';
  if (crore > 0) res += convertHundreds(crore) + ' Crore ';
  if (lakh > 0) res += convertHundreds(lakh) + ' Lakh ';
  if (thousand > 0) res += convertHundreds(thousand) + ' Thousand ';
  if (hundred > 0) res += convertHundreds(hundred);

  return 'INR ' + res.trim() + ' Rupees Only';
}

function drawHr(doc, y, color = '#e2e8f0', width = 1) {
  doc.save();
  doc.strokeColor(color).lineWidth(width).moveTo(36, y).lineTo(559, y).stroke();
  doc.restore();
}

/**
 * Generate GST Tax Invoice PDF
 */
function generateInvoicePdf(invoice, customer = {}, organization = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const orgName = organization.legal_name || organization.name || 'Vegnar Global LLP';
      const orgAddress = organization.address || 'Plot 42, Bhiwandi Industrial Area';
      const orgCityState = `${organization.city || 'Bhiwandi'}, ${organization.state || 'Maharashtra'} - ${organization.pin || '421302'}`;
      const orgGstin = organization.gstin || '27AABCV1234F1Z8';
      const orgPan = organization.pan || 'AABCV1234F';
      const orgPhone = organization.phone || '+91 98200 12345';
      const orgEmail = organization.email || 'billing@vegnar.com';

      // Header Banner
      doc.rect(36, 36, 523, 24).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text('TAX INVOICE', 46, 42, { align: 'left' });
      doc.fontSize(9).font('Helvetica').text('Original for Recipient', 36, 43, { width: 513, align: 'right' });

      // Company Info (Left)
      let y = 70;
      doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(orgName, 36, y);
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica');
      y += 18;
      doc.text(orgAddress, 36, y);
      y += 12;
      doc.text(orgCityState, 36, y);
      y += 12;
      doc.text(`GSTIN: ${orgGstin}  |  PAN: ${orgPan}`, 36, y);
      y += 12;
      doc.text(`Email: ${orgEmail}  |  Phone: ${orgPhone}`, 36, y);

      // Invoice Meta (Right Box)
      const metaBoxX = 350;
      let metaY = 70;
      doc.rect(metaBoxX - 10, metaY - 5, 183, 76).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(9);
      
      doc.font('Helvetica-Bold').text('Invoice No:', metaBoxX, metaY);
      doc.font('Helvetica').text(invoice.number || 'INV-000', metaBoxX + 65, metaY);
      
      metaY += 14;
      doc.font('Helvetica-Bold').text('Invoice Date:', metaBoxX, metaY);
      doc.font('Helvetica').text(fmtDate(invoice.invoice_date), metaBoxX + 65, metaY);
      
      metaY += 14;
      doc.font('Helvetica-Bold').text('Due Date:', metaBoxX, metaY);
      doc.font('Helvetica').text(fmtDate(invoice.due_date), metaBoxX + 65, metaY);

      metaY += 14;
      doc.font('Helvetica-Bold').text('Supply Place:', metaBoxX, metaY);
      doc.font('Helvetica').text(invoice.place_of_supply || customer.state || organization.state || 'Maharashtra', metaBoxX + 65, metaY);

      metaY += 14;
      doc.font('Helvetica-Bold').text('Status:', metaBoxX, metaY);
      const isPaid = (invoice.balance_due || 0) <= 0;
      doc.font('Helvetica-Bold').fillColor(isPaid ? '#15803d' : '#b91c1c')
        .text((invoice.status || (isPaid ? 'PAID' : 'UNPAID')).toUpperCase(), metaBoxX + 65, metaY);

      y = 155;
      drawHr(doc, y, '#94a3b8', 1);
      y += 8;

      // Customer Bill To & Ship To
      const boxW = 255;
      doc.rect(36, y, boxW, 80).fillAndStroke('#ffffff', '#e2e8f0');
      doc.rect(298, y, 261, 80).fillAndStroke('#ffffff', '#e2e8f0');

      // Bill To
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('BILLED TO (CUSTOMER):', 44, y + 6);
      doc.fontSize(8.5).font('Helvetica-Bold').text(customer.company_name || invoice.customer_name || 'Customer Name', 44, y + 20);
      doc.font('Helvetica').fillColor('#334155');
      doc.text(`Contact: ${customer.contact_person || 'Accounts Payable'}  (${customer.mobile || '—'})`, 44, y + 32);
      doc.text(customer.billing_address || customer.address || 'Address on file', 44, y + 44, { width: 240, height: 20 });
      doc.text(`State: ${customer.state || 'Maharashtra'} (${customer.state_code || '27'})   GSTIN: ${customer.gstin || 'Unregistered'}`, 44, y + 66);

      // Ship To
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('SHIPPED TO / DELIVERY SITE:', 306, y + 6);
      doc.fontSize(8.5).font('Helvetica-Bold').text(customer.company_name || invoice.customer_name || 'Customer Site', 306, y + 20);
      doc.font('Helvetica').fillColor('#334155');
      doc.text(`Contact: ${customer.contact_person || 'Site Incharge'}`, 306, y + 32);
      doc.text(customer.shipping_address || customer.billing_address || 'Same as billing address', 306, y + 44, { width: 240, height: 20 });
      doc.text(`State: ${customer.state || 'Maharashtra'} (${customer.state_code || '27'})`, 306, y + 66);

      y += 92;

      // Items Table Header
      const tableHeadY = y;
      doc.rect(36, tableHeadY, 523, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('#', 42, tableHeadY + 6);
      doc.text('Item & Description', 62, tableHeadY + 6);
      doc.text('HSN', 245, tableHeadY + 6);
      doc.text('Qty', 290, tableHeadY + 6, { width: 35, align: 'right' });
      doc.text('Rate', 335, tableHeadY + 6, { width: 45, align: 'right' });
      doc.text('GST', 385, tableHeadY + 6, { width: 30, align: 'right' });
      doc.text('Taxable', 420, tableHeadY + 6, { width: 55, align: 'right' });
      doc.text('Total (INR)', 485, tableHeadY + 6, { width: 68, align: 'right' });

      y = tableHeadY + 20;
      doc.font('Helvetica').fontSize(8);

      const items = invoice.items || [];
      items.forEach((it, idx) => {
        const itemBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(36, y, 523, 20).fill(itemBg);
        doc.fillColor('#0f172a');

        const qty = Number(it.quantity) || 0;
        const rate = Number(it.rate) || 0;
        const gstRate = Number(it.gst_rate) || 18;
        const taxable = Number(it.taxable_amount) || (qty * rate);
        const lineTotal = Number(it.amount) || (taxable + (Number(it.tax_amount) || (taxable * gstRate / 100)));

        doc.text(String(idx + 1), 42, y + 5);
        doc.text(it.name || it.product_name || 'Item', 62, y + 5, { width: 175, height: 14, ellipsis: true });
        doc.text(it.hsn || '4823', 245, y + 5);
        doc.text(qty.toLocaleString('en-IN'), 290, y + 5, { width: 35, align: 'right' });
        doc.text(rate.toFixed(2), 335, y + 5, { width: 45, align: 'right' });
        doc.text(`${gstRate}%`, 385, y + 5, { width: 30, align: 'right' });
        doc.text(taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 420, y + 5, { width: 55, align: 'right' });
        doc.text(lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 485, y + 5, { width: 68, align: 'right' });

        drawHr(doc, y + 20, '#e2e8f0', 0.5);
        y += 20;
      });

      // Summary & Totals Block
      y += 6;
      const sameState = invoice.same_state !== false;
      const subtotal = Number(invoice.subtotal) || 0;
      const cgst = Number(invoice.cgst) || 0;
      const sgst = Number(invoice.sgst) || 0;
      const igst = Number(invoice.igst) || 0;
      const grandTotal = Number(invoice.grand_total) || 0;
      const balanceDue = invoice.balance_due !== undefined ? Number(invoice.balance_due) : grandTotal;
      const amountPaid = Number(invoice.amount_paid) || (grandTotal - balanceDue);

      const totalsX = 350;
      let totalsY = y;

      // Left Box: Amount in Words & Bank Details
      const leftBoxW = 295;
      doc.rect(36, totalsY, leftBoxW, 115).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('AMOUNT IN WORDS:', 44, totalsY + 8);
      doc.font('Helvetica').fontSize(8).fillColor('#334155').text(numToWordsIndian(grandTotal), 44, totalsY + 20, { width: leftBoxW - 16 });

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('PAYMENT DETAILS / NEFT / RTGS:', 44, totalsY + 45);
      doc.font('Helvetica').fontSize(7.5).fillColor('#334155');
      doc.text(`Bank Name: ${organization.bank_name || 'HDFC Bank Ltd'}`, 44, totalsY + 57);
      doc.text(`A/C Holder: ${organization.account_holder || orgName}`, 44, totalsY + 68);
      doc.text(`Account No: ${organization.account_number || '50200084920194'}   |   IFSC: ${organization.ifsc || 'HDFC0000123'}`, 44, totalsY + 79);
      if (organization.upi_id) {
        doc.text(`UPI ID: ${organization.upi_id} (Accepts GPay, PhonePe, Paytm, BHIM)`, 44, totalsY + 90);
      }

      // Right Box: Totals Breakdown
      doc.rect(totalsX, totalsY, 209, 115).fillAndStroke('#ffffff', '#cbd5e1');
      function drawTotalRow(label, value, isBold = false, color = '#0f172a', bg = null) {
        if (bg) doc.rect(totalsX, totalsY, 209, 18).fill(bg);
        doc.fillColor(color).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(isBold ? 9 : 8);
        doc.text(label, totalsX + 10, totalsY + 4);
        doc.text(value, totalsX + 100, totalsY + 4, { width: 99, align: 'right' });
        drawHr(doc, totalsY + 18, '#e2e8f0', 0.5);
        totalsY += 18;
      }

      drawTotalRow('Subtotal (Taxable):', fmtMoney(subtotal));
      if (sameState) {
        drawTotalRow('CGST:', fmtMoney(cgst));
        drawTotalRow('SGST:', fmtMoney(sgst));
      } else {
        drawTotalRow('IGST:', fmtMoney(igst));
      }
      drawTotalRow('Grand Total:', fmtMoney(grandTotal), true, '#0f172a', '#f1f5f9');
      drawTotalRow('Amount Paid:', fmtMoney(amountPaid), false, '#15803d');
      drawTotalRow('Balance Due:', fmtMoney(balanceDue), true, balanceDue > 0 ? '#b91c1c' : '#15803d');

      y = totalsY + 15;

      // Notes & Signatory
      const signY = y;
      doc.rect(36, signY, 320, 65).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('TERMS & CONDITIONS:', 44, signY + 6);
      doc.font('Helvetica').fontSize(7.5).fillColor('#475569');
      doc.text('1. Payment is strictly due by the due date specified on the invoice.', 44, signY + 18);
      doc.text('2. Interest @ 18% p.a. will be levied on delayed payments beyond credit term.', 44, signY + 28);
      doc.text('3. All disputes are subject to local judicial jurisdiction only.', 44, signY + 38);
      if (invoice.notes) {
        doc.text(`Special Notes: ${invoice.notes}`, 44, signY + 48, { width: 300, height: 14, ellipsis: true });
      }

      // Authorised Signatory Box
      doc.rect(365, signY, 194, 65).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(`For ${orgName}`, 375, signY + 6, { width: 174, align: 'center' });
      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text('Authorized Signatory', 375, signY + 48, { width: 174, align: 'center' });

      // Footer
      const footerY = 790;
      drawHr(doc, footerY, '#cbd5e1', 1);
      doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8');
      doc.text('This is a computer-generated tax invoice and requires no physical signature.', 36, footerY + 6, { align: 'left' });
      doc.text('Powered by Vegnar ERP', 36, footerY + 6, { width: 523, align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate Sales Quotation PDF
 */
function generateQuotationPdf(quotation, customer = {}, organization = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const orgName = organization.legal_name || organization.name || 'Vegnar Global LLP';
      const orgAddress = organization.address || 'Plot 42, Bhiwandi Industrial Area';
      const orgCityState = `${organization.city || 'Bhiwandi'}, ${organization.state || 'Maharashtra'} - ${organization.pin || '421302'}`;
      const orgGstin = organization.gstin || '27AABCV1234F1Z8';
      const orgPan = organization.pan || 'AABCV1234F';
      const orgPhone = organization.phone || '+91 98200 12345';
      const orgEmail = organization.email || 'sales@vegnar.com';

      // Header Banner
      doc.rect(36, 36, 523, 24).fill('#1e3a8a');
      doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text('SALES QUOTATION', 46, 42, { align: 'left' });
      doc.fontSize(9).font('Helvetica').text('Commercial Proposal', 36, 43, { width: 513, align: 'right' });

      // Company Info (Left)
      let y = 70;
      doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(orgName, 36, y);
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica');
      y += 18;
      doc.text(orgAddress, 36, y);
      y += 12;
      doc.text(orgCityState, 36, y);
      y += 12;
      doc.text(`GSTIN: ${orgGstin}  |  PAN: ${orgPan}`, 36, y);
      y += 12;
      doc.text(`Email: ${orgEmail}  |  Phone: ${orgPhone}`, 36, y);

      // Quote Meta (Right Box)
      const metaBoxX = 350;
      let metaY = 70;
      doc.rect(metaBoxX - 10, metaY - 5, 183, 76).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(9);
      
      doc.font('Helvetica-Bold').text('Quote No:', metaBoxX, metaY);
      doc.font('Helvetica').text(quotation.number || 'QT-000', metaBoxX + 70, metaY);
      
      metaY += 14;
      doc.font('Helvetica-Bold').text('Quote Date:', metaBoxX, metaY);
      doc.font('Helvetica').text(fmtDate(quotation.quote_date), metaBoxX + 70, metaY);
      
      metaY += 14;
      doc.font('Helvetica-Bold').text('Valid Until:', metaBoxX, metaY);
      doc.font('Helvetica').text(fmtDate(quotation.expiry_date) || '30 Days from date', metaBoxX + 70, metaY);

      metaY += 14;
      doc.font('Helvetica-Bold').text('Payment Terms:', metaBoxX, metaY);
      doc.font('Helvetica').text(quotation.payment_terms || 'Net 30', metaBoxX + 70, metaY);

      metaY += 14;
      doc.font('Helvetica-Bold').text('Status:', metaBoxX, metaY);
      doc.font('Helvetica-Bold').fillColor('#2563eb')
        .text((quotation.status || 'DRAFT').toUpperCase(), metaBoxX + 70, metaY);

      y = 155;
      drawHr(doc, y, '#94a3b8', 1);
      y += 8;

      // Customer Block
      doc.rect(36, y, 523, 60).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('QUOTATION PREPARED FOR:', 44, y + 6);
      doc.fontSize(9).font('Helvetica-Bold').text(customer.company_name || quotation.customer_name || 'Customer Name', 44, y + 20);
      doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
      doc.text(`Contact: ${customer.contact_person || 'Procurement Manager'}   |   Mobile: ${customer.mobile || '—'}   |   Email: ${customer.email || '—'}`, 44, y + 32);
      doc.text(`Address: ${customer.billing_address || customer.address || 'Address on file'}  (State: ${customer.state || 'Maharashtra'})   GSTIN: ${customer.gstin || 'Unregistered'}`, 44, y + 44);

      y += 72;

      // Items Table Header
      const tableHeadY = y;
      doc.rect(36, tableHeadY, 523, 20).fill('#1e3a8a');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('#', 42, tableHeadY + 6);
      doc.text('Item Description & Specification', 62, tableHeadY + 6);
      doc.text('HSN', 245, tableHeadY + 6);
      doc.text('Qty', 290, tableHeadY + 6, { width: 35, align: 'right' });
      doc.text('Rate', 335, tableHeadY + 6, { width: 45, align: 'right' });
      doc.text('GST', 385, tableHeadY + 6, { width: 30, align: 'right' });
      doc.text('Taxable', 420, tableHeadY + 6, { width: 55, align: 'right' });
      doc.text('Total (INR)', 485, tableHeadY + 6, { width: 68, align: 'right' });

      y = tableHeadY + 20;
      doc.font('Helvetica').fontSize(8);

      const items = quotation.items || [];
      items.forEach((it, idx) => {
        const itemBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(36, y, 523, 20).fill(itemBg);
        doc.fillColor('#0f172a');

        const qty = Number(it.quantity) || 0;
        const rate = Number(it.rate) || 0;
        const gstRate = Number(it.gst_rate) || 18;
        const taxable = Number(it.taxable_amount) || (qty * rate);
        const lineTotal = Number(it.amount) || (taxable + (Number(it.tax_amount) || (taxable * gstRate / 100)));

        doc.text(String(idx + 1), 42, y + 5);
        doc.text(it.name || it.product_name || 'Item', 62, y + 5, { width: 175, height: 14, ellipsis: true });
        doc.text(it.hsn || '4823', 245, y + 5);
        doc.text(qty.toLocaleString('en-IN'), 290, y + 5, { width: 35, align: 'right' });
        doc.text(rate.toFixed(2), 335, y + 5, { width: 45, align: 'right' });
        doc.text(`${gstRate}%`, 385, y + 5, { width: 30, align: 'right' });
        doc.text(taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 420, y + 5, { width: 55, align: 'right' });
        doc.text(lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 485, y + 5, { width: 68, align: 'right' });

        drawHr(doc, y + 20, '#e2e8f0', 0.5);
        y += 20;
      });

      // Summary
      y += 6;
      const sameState = quotation.same_state !== false;
      const subtotal = Number(quotation.subtotal) || 0;
      const cgst = Number(quotation.cgst) || 0;
      const sgst = Number(quotation.sgst) || 0;
      const igst = Number(quotation.igst) || 0;
      const grandTotal = Number(quotation.grand_total) || 0;

      const totalsX = 350;
      let totalsY = y;

      // Left Box: In Words & Commercial Terms
      const leftBoxW = 295;
      doc.rect(36, totalsY, leftBoxW, 95).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('QUOTE AMOUNT IN WORDS:', 44, totalsY + 8);
      doc.font('Helvetica').fontSize(8).fillColor('#334155').text(numToWordsIndian(grandTotal), 44, totalsY + 20, { width: leftBoxW - 16 });

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('COMMERCIAL NOTES & TERMS:', 44, totalsY + 45);
      doc.font('Helvetica').fontSize(7.5).fillColor('#334155');
      doc.text(`• Delivery Lead Time: 3 to 5 business days from Purchase Order confirmation.`, 44, totalsY + 57);
      doc.text(`• Freight: Extra at actuals or as mutually agreed in contract.`, 44, totalsY + 68);
      doc.text(`• Taxes: Applicable GST as itemized above.`, 44, totalsY + 79);

      // Right Box: Totals
      doc.rect(totalsX, totalsY, 209, 95).fillAndStroke('#ffffff', '#cbd5e1');
      function drawQRow(label, value, isBold = false, color = '#0f172a', bg = null) {
        if (bg) doc.rect(totalsX, totalsY, 209, 20).fill(bg);
        doc.fillColor(color).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(isBold ? 9.5 : 8);
        doc.text(label, totalsX + 10, totalsY + 5);
        doc.text(value, totalsX + 100, totalsY + 5, { width: 99, align: 'right' });
        drawHr(doc, totalsY + 20, '#e2e8f0', 0.5);
        totalsY += 20;
      }

      drawQRow('Subtotal (Taxable):', fmtMoney(subtotal));
      if (sameState) {
        drawQRow('CGST:', fmtMoney(cgst));
        drawQRow('SGST:', fmtMoney(sgst));
      } else {
        drawQRow('IGST:', fmtMoney(igst));
      }
      drawQRow('Grand Total:', fmtMoney(grandTotal), true, '#1e3a8a', '#eff6ff');

      y = totalsY + 20;

      // Acceptance / Signatory Box
      const signY = y;
      doc.rect(36, signY, 255, 75).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('CUSTOMER ACCEPTANCE:', 44, signY + 6);
      doc.font('Helvetica').fontSize(7.5).fillColor('#475569');
      doc.text('I/We hereby accept this quotation and authorize execution.', 44, signY + 18);
      doc.text('Signature & Stamp: ______________________', 44, signY + 45);
      doc.text('Date: ________________', 44, signY + 58);

      doc.rect(298, signY, 261, 75).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(`For ${orgName}`, 306, signY + 6, { width: 245, align: 'center' });
      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text('Authorized Commercial Representative', 306, signY + 56, { width: 245, align: 'center' });

      // Footer
      const footerY = 790;
      drawHr(doc, footerY, '#cbd5e1', 1);
      doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8');
      doc.text('This commercial quotation is generated by Vegnar ERP.', 36, footerY + 6, { align: 'left' });
      doc.text('Powered by Vegnar ERP', 36, footerY + 6, { width: 523, align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate Delivery Challan PDF
 */
function generateChallanPdf(challan, customer = {}, organization = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const orgName = organization.legal_name || organization.name || 'Vegnar Global LLP';
      const orgAddress = organization.address || 'Plot 42, Bhiwandi Industrial Area';
      const orgCityState = `${organization.city || 'Bhiwandi'}, ${organization.state || 'Maharashtra'} - ${organization.pin || '421302'}`;
      const orgGstin = organization.gstin || '27AABCV1234F1Z8';

      // Header Banner
      doc.rect(36, 36, 523, 24).fill('#047857');
      doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text('DELIVERY CHALLAN / DISPATCH SLIP', 46, 42, { align: 'left' });
      doc.fontSize(9).font('Helvetica').text('Goods Delivery Copy', 36, 43, { width: 513, align: 'right' });

      // Company Info (Left)
      let y = 70;
      doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(orgName, 36, y);
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica');
      y += 18;
      doc.text(orgAddress, 36, y);
      y += 12;
      doc.text(orgCityState, 36, y);
      y += 12;
      doc.text(`GSTIN: ${orgGstin}`, 36, y);

      // Challan Meta
      const metaBoxX = 350;
      let metaY = 70;
      doc.rect(metaBoxX - 10, metaY - 5, 183, 76).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(9);
      
      doc.font('Helvetica-Bold').text('Challan No:', metaBoxX, metaY);
      doc.font('Helvetica').text(challan.number || 'DC-000', metaBoxX + 70, metaY);
      
      metaY += 14;
      doc.font('Helvetica-Bold').text('Challan Date:', metaBoxX, metaY);
      doc.font('Helvetica').text(fmtDate(challan.challan_date), metaBoxX + 70, metaY);
      
      metaY += 14;
      doc.font('Helvetica-Bold').text('Sales Order:', metaBoxX, metaY);
      doc.font('Helvetica').text(challan.sales_order_number || 'SO Ref', metaBoxX + 70, metaY);

      metaY += 14;
      doc.font('Helvetica-Bold').text('Transporter:', metaBoxX, metaY);
      doc.font('Helvetica').text(challan.transporter || 'Delhivery Logistics', metaBoxX + 70, metaY);

      metaY += 14;
      doc.font('Helvetica-Bold').text('Vehicle / LR:', metaBoxX, metaY);
      doc.font('Helvetica').text(challan.vehicle || challan.lr_number || 'In-transit', metaBoxX + 70, metaY);

      y = 155;
      drawHr(doc, y, '#94a3b8', 1);
      y += 8;

      // Delivery Destination
      doc.rect(36, y, 523, 55).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('CONSIGNEE & DELIVERY DESTINATION:', 44, y + 6);
      doc.fontSize(8.5).font('Helvetica-Bold').text(customer.company_name || challan.customer_name || 'Consignee', 44, y + 20);
      doc.font('Helvetica').fillColor('#334155');
      doc.text(`Contact: ${customer.contact_person || 'Receiving Staff'} (${customer.mobile || '—'})`, 44, y + 32);
      doc.text(`Delivery Address: ${customer.shipping_address || customer.billing_address || 'Customer site address'}`, 44, y + 43);

      y += 68;

      // Table Header
      const tableHeadY = y;
      doc.rect(36, tableHeadY, 523, 20).fill('#047857');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('#', 42, tableHeadY + 6);
      doc.text('Dispatched Item & Specification', 62, tableHeadY + 6);
      doc.text('HSN / Code', 260, tableHeadY + 6);
      doc.text('Packaging Level', 345, tableHeadY + 6);
      doc.text('Quantity', 460, tableHeadY + 6, { width: 85, align: 'right' });

      y = tableHeadY + 20;
      doc.font('Helvetica').fontSize(8.5);

      let totalQty = 0;
      const items = challan.items || [];
      items.forEach((it, idx) => {
        const itemBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(36, y, 523, 22).fill(itemBg);
        doc.fillColor('#0f172a');

        const qty = Number(it.quantity) || 0;
        totalQty += qty;

        doc.text(String(idx + 1), 42, y + 6);
        doc.text(it.name || it.product_name || 'Dispatched Product', 62, y + 6, { width: 190, height: 14, ellipsis: true });
        doc.text(it.hsn || '4823', 260, y + 6);
        doc.text(it.packaging || 'Standard Outer Box', 345, y + 6);
        doc.text(qty.toLocaleString('en-IN'), 460, y + 6, { width: 85, align: 'right' });

        drawHr(doc, y + 22, '#e2e8f0', 0.5);
        y += 22;
      });

      // Total Qty Bar
      doc.rect(36, y, 523, 22).fill('#f1f5f9');
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);
      doc.text('Total Dispatched Units:', 345, y + 6);
      doc.text(totalQty.toLocaleString('en-IN'), 460, y + 6, { width: 85, align: 'right' });
      y += 35;

      // Receiver Acknowledgement
      const ackY = y;
      doc.rect(36, ackY, 255, 80).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('RECEIVER ACKNOWLEDGEMENT (POD):', 44, ackY + 6);
      doc.font('Helvetica').fontSize(7.5).fillColor('#475569');
      doc.text('Received materials in sound and complete condition.', 44, ackY + 20);
      doc.text('Receiver Name: __________________________', 44, ackY + 45);
      doc.text('Signature & Date: ________________________', 44, ackY + 60);

      doc.rect(298, ackY, 261, 80).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(`For ${orgName}`, 306, ackY + 6, { width: 245, align: 'center' });
      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text('Warehouse Manager / Dispatch In-charge', 306, ackY + 60, { width: 245, align: 'center' });

      // Footer
      const footerY = 790;
      drawHr(doc, footerY, '#cbd5e1', 1);
      doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8');
      doc.text('Delivery Challan generated automatically by Vegnar ERP.', 36, footerY + 6, { align: 'left' });
      doc.text('Powered by Vegnar ERP', 36, footerY + 6, { width: 523, align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate Customer Statement / Account Ledger PDF
 */
function generateCustomerStatementPdf(customer, invoices = [], payments = [], organization = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const orgName = organization.legal_name || organization.name || 'Vegnar Global LLP';
      const orgAddress = organization.address || 'Plot 42, Bhiwandi Industrial Area';
      const orgCityState = `${organization.city || 'Bhiwandi'}, ${organization.state || 'Maharashtra'} - ${organization.pin || '421302'}`;
      const orgGstin = organization.gstin || '27AABCV1234F1Z8';

      // Header Banner
      doc.rect(36, 36, 523, 24).fill('#312e81');
      doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text('STATEMENT OF ACCOUNT / CUSTOMER LEDGER', 46, 42, { align: 'left' });
      doc.fontSize(9).font('Helvetica').text(`As on ${fmtDate(new Date())}`, 36, 43, { width: 513, align: 'right' });

      // Company Info (Left)
      let y = 70;
      doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(orgName, 36, y);
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica');
      y += 18;
      doc.text(orgAddress, 36, y);
      y += 12;
      doc.text(orgCityState, 36, y);
      y += 12;
      doc.text(`GSTIN: ${orgGstin}  |  Email: ${organization.email || 'accounts@vegnar.com'}`, 36, y);

      // Customer Overview (Right Box)
      const metaBoxX = 330;
      let metaY = 70;
      doc.rect(metaBoxX - 10, metaY - 5, 203, 76).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(8.5);
      
      doc.font('Helvetica-Bold').text('Customer Name:', metaBoxX, metaY);
      doc.font('Helvetica').text(customer.company_name || 'Customer', metaBoxX + 75, metaY, { width: 115, height: 12, ellipsis: true });
      
      metaY += 14;
      doc.font('Helvetica-Bold').text('Contact Person:', metaBoxX, metaY);
      doc.font('Helvetica').text(customer.contact_person || '—', metaBoxX + 75, metaY);
      
      metaY += 14;
      doc.font('Helvetica-Bold').text('GSTIN:', metaBoxX, metaY);
      doc.font('Helvetica').text(customer.gstin || 'Unregistered', metaBoxX + 75, metaY);

      metaY += 14;
      doc.font('Helvetica-Bold').text('Email / Phone:', metaBoxX, metaY);
      doc.font('Helvetica').text(customer.email || customer.mobile || '—', metaBoxX + 75, metaY, { width: 115, height: 12, ellipsis: true });

      metaY += 14;
      doc.font('Helvetica-Bold').text('Credit Terms:', metaBoxX, metaY);
      doc.font('Helvetica').text(customer.payment_terms || 'Net 30', metaBoxX + 75, metaY);

      y = 155;
      drawHr(doc, y, '#94a3b8', 1);
      y += 12;

      // Summary KPI Tiles
      const totalInvoiced = invoices.reduce((s, i) => s + (Number(i.grand_total) || 0), 0);
      const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const totalOutstanding = invoices.reduce((s, i) => s + (Number(i.balance_due) || 0), 0);

      const tileW = 168;
      // Tile 1
      doc.rect(36, y, tileW, 46).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold').text('TOTAL INVOICED', 46, y + 8);
      doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold').text(fmtMoney(totalInvoiced), 46, y + 22);

      // Tile 2
      doc.rect(212, y, tileW, 46).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold').text('TOTAL PAYMENTS RECEIVED', 222, y + 8);
      doc.fillColor('#15803d').fontSize(13).font('Helvetica-Bold').text(fmtMoney(totalPaid), 222, y + 22);

      // Tile 3
      doc.rect(388, y, tileW, 46).fillAndStroke('#fef2f2', '#fecaca');
      doc.fillColor('#991b1b').fontSize(7.5).font('Helvetica-Bold').text('OUTSTANDING BALANCE DUE', 398, y + 8);
      doc.fillColor('#b91c1c').fontSize(13).font('Helvetica-Bold').text(fmtMoney(totalOutstanding), 398, y + 22);

      y += 58;

      // Ledger Table Header
      const tableHeadY = y;
      doc.rect(36, tableHeadY, 523, 20).fill('#312e81');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('Date', 42, tableHeadY + 6);
      doc.text('Type', 105, tableHeadY + 6);
      doc.text('Reference #', 160, tableHeadY + 6);
      doc.text('Due Date', 240, tableHeadY + 6);
      doc.text('Invoiced (Debit)', 310, tableHeadY + 6, { width: 75, align: 'right' });
      doc.text('Paid (Credit)', 395, tableHeadY + 6, { width: 75, align: 'right' });
      doc.text('Balance Due', 480, tableHeadY + 6, { width: 72, align: 'right' });

      y = tableHeadY + 20;
      doc.font('Helvetica').fontSize(8);

      // Combine invoices and payments in chronological order
      const ledger = [];
      invoices.forEach(inv => {
        ledger.push({
          date: inv.invoice_date,
          type: 'Invoice',
          ref: inv.number,
          due: inv.due_date,
          debit: Number(inv.grand_total) || 0,
          credit: Number(inv.amount_paid) || 0,
          balance: Number(inv.balance_due) || 0
        });
      });
      payments.forEach(pay => {
        ledger.push({
          date: pay.payment_date,
          type: 'Payment',
          ref: pay.number || pay.reference || 'PAY-REF',
          due: '',
          debit: 0,
          credit: Number(pay.amount) || 0,
          balance: 0
        });
      });

      ledger.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

      ledger.forEach((entry, idx) => {
        const itemBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(36, y, 523, 19).fill(itemBg);
        doc.fillColor('#0f172a');

        doc.text(fmtDate(entry.date), 42, y + 5);
        doc.fillColor(entry.type === 'Invoice' ? '#1e3a8a' : '#15803d').font('Helvetica-Bold').text(entry.type, 105, y + 5);
        doc.fillColor('#0f172a').font('Helvetica').text(entry.ref, 160, y + 5, { width: 75, ellipsis: true });
        doc.text(fmtDate(entry.due), 240, y + 5);

        doc.text(entry.debit > 0 ? entry.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—', 310, y + 5, { width: 75, align: 'right' });
        doc.fillColor(entry.credit > 0 ? '#15803d' : '#0f172a').text(entry.credit > 0 ? entry.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—', 395, y + 5, { width: 75, align: 'right' });
        doc.fillColor(entry.balance > 0 ? '#b91c1c' : '#0f172a').text(entry.type === 'Invoice' ? entry.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—', 480, y + 5, { width: 72, align: 'right' });

        drawHr(doc, y + 19, '#e2e8f0', 0.5);
        y += 19;
      });

      y += 10;

      // Settlement & Bank Information
      const remBoxY = y;
      doc.rect(36, remBoxY, 523, 58).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('REMITTANCE & PAYMENT INSTRUCTIONS:', 44, remBoxY + 6);
      doc.font('Helvetica').fontSize(8).fillColor('#334155');
      doc.text(`Bank Name: ${organization.bank_name || 'HDFC Bank Ltd'}   |   Account: ${organization.account_number || '50200084920194'}   |   IFSC: ${organization.ifsc || 'HDFC0000123'}`, 44, remBoxY + 20);
      doc.text(`Account Holder: ${organization.account_holder || orgName}   |   UPI ID: ${organization.upi_id || 'vegnar@okhdfcbank'}`, 44, remBoxY + 32);
      doc.text(`Customer Self-Service Portal: Access invoices, ledgers, and pay securely online via your personalized portal link.`, 44, remBoxY + 44);

      // Footer
      const footerY = 790;
      drawHr(doc, footerY, '#cbd5e1', 1);
      doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8');
      doc.text('This is an official Statement of Account generated by Vegnar ERP.', 36, footerY + 6, { align: 'left' });
      doc.text('Powered by Vegnar ERP', 36, footerY + 6, { width: 523, align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateInvoicePdf,
  generateQuotationPdf,
  generateChallanPdf,
  generateCustomerStatementPdf
};


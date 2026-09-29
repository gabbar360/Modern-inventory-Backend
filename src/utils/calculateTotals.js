export function calculateTotals(items = [], stateType = 'intra') {
  let subtotal = 0;
  let totalTax = 0;

  const processedItems = items.map(item => {
    const qty = Number(item.quantity || 1);
    const price = Number(item.unit_price || item.rate || item.price || 0);
    const gstRate = Number(item.gst_rate || 18);
    const disc = Number(item.discount || item.discount_pct || 0);

    const baseAmount = price * qty * (1 - disc / 100);
    const gstAmount = (baseAmount * gstRate) / 100;
    const totalAmount = baseAmount + gstAmount;

    subtotal += baseAmount;
    totalTax += gstAmount;

     return {
      product_id: item.product_id || item.id || 'prd_custom',
      name: item.name || item.product_name || 'Line Item',
      sku: item.sku || '',
      hsn_code: item.hsn_code || item.hsn || '',
      quantity: qty,
      unit_price: price,
      rate: price,
      gst_rate: gstRate,
      discount: disc,
      discount_pct: disc,
      taxable_amount: Math.round(baseAmount * 100) / 100,
      gst_amount: Math.round(gstAmount * 100) / 100,
      total_amount: Math.round(totalAmount * 100) / 100
    };
  });

  const total = subtotal + totalTax;
  const cgst = stateType === 'intra' ? totalTax / 2 : 0;
  const sgst = stateType === 'intra' ? totalTax / 2 : 0;
  const igst = stateType === 'inter' ? totalTax : 0;

  return {
    items: processedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    total_tax: Math.round(totalTax * 100) / 100,
    cgst: Math.round(cgst * 100) / 100,
    sgst: Math.round(sgst * 100) / 100,
    igst: Math.round(igst * 100) / 100,
    total: Math.round(total * 100) / 100
  };
}
export default calculateTotals;

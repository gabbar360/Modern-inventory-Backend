/**
 * ShippingController - Orchestrator for Delhivery B2C Express Integration
 * 
 * Implements:
 * 1. Multi-product box, weight & dimension aggregation (PackingCalculator)
 * 2. Pre-dispatch rate estimation (/api/kinko/v1/invoice/charges/.json)
 * 3. End-to-end dispatch orchestration: Packing -> Rate Check -> Manifestation -> Pickup Scheduling -> DB updates
 * 4. Pincode serviceability checks & live parcel tracking
 */

const { calculateOrderPacking } = require('../services/packingCalculator');
const DelhiveryService = require('../services/delhiveryService');

/**
 * Extracts a 6-digit Indian PIN code from address text or object
 */
function extractPincode(addressText, fallback = '400001') {
  if (!addressText) return fallback;
  if (typeof addressText === 'object' && addressText.pin) return String(addressText.pin).trim();
  const match = String(addressText).match(/\b[1-9][0-9]{5}\b/);
  return match ? match[0] : fallback;
}

/**
 * Helper to initialize DelhiveryService using organization settings
 */
async function getDelhiveryServiceForOrg(CourierConfig, orgId) {
  const conf = await CourierConfig.findOne({ organization_id: orgId });
  const apiKey = conf?.api_key || process.env.DELHIVERY_API_KEY || '';
  const isSandbox = Boolean(conf?.sandbox || (!apiKey || apiKey.includes('test')));
  const defaultPickup = conf?.pickup_location || process.env.DELHIVERY_PICKUP_LOCATION || 'PKP_VGN_01';

  return new DelhiveryService({
    apiKey,
    sandbox: isSandbox,
    defaultPickupLocation: defaultPickup
  });
}

/**
 * GET /api/shipping/serviceability/:pincode
 * Check if a destination pincode is serviceable by Delhivery
 */
async function checkPincodeServiceability(req, res, models) {
  try {
    const { pincode } = req.params;
    const service = await getDelhiveryServiceForOrg(models.CourierConfig, req.user.organization_id);
    const result = await service.checkServiceability(pincode);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ detail: `Serviceability check failed: ${err.message}` });
  }
}

/**
 * POST /api/orders/:id/shipping/estimate
 * Calculates aggregated packing dimensions and fetches structured freight charges
 */
async function estimateOrderShippingRate(req, res, models) {
  const { SalesOrder, Customer, Product, Organization, CourierConfig } = models;
  const { id } = req.params;
  const { mode = 'Surface', payment_type = 'Pre-paid', cod_amount } = req.body;

  try {
    const so = await SalesOrder.findOne({
      $or: [{ id }, { number: id }],
      organization_id: req.user.organization_id
    });
    if (!so) return res.status(404).json({ detail: 'Sales Order not found' });

    const cust = (await Customer.findOne({ id: so.customer_id })) || {};
    const org = (await Organization.findOne({ id: req.user.organization_id })) || {};

    // 1. Fetch all unique products in the order
    const productIds = (so.items || []).map(i => i.product_id).filter(Boolean);
    const products = await Product.find({ id: { $in: productIds } });
    const productMap = new Map(products.map(p => [p.id, p]));

    // 2. Run PackingCalculator Aggregation
    const packing = calculateOrderPacking(so.items || [], productMap);

    // 3. Resolve Pincodes
    const originPin = org.pin || '421302';
    const destPin = extractPincode(cust.shipping_address || cust.billing_address || cust.address, '400001');

    // 4. Rate Calculation via DelhiveryService
    const service = await getDelhiveryServiceForOrg(CourierConfig, req.user.organization_id);
    const codVal = (payment_type.toUpperCase() === 'COD' && cod_amount !== undefined)
      ? Number(cod_amount)
      : (payment_type.toUpperCase() === 'COD' ? so.grand_total : 0);

    const rateQuote = await service.calculateRate({
      originPincode: originPin,
      destPincode: destPin,
      weightKg: packing.chargeable_weight_kg,
      mode,
      paymentType: payment_type,
      codAmount: codVal
    });

    return res.json({
      order_id: so.id,
      order_number: so.number,
      customer_name: cust.company_name || so.customer_name,
      origin_pincode: originPin,
      destination_pincode: destPin,
      packing,
      rate_estimate: rateQuote
    });
  } catch (err) {
    console.error('Shipping rate estimation error:', err);
    return res.status(500).json({ detail: `Rate estimate failed: ${err.message}` });
  }
}

/**
 * POST /api/orders/:id/dispatch
 * End-to-end Dispatch Orchestrator:
 * 1. Aggregates Multi-product weights & dimensions
 * 2. Computes Rate Estimate
 * 3. Manifests Shipment (creates AWB/Waybill in Delhivery)
 * 4. Schedules Warehouse Pickup with Delhivery
 * 5. Updates Dispatch & Sales Order records in Database
 */
async function dispatchOrderWithDelhivery(req, res, models) {
  const { SalesOrder, Customer, Product, Organization, CourierConfig, Dispatch, Invoice, nextNumber, newId, now } = models;
  const { id } = req.params;
  const {
    mode = 'Surface',
    payment_type = 'Pre-paid',
    cod_amount = 0,
    pickup_date,
    pickup_time = '14:00:00',
    pickup_location,
    notes = ''
  } = req.body;

  try {
    // 1. Fetch Sales Order
    const so = await SalesOrder.findOne({
      $or: [{ id }, { number: id }],
      organization_id: req.user.organization_id
    });
    if (!so) return res.status(404).json({ detail: 'Sales Order not found' });

    if (so.status === 'cancelled') {
      return res.status(400).json({ detail: 'Cannot dispatch a cancelled Sales Order' });
    }

    const cust = (await Customer.findOne({ id: so.customer_id })) || {};
    const org = (await Organization.findOne({ id: req.user.organization_id })) || {};
    const conf = (await CourierConfig.findOne({ organization_id: req.user.organization_id })) || {};

    // 2. Fetch Products and aggregate packing
    const productIds = (so.items || []).map(i => i.product_id).filter(Boolean);
    const products = await Product.find({ id: { $in: productIds } });
    const productMap = new Map(products.map(p => [p.id, p]));

    const packing = calculateOrderPacking(so.items || [], productMap);

    // 3. Resolve addresses & Pincodes
    const originPin = org.pin || '421302';
    const destPin = extractPincode(cust.shipping_address || cust.billing_address, '400001');

    // 4. Initialize Delhivery Service
    const service = await getDelhiveryServiceForOrg(CourierConfig, req.user.organization_id);

    // 5. Serviceability validation
    const servCheck = await service.checkServiceability(destPin);
    if (!servCheck.serviceable && !servCheck.is_simulated) {
      return res.status(400).json({
        detail: `Destination pincode ${destPin} is not serviceable by Delhivery: ${servCheck.reason || 'Unreachable'}`
      });
    }

    // 6. Rate calculation
    const finalCodAmount = (payment_type.toUpperCase() === 'COD')
      ? (Number(cod_amount) > 0 ? Number(cod_amount) : Number(so.grand_total || 0))
      : 0;

    const rateQuote = await service.calculateRate({
      originPincode: originPin,
      destPincode: destPin,
      weightKg: packing.chargeable_weight_kg,
      mode,
      paymentType: payment_type,
      codAmount: finalCodAmount
    });

    // 7. Find associated Invoice or Quotation reference
    const inv = await Invoice.findOne({ sales_order_id: so.id, organization_id: req.user.organization_id });

    // 8. Manifest Shipment with Delhivery (/api/cmu/create.json)
    const productDesc = (so.items || []).map(i => i.name).slice(0, 3).join(', ') || 'Vegnar Goods';
    const pickupLocName = pickup_location || conf.pickup_location || org.name || 'Main Warehouse';

    const shipmentManifest = await service.createShipment({
      consigneeName: cust.contact_person || cust.company_name || so.customer_name,
      consigneePhone: cust.mobile || '9820012345',
      consigneeAddress: cust.shipping_address || cust.billing_address || 'Consignee Site',
      consigneeCity: cust.city || 'Mumbai',
      consigneeState: cust.state || 'Maharashtra',
      destinationPincode: destPin,
      orderNumber: so.number,
      invoiceNumber: inv?.number || so.number,
      orderDate: so.order_date || now(),
      orderTotal: so.grand_total || 0,
      paymentType: payment_type,
      codAmount: finalCodAmount,
      productDescription: productDesc,
      hsnCode: products[0]?.hsn || '4823',
      totalQuantity: so.items.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0),
      packageCount: packing.package_count,
      dimensions: packing.consolidated_dimensions,
      chargeableWeightGrams: packing.chargeable_weight_grams,
      mode,
      pickupLocationName: pickupLocName,
      originAddress: org.address || 'Plot 42, Bhiwandi Industrial Area',
      originCity: org.city || 'Bhiwandi',
      originState: org.state || 'Maharashtra',
      originPincode: originPin,
      originPhone: org.phone || '+91 98200 12345',
      organizationName: org.name || 'Vegnar Global LLP'
    });

    const waybill = shipmentManifest.waybill || shipmentManifest.awb_number;

    // 9. Schedule Warehouse Pickup (/fm/request/new/)
    const pickupSchedule = await service.schedulePickup({
      pickupLocation: pickupLocName,
      pickupDate: pickup_date || new Date().toISOString().slice(0, 10),
      pickupTime: pickup_time || '14:00:00',
      expectedPackageCount: packing.package_count
    });

    // 10. Persist Dispatch record in MongoDB
    const dispatchNumber = await nextNumber(req.user.organization_id, 'DSP', 'DSP');
    const estimatedCost = rateQuote?.cost_breakdown?.total_estimated_cost || 0;

    let dispatchDoc = await Dispatch.findOne({ sales_order_id: so.id, organization_id: req.user.organization_id });
    if (!dispatchDoc) {
      dispatchDoc = await Dispatch.create({
        id: newId(),
        number: dispatchNumber,
        organization_id: req.user.organization_id,
        sales_order_id: so.id,
        sales_order_number: so.number,
        customer_name: cust.company_name || so.customer_name,
        dispatch_date: now(),
        scheduled_quantity: packing.package_count,
        warehouse: so.warehouse || 'Main Warehouse',
        transporter: 'Delhivery Express Logistics',
        courier_name: 'Delhivery Express',
        awb_number: waybill,
        lr_number: shipmentManifest.lr_number || waybill,
        lr_date: now(),
        shipping_label_url: shipmentManifest.shipping_label_url || `https://track.delhivery.com/api/p/packing_slip?wbns=${waybill}&pdf=true`,
        tracking_status: 'Manifested (Ready for Pickup)',
        pickup_token: pickupSchedule.pickup_id,
        freight_charges: estimatedCost,
        status: 'ready_for_pickup',
        notes: notes || `Auto-dispatched via Delhivery API. Total Boxes: ${packing.package_count}`,
        created_by: req.user.id
      });
    } else {
      await Dispatch.updateOne({ id: dispatchDoc.id }, {
        $set: {
          awb_number: waybill,
          lr_number: shipmentManifest.lr_number || waybill,
          lr_date: now(),
          courier_name: 'Delhivery Express',
          scheduled_quantity: packing.package_count,
          pickup_token: pickupSchedule.pickup_id,
          freight_charges: estimatedCost,
          shipping_label_url: shipmentManifest.shipping_label_url || `https://track.delhivery.com/api/p/packing_slip?wbns=${waybill}&pdf=true`,
          status: 'ready_for_pickup',
          tracking_status: 'Manifested (Ready for Pickup)'
        }
      });
      dispatchDoc = await Dispatch.findOne({ id: dispatchDoc.id });
    }

    // 11. Update Sales Order status
    await SalesOrder.updateOne({ id: so.id }, {
      $set: {
        status: 'dispatched',
        awb_number: waybill,
        shipping_charges: estimatedCost,
        dispatch_id: dispatchDoc.id
      }
    });

    return res.json({
      ok: true,
      message: 'Order manifested and scheduled with Delhivery successfully',
      sales_order: {
        id: so.id,
        number: so.number,
        status: 'dispatched'
      },
      dispatch: {
        id: dispatchDoc.id,
        number: dispatchDoc.number,
        status: dispatchDoc.status,
        tracking_status: dispatchDoc.tracking_status,
        awb_number: waybill,
        lr_number: dispatchDoc.lr_number,
        pickup_id: pickupSchedule.pickup_id,
        pickup_date: pickupSchedule.pickup_date,
        pickup_time: pickupSchedule.pickup_time,
        pickup_location: pickupLocName,
        shipping_cost: estimatedCost,
        tracking_url: shipmentManifest.tracking_url,
        shipping_label_url: dispatchDoc.shipping_label_url
      },
      packing_summary: {
        package_count: packing.package_count,
        total_dead_weight_kg: packing.total_dead_weight_kg,
        total_volumetric_weight_kg: packing.total_volumetric_weight_kg,
        chargeable_weight_kg: packing.chargeable_weight_kg,
        consolidated_dimensions: packing.consolidated_dimensions
      },
      freight_breakdown: rateQuote.cost_breakdown
    });
  } catch (err) {
    console.error('Order dispatch orchestration failed:', err);
    return res.status(500).json({ detail: `Delhivery dispatch failed: ${err.message}` });
  }
}

/**
 * GET /api/shipping/track/:waybill
 * Track Delhivery shipment by AWB/Waybill
 */
async function trackShipmentStatus(req, res, models) {
  try {
    const { waybill } = req.params;
    const service = await getDelhiveryServiceForOrg(models.CourierConfig, req.user.organization_id);
    const trackData = await service.trackShipment(waybill);
    return res.json(trackData);
  } catch (err) {
    return res.status(500).json({ detail: `Tracking failed: ${err.message}` });
  }
}

module.exports = {
  extractPincode,
  getDelhiveryServiceForOrg,
  checkPincodeServiceability,
  estimateOrderShippingRate,
  dispatchOrderWithDelhivery,
  trackShipmentStatus
};

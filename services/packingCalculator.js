/**
 * PackingCalculator - Production Packing, Weight & Dimension Aggregator for Delhivery Shipping
 * 
 * Computes:
 * - Total Dead / Physical Weight (kg)
 * - Master Box Count (Package Count)
 * - Volumetric Weight: (L * W * H) / 5000 (kg)
 * - Final Chargeable Weight: max(Dead Weight, Volumetric Weight)
 * - Consolidated / Bounding Dimensions (L, W, H in cm)
 * - Detailed Box Breakdown per line item
 */

// Industry standard volumetric divisor for air and surface courier in India
const VOLUMETRIC_DIVISOR = 5000;

// Standard fallback dimensions and weights when product metadata is incomplete
const DEFAULT_BOX = {
  length_cm: 30,
  width_cm: 25,
  height_cm: 20,
  max_weight_per_box_kg: 20,
  default_unit_weight_kg: 0.25
};

/**
 * Normalizes a numeric value with bounds and default fallback
 */
function toPositiveNumber(val, defaultVal = 0) {
  const n = Number(val);
  return (!isNaN(n) && n > 0) ? n : defaultVal;
}

/**
 * Calculates volumetric weight in kg for given dimensions (cm)
 */
function calculateVolumetricWeight(lengthCm, widthCm, heightCm) {
  const l = toPositiveNumber(lengthCm, DEFAULT_BOX.length_cm);
  const w = toPositiveNumber(widthCm, DEFAULT_BOX.width_cm);
  const h = toPositiveNumber(heightCm, DEFAULT_BOX.height_cm);
  return Math.round(((l * w * h) / VOLUMETRIC_DIVISOR) * 100) / 100;
}

/**
 * Computes packing parameters for a single line item
 * 
 * @param {Object} item Line item from order (quantity, product_id, packaging, etc.)
 * @param {Object} product Product master record (dimensions, weight, packaging_levels)
 * @returns {Object} Item packing breakdown
 */
function calculateItemPacking(item = {}, product = {}) {
  const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
  const productName = item.name || product.name || 'Standard Item';

  // 1. Check if product has structured packaging tiers (e.g. Master Carton / Outer Box)
  const packagingLevels = Array.isArray(product.packaging_levels) ? product.packaging_levels : [];
  
  // Look for master carton or outer box first, or highest unit tier
  let selectedTier = null;
  if (packagingLevels.length > 0) {
    if (item.packaging) {
      selectedTier = packagingLevels.find(p => p.level?.toLowerCase() === item.packaging.toLowerCase());
    }
    if (!selectedTier) {
      // Pick master carton or highest units capacity tier
      selectedTier = [...packagingLevels].sort((a, b) => (b.units || 1) - (a.units || 1))[0];
    }
  }

  let boxCount = 1;
  let boxLength = DEFAULT_BOX.length_cm;
  let boxWidth = DEFAULT_BOX.width_cm;
  let boxHeight = DEFAULT_BOX.height_cm;
  let boxDeadWeight = 0;
  let totalDeadWeight = 0;
  let boxes = [];

  if (selectedTier && selectedTier.units > 1) {
    // Case A: Product has defined Master Box packaging
    const unitsPerBox = Math.max(1, selectedTier.units);
    boxCount = Math.ceil(quantity / unitsPerBox);
    boxLength = toPositiveNumber(selectedTier.length_cm, product.length_cm || DEFAULT_BOX.length_cm);
    boxWidth = toPositiveNumber(selectedTier.width_cm, product.width_cm || DEFAULT_BOX.width_cm);
    boxHeight = toPositiveNumber(selectedTier.height_cm, product.height_cm || DEFAULT_BOX.height_cm);

    // Box dead weight: from tier or unit product weight * unitsPerBox
    const unitWeight = toPositiveNumber(product.weight_kg, DEFAULT_BOX.default_unit_weight_kg);
    boxDeadWeight = toPositiveNumber(selectedTier.weight_kg, unitWeight * unitsPerBox);
    totalDeadWeight = Math.round(boxDeadWeight * boxCount * 100) / 100;

    for (let i = 1; i <= boxCount; i++) {
      const unitsInThisBox = (i === boxCount && (quantity % unitsPerBox !== 0))
        ? (quantity % unitsPerBox)
        : unitsPerBox;
      const weightForThisBox = Math.round((unitsInThisBox / unitsPerBox) * boxDeadWeight * 100) / 100;
      const volWeight = calculateVolumetricWeight(boxLength, boxWidth, boxHeight);

      boxes.push({
        box_number: i,
        product_id: product.id || item.product_id,
        product_name: productName,
        units: unitsInThisBox,
        packaging_type: selectedTier.level || 'Master Carton',
        length_cm: boxLength,
        width_cm: boxWidth,
        height_cm: boxHeight,
        dead_weight_kg: weightForThisBox,
        volumetric_weight_kg: volWeight,
        chargeable_weight_kg: Math.max(weightForThisBox, volWeight)
      });
    }
  } else {
    // Case B: Single product dimensions given directly
    const prodLength = toPositiveNumber(product.length_cm, DEFAULT_BOX.length_cm);
    const prodWidth = toPositiveNumber(product.width_cm, DEFAULT_BOX.width_cm);
    const prodHeight = toPositiveNumber(product.height_cm, DEFAULT_BOX.height_cm);
    const unitWeight = toPositiveNumber(product.weight_kg, DEFAULT_BOX.default_unit_weight_kg);

    // Determine reasonable consolidation: If unit weight is heavy (e.g. >= 5kg), 1 unit/box
    // If small item (e.g. plates, tableware), consolidate into boxes up to 20kg
    let unitsPerBox = 1;
    if (unitWeight < 2) {
      unitsPerBox = Math.min(quantity, Math.max(1, Math.floor(DEFAULT_BOX.max_weight_per_box_kg / unitWeight)));
    }

    boxCount = Math.ceil(quantity / unitsPerBox);
    boxLength = prodLength;
    boxWidth = prodWidth;
    boxHeight = Math.min(120, Math.round(prodHeight * Math.min(unitsPerBox, 10))); // Stack height factor
    boxDeadWeight = Math.round(unitWeight * unitsPerBox * 100) / 100;
    totalDeadWeight = Math.round(unitWeight * quantity * 100) / 100;

    for (let i = 1; i <= boxCount; i++) {
      const unitsInThisBox = (i === boxCount && (quantity % unitsPerBox !== 0))
        ? (quantity % unitsPerBox)
        : unitsPerBox;
      const weightForThisBox = Math.round(unitWeight * unitsInThisBox * 100) / 100;
      const volWeight = calculateVolumetricWeight(boxLength, boxWidth, boxHeight);

      boxes.push({
        box_number: i,
        product_id: product.id || item.product_id,
        product_name: productName,
        units: unitsInThisBox,
        packaging_type: 'Standard Box',
        length_cm: boxLength,
        width_cm: boxWidth,
        height_cm: boxHeight,
        dead_weight_kg: weightForThisBox,
        volumetric_weight_kg: volWeight,
        chargeable_weight_kg: Math.max(weightForThisBox, volWeight)
      });
    }
  }

  const totalVolWeight = boxes.reduce((acc, b) => acc + b.volumetric_weight_kg, 0);

  return {
    product_id: product.id || item.product_id,
    product_name: productName,
    total_quantity: quantity,
    box_count: boxCount,
    total_dead_weight_kg: Math.round(totalDeadWeight * 100) / 100,
    total_volumetric_weight_kg: Math.round(totalVolWeight * 100) / 100,
    boxes
  };
}

/**
 * Aggregates packing across all order line items into shipment level metrics
 * 
 * @param {Array} lineItems Array of order items [{ product_id, quantity, name, rate }]
 * @param {Map|Object} productsMap Map or dictionary of product_id -> Product
 * @returns {Object} Comprehensive consolidated packing and weight calculations
 */
function calculateOrderPacking(lineItems = [], productsMap = {}) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return {
      package_count: 1,
      total_dead_weight_kg: 1.0,
      total_volumetric_weight_kg: calculateVolumetricWeight(DEFAULT_BOX.length_cm, DEFAULT_BOX.width_cm, DEFAULT_BOX.height_cm),
      chargeable_weight_kg: 1.0,
      chargeable_weight_grams: 1000,
      consolidated_dimensions: {
        length_cm: DEFAULT_BOX.length_cm,
        width_cm: DEFAULT_BOX.width_cm,
        height_cm: DEFAULT_BOX.height_cm
      },
      box_breakdown: [],
      items_packing: []
    };
  }

  const getProduct = (id) => {
    if (productsMap instanceof Map) return productsMap.get(id) || {};
    return productsMap[id] || {};
  };

  let allBoxes = [];
  let itemsPacking = [];
  let runningDeadWeight = 0;
  let runningVolumetricWeight = 0;

  lineItems.forEach(item => {
    const p = getProduct(item.product_id || item.id);
    const itemResult = calculateItemPacking(item, p);
    itemsPacking.push(itemResult);
    
    runningDeadWeight += itemResult.total_dead_weight_kg;
    runningVolumetricWeight += itemResult.total_volumetric_weight_kg;
    allBoxes.push(...itemResult.boxes);
  });

  // Re-number boxes sequentially 1..N
  allBoxes.forEach((b, idx) => {
    b.overall_box_number = idx + 1;
  });

  const totalDeadWeightKg = Math.max(0.1, Math.round(runningDeadWeight * 100) / 100);
  const totalVolWeightKg = Math.max(0.1, Math.round(runningVolumetricWeight * 100) / 100);
  const chargeableWeightKg = Math.max(totalDeadWeightKg, totalVolWeightKg);
  const packageCount = Math.max(1, allBoxes.length);

  // Compute consolidated bounding box for the shipment manifestation
  // If multiple boxes: maximum footprint (L, W) and cumulative or dominant height
  let maxL = DEFAULT_BOX.length_cm;
  let maxW = DEFAULT_BOX.width_cm;
  let maxH = DEFAULT_BOX.height_cm;

  if (allBoxes.length === 1) {
    maxL = allBoxes[0].length_cm;
    maxW = allBoxes[0].width_cm;
    maxH = allBoxes[0].height_cm;
  } else if (allBoxes.length > 1) {
    maxL = Math.max(...allBoxes.map(b => b.length_cm));
    maxW = Math.max(...allBoxes.map(b => b.width_cm));
    // Representative master carton packaging height (capped reasonably for Delhivery manifest)
    maxH = Math.min(150, Math.max(...allBoxes.map(b => b.height_cm)));
  }

  return {
    package_count: packageCount,
    total_dead_weight_kg: totalDeadWeightKg,
    total_volumetric_weight_kg: totalVolWeightKg,
    chargeable_weight_kg: chargeableWeightKg,
    chargeable_weight_grams: Math.round(chargeableWeightKg * 1000),
    consolidated_dimensions: {
      length_cm: maxL,
      width_cm: maxW,
      height_cm: maxH
    },
    volumetric_formula: `(Length x Width x Height) / ${VOLUMETRIC_DIVISOR}`,
    box_breakdown: allBoxes,
    items_packing: itemsPacking
  };
}

module.exports = {
  VOLUMETRIC_DIVISOR,
  DEFAULT_BOX,
  calculateVolumetricWeight,
  calculateItemPacking,
  calculateOrderPacking
};


/**
 * Aggregate shipment item rows while preserving original rows elsewhere.
 *
 * Aggregation key priority:
 * 1. productId + skuObserved
 * 2. skuObserved
 * 3. normalized product name + specification + color + variant
 */
export function aggregateShipmentItems(items) {
  const groups = new Map();

  for (const item of items) {
    const cartons = toNonNegativeNumber(item.cartons, 'cartons');
    const unitsPerCarton = toNonNegativeNumber(item.unitsPerCarton, 'unitsPerCarton');
    const computedTotalUnits = cartons * unitsPerCarton;

    const key = buildKey(item);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        productId: item.productId ?? null,
        sku: item.skuObserved ?? null,
        productName: item.productNameNormalized ?? item.productNameObserved ?? null,
        specification: item.specification ?? null,
        color: item.color ?? null,
        variant: item.variant ?? null,
        cartons,
        totalUnits: computedTotalUnits,
        unitsPerCartonValues: new Set([unitsPerCarton]),
        sourceItemIds: [item.id],
        hasMixedPacking: false
      });
      continue;
    }

    existing.cartons += cartons;
    existing.totalUnits += computedTotalUnits;
    existing.unitsPerCartonValues.add(unitsPerCarton);
    existing.sourceItemIds.push(item.id);
    existing.hasMixedPacking = existing.unitsPerCartonValues.size > 1;
  }

  return Array.from(groups.values()).map((row) => ({
    ...row,
    unitsPerCartonValues: Array.from(row.unitsPerCartonValues).sort((a, b) => a - b)
  }));
}

export function computeShipmentTotals(items) {
  return items.reduce(
    (acc, item) => {
      const cartons = toNonNegativeNumber(item.cartons, 'cartons');
      const unitsPerCarton = toNonNegativeNumber(item.unitsPerCarton, 'unitsPerCarton');
      acc.cartons += cartons;
      acc.totalUnits += cartons * unitsPerCarton;
      return acc;
    },
    { cartons: 0, totalUnits: 0 }
  );
}

function buildKey(item) {
  if (item.productId && item.skuObserved) return `product:${item.productId}|sku:${item.skuObserved}`;
  if (item.skuObserved) return `sku:${item.skuObserved}`;

  const fallback = [
    item.productNameNormalized ?? item.productNameObserved ?? '',
    item.specification ?? '',
    item.color ?? '',
    item.variant ?? ''
  ].map((v) => String(v).trim().toLowerCase()).join('|');

  return `fallback:${fallback}`;
}

function toNonNegativeNumber(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new TypeError(`${field} must be a finite non-negative number`);
  }
  return n;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { aggregateShipmentItems, computeShipmentTotals } from '../src/domain/aggregateShipment.mjs';

async function fixture(name) {
  const text = await readFile(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
  return JSON.parse(text);
}

test('factory A totals are computed from cartons × units per carton', async () => {
  const shipment = await fixture('factory-a-shipment.json');
  const totals = computeShipmentTotals(shipment.items);
  assert.deepEqual(totals, { cartons: 15, totalUnits: 4320 });
});

test('same SKU in front/back is preserved as two source rows but aggregated for statistics', async () => {
  const shipment = await fixture('factory-b-shipment.json');
  assert.equal(shipment.items.length, 2);

  const aggregated = aggregateShipmentItems(shipment.items);
  assert.equal(aggregated.length, 1);
  assert.equal(aggregated[0].sku, 'SKU-A');
  assert.equal(aggregated[0].cartons, 100);
  assert.equal(aggregated[0].totalUnits, 12000);
  assert.deepEqual(aggregated[0].sourceItemIds, ['b_item_1_front', 'b_item_1_back']);
});

test('mixed packing specification is surfaced, not silently normalized', () => {
  const aggregated = aggregateShipmentItems([
    {
      id: '1',
      skuObserved: 'SKU-X',
      productId: 'p-x',
      cartons: 5,
      unitsPerCarton: 120
    },
    {
      id: '2',
      skuObserved: 'SKU-X',
      productId: 'p-x',
      cartons: 5,
      unitsPerCarton: 144
    }
  ]);

  assert.equal(aggregated[0].hasMixedPacking, true);
  assert.deepEqual(aggregated[0].unitsPerCartonValues, [120, 144]);
  assert.equal(aggregated[0].totalUnits, 1320);
});

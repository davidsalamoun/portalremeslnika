import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTripCost } from '../src/utils/tripCost';

test('náhrada za jízdu: uložená částka, jinak vzdálenost × sazba, nikdy NaN', () => {
  assert.equal(getTripCost({ totalCost: 240, distanceKm: 24, ratePerKm: 10 }), 240);
  assert.equal(getTripCost({ distanceKm: 24, ratePerKm: 5.6 }), 134.4);
  assert.equal(getTripCost({}), 0);
  assert.equal(getTripCost({ totalCost: undefined, distanceKm: undefined, ratePerKm: 10 }), 0);
});

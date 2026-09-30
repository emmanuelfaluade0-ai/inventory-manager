const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateStock, getStock, getStockMap } = require('./stock');

test('calculateStock', async (t) => {
  await t.test('returns 0 when there are no movements', () => {
    assert.equal(calculateStock([]), 0);
  });

  await t.test('sums "in" movements', () => {
    assert.equal(
      calculateStock([
        { type: 'in', quantity: 5 },
        { type: 'in', quantity: 3 },
      ]),
      8
    );
  });

  await t.test('subtracts "out" movements', () => {
    assert.equal(
      calculateStock([
        { type: 'in', quantity: 10 },
        { type: 'out', quantity: 4 },
      ]),
      6
    );
  });

  await t.test('can go negative if the log is inconsistent', () => {
    assert.equal(calculateStock([{ type: 'out', quantity: 5 }]), -5);
  });
});

test('getStock', async (t) => {
  await t.test('scopes the query to the product and calculates the total', async () => {
    const calls = [];
    const client = {
      movement: {
        findMany: async (args) => {
          calls.push(args);
          return [
            { type: 'in', quantity: 10 },
            { type: 'out', quantity: 3 },
          ];
        },
      },
    };

    const stock = await getStock(client, 'product-1');

    assert.equal(stock, 7);
    assert.deepEqual(calls[0].where, { productId: 'product-1' });
  });
});

test('getStockMap', async (t) => {
  await t.test('returns 0 for a product with no movements', async () => {
    const client = { movement: { findMany: async () => [] } };
    const map = await getStockMap(client, ['a', 'b']);
    assert.equal(map.get('a'), 0);
    assert.equal(map.get('b'), 0);
  });

  await t.test('groups movements per product', async () => {
    const client = {
      movement: {
        findMany: async () => [
          { productId: 'a', type: 'in', quantity: 10 },
          { productId: 'a', type: 'out', quantity: 4 },
          { productId: 'b', type: 'in', quantity: 2 },
        ],
      },
    };

    const map = await getStockMap(client, ['a', 'b']);

    assert.equal(map.get('a'), 6);
    assert.equal(map.get('b'), 2);
  });

  await t.test('skips the query entirely for an empty id list', async () => {
    let called = false;
    const client = {
      movement: {
        findMany: async () => {
          called = true;
          return [];
        },
      },
    };

    const map = await getStockMap(client, []);

    assert.equal(map.size, 0);
    assert.equal(called, false);
  });
});

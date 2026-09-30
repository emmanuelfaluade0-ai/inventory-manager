// Stock is never stored — it's always derived from the movement log.
function calculateStock(movements) {
  return movements.reduce((total, movement) => {
    if (movement.type === 'in') return total + movement.quantity;
    if (movement.type === 'out') return total - movement.quantity;
    return total;
  }, 0);
}

async function getStock(client, productId) {
  const movements = await client.movement.findMany({
    where: { productId },
    select: { type: true, quantity: true },
  });
  return calculateStock(movements);
}

async function getStockMap(client, productIds) {
  const stockMap = new Map(productIds.map((id) => [id, 0]));
  if (productIds.length === 0) return stockMap;

  const movements = await client.movement.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true, type: true, quantity: true },
  });

  const byProduct = new Map(productIds.map((id) => [id, []]));
  for (const movement of movements) {
    byProduct.get(movement.productId)?.push(movement);
  }

  for (const [productId, productMovements] of byProduct) {
    stockMap.set(productId, calculateStock(productMovements));
  }

  return stockMap;
}

module.exports = { calculateStock, getStock, getStockMap };

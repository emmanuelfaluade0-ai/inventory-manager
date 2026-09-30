const express = require('express');
const { Prisma } = require('@prisma/client');
const prisma = require('../_lib/prisma');
const { sendError } = require('../_lib/errors');
const { calculateStock, getStockMap } = require('../_lib/stock');

const router = express.Router();

class NotFoundError extends Error {}

class InsufficientStockError extends Error {
  constructor(available) {
    super('Insufficient stock');
    this.available = available;
  }
}

router.get('/', async (req, res) => {
  const { search, lowStock } = req.query;

  const where = {};
  if (typeof search === 'string' && search.trim() !== '') {
    const term = search.trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { sku: { contains: term, mode: 'insensitive' } },
    ];
  }

  const products = await prisma.product.findMany({ where, orderBy: { name: 'asc' } });
  const stockMap = await getStockMap(prisma, products.map((product) => product.id));

  let results = products.map((product) => ({
    ...product,
    stock: stockMap.get(product.id) ?? 0,
  }));

  if (lowStock === 'true') {
    results = results.filter((product) => product.stock <= product.reorderThreshold);
  }

  res.json(results);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: { movements: { orderBy: { createdAt: 'desc' } } },
  });

  if (!product) {
    return sendError(res, 404, {
      message: 'Product not found',
      code: 'NOT_FOUND',
    });
  }

  const { movements, ...rest } = product;
  res.json({ ...rest, stock: calculateStock(movements), movements });
});

router.post('/', async (req, res) => {
  const { name, sku, reorderThreshold } = req.body ?? {};

  if (typeof name !== 'string' || name.trim() === '') {
    return sendError(res, 400, {
      message: 'name is required',
      field: 'name',
      code: 'VALIDATION_ERROR',
    });
  }

  if (typeof sku !== 'string' || sku.trim() === '') {
    return sendError(res, 400, {
      message: 'sku is required',
      field: 'sku',
      code: 'VALIDATION_ERROR',
    });
  }

  if (!Number.isInteger(reorderThreshold) || reorderThreshold < 0) {
    return sendError(res, 400, {
      message: 'reorderThreshold is required and must be a non-negative integer',
      field: 'reorderThreshold',
      code: 'VALIDATION_ERROR',
    });
  }

  try {
    const product = await prisma.product.create({
      data: { name: name.trim(), sku: sku.trim(), reorderThreshold },
    });
    res.status(201).json(product);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return sendError(res, 409, {
        message: `SKU "${sku.trim()}" is already in use`,
        field: 'sku',
        code: 'DUPLICATE_SKU',
      });
    }
    throw err;
  }
});

router.post('/:id/movements', async (req, res) => {
  const { id } = req.params;
  const { type, quantity, note } = req.body ?? {};

  if (type !== 'in' && type !== 'out') {
    return sendError(res, 400, {
      message: 'type must be "in" or "out"',
      field: 'type',
      code: 'VALIDATION_ERROR',
    });
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return sendError(res, 400, {
      message: 'quantity is required and must be a positive integer',
      field: 'quantity',
      code: 'VALIDATION_ERROR',
    });
  }

  if (note !== undefined && note !== null && typeof note !== 'string') {
    return sendError(res, 400, {
      message: 'note must be a string',
      field: 'note',
      code: 'VALIDATION_ERROR',
    });
  }
  const noteValue = typeof note === 'string' && note.trim() !== '' ? note.trim() : null;

  try {
    const movement = await prisma.$transaction(async (tx) => {
      if (type === 'out') {
        // Lock the product row so a second concurrent "out" request has to
        // wait for this transaction to commit before it can re-read stock.
        const locked = await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${id} FOR UPDATE`;
        if (locked.length === 0) throw new NotFoundError();

        const movements = await tx.movement.findMany({
          where: { productId: id },
          select: { type: true, quantity: true },
        });
        const available = calculateStock(movements);
        if (quantity > available) throw new InsufficientStockError(available);
      } else {
        const product = await tx.product.findUnique({ where: { id }, select: { id: true } });
        if (!product) throw new NotFoundError();
      }

      return tx.movement.create({
        data: { productId: id, type, quantity, note: noteValue },
      });
    }, { maxWait: 10000, timeout: 10000 });

    res.status(201).json(movement);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return sendError(res, 404, { message: 'Product not found', code: 'NOT_FOUND' });
    }
    if (err instanceof InsufficientStockError) {
      return sendError(res, 409, {
        message: `Only ${err.available} available`,
        available: err.available,
        code: 'INSUFFICIENT_STOCK',
      });
    }
    throw err;
  }
});

module.exports = router;

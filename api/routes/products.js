const express = require('express');
const { Prisma } = require('@prisma/client');
const prisma = require('../_lib/prisma');
const { sendError } = require('../_lib/errors');

const router = express.Router();

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

module.exports = router;

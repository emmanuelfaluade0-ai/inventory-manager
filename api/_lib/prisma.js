const { PrismaClient } = require('@prisma/client');

// Reuse the client across hot reloads / repeated function invocations
// instead of opening a new connection pool every time this is imported.
const prisma = global.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

module.exports = prisma;

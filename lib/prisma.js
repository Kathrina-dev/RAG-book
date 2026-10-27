'use strict';

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const globalForPrisma = globalThis;

let prisma;

if (globalForPrisma.prisma) {
  prisma = globalForPrisma.prisma;
} else {
  // Initialize the native PG connection driver pool
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });
  
  //  Bind it to the Prisma v7 adapter layer
  const adapter = new PrismaPg(pool);

  //  Instantiate PrismaClient with both the adapter and log configurations
  prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'warn', 'error']
      : ['warn', 'error'],
  });

  //  Cache the instance globally if we aren't in production mode
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
  }
}

module.exports = prisma;

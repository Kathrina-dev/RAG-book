'use strict';

const KEEP_ALIVE_INTERVAL_MS = 6 * 24 * 60 * 60 * 1000;

function startDatabaseKeepAlive(prisma) {
  const pingDatabase = async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('[database/keep-alive] Database ping succeeded.');
    } catch (error) {
      console.error('[database/keep-alive] Database ping failed:', error.message);
    }
  };

  const interval = setInterval(pingDatabase, KEEP_ALIVE_INTERVAL_MS);
  interval.unref();
  return interval;
}

module.exports = {
  startDatabaseKeepAlive,
};
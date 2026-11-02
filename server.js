'use strict';

const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const prisma = require('./lib/prisma');
const { startDatabaseKeepAlive } = require('./lib/databaseKeepAlive');
const apiRoutes = require('./index');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

startDatabaseKeepAlive(prisma);

// Global Middlewares
const allowedOrigins = [
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'https://ragbook.kathrinaelangbam.xyz',
  process.env.FRONTEND_ORIGIN,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin ${origin} is not allowed.`));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Bind the master routing engine
app.use('/api', apiRoutes);

// Serve built frontend if present
const frontendDist = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendDist));

// Infrastructure Probes
app.get('/', (req, res) => {
	res.json({ message: 'Server is running' });
});

app.get('/health', async (req, res) => {
	let dbStatus = 'ok';
	let dbLatencyMs = null;

	try {
		const start = Date.now();
		await prisma.$queryRaw`SELECT 1`;
		dbLatencyMs = Date.now() - start;
	} catch (err) {
		console.error('[health] DB connectivity check failed:', err.message);
		dbStatus = 'error';
	}

	const healthy = dbStatus === 'ok';
	return res.status(healthy ? 200 : 503).json({
		status: healthy ? 'ok' : 'degraded',
		db: {
			status: dbStatus,
			...(dbLatencyMs !== null && { latencyMs: dbLatencyMs }),
		},
	});
});

const server = app.listen(port, () => {
	console.log(`[server] Core backend engine listening on port ${port}`);
});

// Graceful Shutdown Management
async function shutdown(signal) {
	console.log(`[server] ${signal} received — shutting down gracefully`);
	server.close(async () => {
		await prisma.$disconnect();
		console.log('[server] Prisma disconnected safely. Exiting process.');
		process.exit(0);
	});
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

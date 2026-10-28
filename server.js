'use strict';

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const prisma = require('./lib/prisma');
const apiRoutes = require('./index');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Global Middlewares
app.use(cors());
app.use(express.json());

// Bind the master routing engine
app.use('/api', apiRoutes);

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

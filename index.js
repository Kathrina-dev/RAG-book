const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { router: authRouter } = require('./routes/auth');
const prisma = require('./lib/prisma');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

// Auth routes: POST /auth/login
app.use('/auth', authRouter);

app.get('/', (req, res) => {
	res.json({ message: 'Server is running' });
});

// Health check — includes a lightweight DB connectivity probe.
app.get('/health', async (req, res) => {
	let dbStatus = 'ok';
	let dbLatencyMs = null;

	try {
		const start = Date.now();
		// Minimal query: just checks the DB connection is alive.
		await prisma.$queryRaw`SELECT 1`;
		dbLatencyMs = Date.now() - start;
	} catch (err) {
		// Log the real error server-side; return a safe summary to the client.
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
	console.log(`Server listening on port ${port}`);
});

// Graceful shutdown: disconnect Prisma on SIGINT / SIGTERM
async function shutdown(signal) {
	console.log(`[server] ${signal} received — shutting down gracefully`);
	server.close(async () => {
		await prisma.$disconnect();
		console.log('[server] Prisma disconnected. Bye.');
		process.exit(0);
	});
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

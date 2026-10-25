import { createApp } from './app.js';
import { config } from './config/index.js';
import { prisma } from './prisma.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`AQ Companies Logistics & Financial Management API`);
  console.log(`Server running at http://localhost:${config.port}`);
  console.log(`Health check at http://localhost:${config.port}/api/health`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`=======================================================`);
});

// Graceful shutdown: stop accepting new connections, let in-flight requests
// finish, then release the database pool before exiting.
async function shutdown(signal: string) {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
    } catch {}
    process.exit(0);
  });
  // Force-exit if connections refuse to drain
  setTimeout(() => {
    console.warn('Forcing shutdown after 10s drain timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// Surface unexpected failures instead of dying silently
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled promise rejection:', reason);
});

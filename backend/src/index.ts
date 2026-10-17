import { createApp } from './app';
import { getConfig } from './config';
import { logger } from './lib/logger';

/**
 * Entry point. Render runs `node dist/index.js` (docs/11-deployment.md).
 */

function main(): void {
  let config;
  try {
    config = getConfig();
  } catch (error) {
    // A bad env is a deploy problem, not a runtime one. Say exactly what is
    // wrong and exit, rather than booting a server that 500s every request.
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(config.PORT, () => {
    logger.info('server.started', {
      port: config.PORT,
      env: config.NODE_ENV,
      aiProvider: config.AI_PROVIDER,
      model: config.AI_PROVIDER === 'claude' ? config.AI_MODEL : 'mock',
      authEnabled: Boolean(config.MVP_API_KEY),
    });
  });

  // Render sends SIGTERM on deploy. Finish in-flight commands rather than
  // dropping someone's leave mail mid-request.
  const shutdown = (signal: string) => {
    logger.info('server.shutdown', { signal });
    server.close(() => process.exit(0));
    // Don't hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();

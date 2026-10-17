import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getConfig } from './config';
import { getAiProvider } from './ai/router';
import { createHealthRouter } from './routes/health';
import { createCommandRouter } from './routes/command';
import { errorHandler, notFoundHandler } from './middleware/errors';
import type { AiProvider } from './ai/types';

/**
 * App factory.
 *
 * The AI provider is injected rather than imported at module scope so the test
 * suite can pass a stub. That keeps tests off the network and off jest's module
 * mocking, which is what made the 20-case suite in docs/10-testing.md practical
 * to write without an API key.
 */

export interface CreateAppOptions {
  aiProvider?: AiProvider;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const config = getConfig();
  const aiProvider = options.aiProvider ?? getAiProvider();

  const app = express();

  // Behind Render's proxy, so req.ip must come from X-Forwarded-For or every
  // client shares one rate-limit bucket.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      // The mobile app is a native client and sends no Origin header, so an
      // empty list is harmless. It only matters if a web client is added.
      origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
    })
  );
  // 64kb is generous for a 500-character command plus context, and caps the
  // size of anything an attacker can make us parse.
  app.use(express.json({ limit: '64kb' }));

  app.use(createHealthRouter());
  app.use(createCommandRouter(aiProvider));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

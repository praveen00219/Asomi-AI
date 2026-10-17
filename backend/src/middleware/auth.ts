import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { getConfig } from '../config';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/errors';

/**
 * MVP auth: one shared secret the app sends as `x-api-key`.
 *
 * docs/07-api.md marks /v1/command as "MVP: API key, v2: user token". Phase 9
 * replaces this with Supabase token verification; the middleware boundary stays
 * the same, so routes do not change.
 *
 * Required in production (config.ts refuses to boot without MVP_API_KEY), and
 * skipped with a warning in development so local work needs no setup.
 */

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const requireApiKey: RequestHandler = (req, _res, next) => {
  const config = getConfig();

  if (!config.MVP_API_KEY) {
    // config.ts guarantees this branch is unreachable in production.
    logger.warn('auth.disabled', {
      reason: 'MVP_API_KEY not set - endpoint is open. Development only.',
    });
    next();
    return;
  }

  const header = req.get('x-api-key') ?? '';
  const bearer = req.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const provided = header || bearer;

  if (!provided || !constantTimeEquals(provided, config.MVP_API_KEY)) {
    throw new AppError('UNAUTHORIZED', 'Missing or invalid API key.', {
      reason: provided ? 'key_mismatch' : 'key_absent',
    });
  }

  next();
};

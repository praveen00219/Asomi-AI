import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import type { Request } from 'express';
import { getConfig } from '../config';

/**
 * Rate limiting, per docs/09-security-and-privacy.md:
 * "20 requests per minute per user, 5 per minute per IP without login."
 *
 * Every request costs real money at the AI provider, so this is a spend control
 * as much as an abuse control.
 */

const WINDOW_MS = 60_000;

function rateLimitedResponse(): Pick<Options, 'handler'> {
  return {
    handler: (_req, res) => {
      // Matches the error envelope in docs/07-api.md rather than
      // express-rate-limit's default plain-text body.
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
      });
    },
  };
}

/**
 * Identify by API key when present, else by IP.
 *
 * The IP branch goes through `ipKeyGenerator`, which buckets IPv6 addresses by
 * /64 subnet. A raw `req.ip` would let an IPv6 client walk through the trillions
 * of addresses in its own prefix and sail past the 5-per-minute limit, since
 * each one looks like a new client. Residential IPv6 is common in India, so
 * this is the path that matters, not an edge case.
 */
function clientKey(req: Request): string {
  const key = req.get('x-api-key') ?? req.get('authorization');
  if (key) return `key:${key}`;
  return `ip:${ipKeyGenerator(req.ip ?? 'unknown')}`;
}

export function createCommandRateLimiter() {
  const config = getConfig();

  return rateLimit({
    windowMs: WINDOW_MS,
    // The unauthenticated IP limit is the tighter of the two, so apply it
    // whenever no key is present.
    limit: (req: Request) => (req.get('x-api-key') || req.get('authorization') ? 20 : 5),
    keyGenerator: clientKey,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Tests fire bursts deliberately; only the rate-limit test enables this.
    skip: () => config.isTest && process.env.ENABLE_RATE_LIMIT_IN_TESTS !== 'true',
    ...rateLimitedResponse(),
  });
}

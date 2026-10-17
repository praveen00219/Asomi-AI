import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment config, parsed and validated once at boot.
 *
 * A bad config fails fast and loudly here rather than surfacing as a confusing
 * 500 on the first command. Every value the app reads goes through this object -
 * nothing else touches `process.env`.
 */

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    CORS_ORIGINS: z.string().default(''),

    AI_PROVIDER: z.enum(['claude', 'mock']).default('claude'),
    ANTHROPIC_API_KEY: z.string().optional(),
    AI_MODEL: z.string().min(1).default('claude-haiku-4-5'),
    AI_FALLBACK_MODEL: z.string().min(1).default('claude-sonnet-5'),
    AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(6000),
    AI_STRICT_TOOLS: booleanish.default(true),

    MVP_API_KEY: z.string().optional(),
    FREE_DAILY_LIMIT: z.coerce.number().int().min(1).default(10),
    SENTRY_DSN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    // The Claude provider is useless without a key. Catch it at boot rather
    // than on a user's first command.
    if (env.AI_PROVIDER === 'claude' && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['ANTHROPIC_API_KEY'],
        message:
          'ANTHROPIC_API_KEY is required when AI_PROVIDER=claude. ' +
          'Set a key, or use AI_PROVIDER=mock to run without one.',
      });
    }

    // An unauthenticated public endpoint that spends money on every request is
    // not something to discover in production.
    if (env.NODE_ENV === 'production' && !env.MVP_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['MVP_API_KEY'],
        message: 'MVP_API_KEY is required when NODE_ENV=production.',
      });
    }
  });

export type Config = Readonly<
  z.infer<typeof EnvSchema> & {
    corsOrigins: string[];
    isProduction: boolean;
    isTest: boolean;
  }
>;

function buildConfig(): Config {
  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid server configuration:\n${details}`);
  }

  const env = parsed.data;

  return Object.freeze({
    ...env,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  });
}

let cached: Config | undefined;

/** Lazily built so importing a module never throws on a bad env (tests). */
export function getConfig(): Config {
  if (!cached) cached = buildConfig();
  return cached;
}

/** Test-only: drop the memoized config so a new env can be parsed. */
export function resetConfigForTests(): void {
  cached = undefined;
}

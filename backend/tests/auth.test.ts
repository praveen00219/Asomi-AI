import request from 'supertest';
import { resetConfigForTests } from '../src/config';
import { requestBody, stubProvider } from './fixtures/aiResponses';

/**
 * Auth and rate limiting both read config at app-creation time, so each test
 * here sets the env it needs and re-imports createApp through a fresh module
 * registry. jest.isolateModulesAsync keeps that contained to one test.
 */

async function freshApp(env: Record<string, string | undefined>) {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  resetConfigForTests();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  await jest.isolateModulesAsync(async () => {
    const { createApp } = await import('../src/app');
    app = createApp({ aiProvider: stubProvider('ok') });
  });

  return {
    app,
    restore: () => {
      process.env = previous;
      resetConfigForTests();
    },
  };
}

describe('API key auth', () => {
  it('rejects a request with no key when MVP_API_KEY is set', async () => {
    const { app, restore } = await freshApp({ MVP_API_KEY: 'secret-key' });

    try {
      const res = await request(app).post('/v1/command').send(requestBody());

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    } finally {
      restore();
    }
  });

  it('rejects a wrong key', async () => {
    const { app, restore } = await freshApp({ MVP_API_KEY: 'secret-key' });

    try {
      const res = await request(app)
        .post('/v1/command')
        .set('x-api-key', 'wrong-key')
        .send(requestBody());

      expect(res.status).toBe(401);
    } finally {
      restore();
    }
  });

  it('accepts the correct key via x-api-key', async () => {
    const { app, restore } = await freshApp({ MVP_API_KEY: 'secret-key' });

    try {
      const res = await request(app)
        .post('/v1/command')
        .set('x-api-key', 'secret-key')
        .send(requestBody());

      expect(res.status).toBe(200);
    } finally {
      restore();
    }
  });

  it('accepts the correct key via Authorization: Bearer', async () => {
    const { app, restore } = await freshApp({ MVP_API_KEY: 'secret-key' });

    try {
      const res = await request(app)
        .post('/v1/command')
        .set('authorization', 'Bearer secret-key')
        .send(requestBody());

      expect(res.status).toBe(200);
    } finally {
      restore();
    }
  });

  it('leaves the endpoint open in development when no key is configured', async () => {
    const { app, restore } = await freshApp({ MVP_API_KEY: undefined });

    try {
      const res = await request(app).post('/v1/command').send(requestBody());

      expect(res.status).toBe(200);
    } finally {
      restore();
    }
  });
});

describe('config validation', () => {
  it('refuses to build a production config without MVP_API_KEY', async () => {
    const previous = { ...process.env };
    process.env.NODE_ENV = 'production';
    process.env.MVP_API_KEY = undefined;
    delete process.env.MVP_API_KEY;
    resetConfigForTests();

    try {
      const { getConfig } = await import('../src/config');
      expect(() => getConfig()).toThrow(/MVP_API_KEY is required/);
    } finally {
      process.env = previous;
      resetConfigForTests();
    }
  });

  it('refuses the claude provider with no API key', async () => {
    const previous = { ...process.env };
    process.env.AI_PROVIDER = 'claude';
    delete process.env.ANTHROPIC_API_KEY;
    resetConfigForTests();

    try {
      const { getConfig } = await import('../src/config');
      expect(() => getConfig()).toThrow(/ANTHROPIC_API_KEY is required/);
    } finally {
      process.env = previous;
      resetConfigForTests();
    }
  });
});

describe('rate limiting', () => {
  it('returns RATE_LIMITED after 5 unauthenticated requests in a minute', async () => {
    const { app, restore } = await freshApp({
      MVP_API_KEY: undefined,
      ENABLE_RATE_LIMIT_IN_TESTS: 'true',
    });

    try {
      const statuses: number[] = [];
      for (let i = 0; i < 7; i++) {
        const res = await request(app).post('/v1/command').send(requestBody());
        statuses.push(res.status);
      }

      // Unauthenticated limit is 5/min per docs/09-security-and-privacy.md.
      expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
      expect(statuses[5]).toBe(429);

      const limited = await request(app).post('/v1/command').send(requestBody());
      expect(limited.body.error.code).toBe('RATE_LIMITED');
    } finally {
      restore();
    }
  });
});

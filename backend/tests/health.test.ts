import request from 'supertest';
import { createApp } from '../src/app';
import { stubProvider } from './fixtures/aiResponses';

describe('GET /health', () => {
  const app = createApp({ aiProvider: stubProvider('ok') });

  it('reports ok without auth', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'asomi-server' });
  });

  it('returns the documented error envelope for an unknown route', async () => {
    const res = await request(app).get('/v1/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BAD_INPUT');
  });
});

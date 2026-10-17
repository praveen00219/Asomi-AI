import { Router } from 'express';

/**
 * GET /health
 *
 * Render's health check path (docs/11-deployment.md). Unauthenticated and
 * dependency-free on purpose: it answers "is this process up", not "is the AI
 * provider reachable". A health check that calls the AI would cost money on
 * every ping and would fail the deploy over someone else's outage.
 */

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'asomi-server',
      version: process.env.npm_package_version ?? '0.1.0',
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  return router;
}

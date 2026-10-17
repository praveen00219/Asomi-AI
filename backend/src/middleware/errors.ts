import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../lib/logger';

/**
 * Central error handling.
 *
 * Error codes and their HTTP statuses come straight from
 * project_planning/docs/07-api.md. The wire shape is always:
 *   { "error": { "code": "...", "message": "..." } }
 *
 * Nothing internal leaks: no stack traces, no raw AI payloads, no env values.
 */

export const ERROR_CODES = {
  BAD_INPUT: 400,
  UNAUTHORIZED: 401,
  LIMIT_REACHED: 429,
  RATE_LIMITED: 429,
  AI_ERROR: 502,
  SERVER_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  /** Internal-only context for logs. Never serialized to the client. */
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_CODES[code];
    this.details = details;
  }
}

/** 404 for anything that didn't match a route. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'BAD_INPUT', message: `No route for ${req.method} ${req.path}` },
  });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    // Client errors are expected traffic; only log them at warn and above when
    // they signal something actionable on our side.
    const level = err.status >= 500 ? 'error' : 'warn';
    logger[level](err.message, {
      code: err.code,
      status: err.status,
      path: req.path,
      ...err.details,
    });

    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  // Express 5 forwards rejected promises here automatically, so an unexpected
  // throw anywhere in a handler lands in this branch.
  logger.error('Unhandled error', {
    path: req.path,
    // Message only - a stack in logs is fine, but keep it off the response.
    reason: err instanceof Error ? err.message : String(err),
  });

  res.status(500).json({
    error: { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' },
  });
};

import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/errors';
import { requireApiKey } from '../middleware/auth';
import { createCommandRateLimiter } from '../middleware/rateLimit';
import { CommandRequestSchema, type CommandResponse } from '../schemas/command';
import { validateToolCalls } from '../schemas/toolInputs';
import type { AiProvider } from '../ai/types';

/**
 * POST /v1/command - the one endpoint that matters.
 *
 * Text in, actions plus a reply out. Four steps:
 *   1. Validate the request with Zod.
 *   2. Ask the AI provider which tools to call.
 *   3. Validate every tool input and stamp `risky` from the server's own list.
 *   4. Return { requestId, reply, actions }.
 *
 * The server runs nothing itself. Calls, alarms, Gmail and UPI all happen on
 * the phone, which is what keeps contacts, numbers and the Google token off
 * this machine entirely.
 */

export function createCommandRouter(aiProvider: AiProvider): Router {
  const router = Router();

  router.post('/v1/command', createCommandRateLimiter(), requireApiKey, async (req, res) => {
    const requestId = `cmd_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const startedAt = Date.now();

    const parsed = CommandRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new AppError(
        'BAD_INPUT',
        first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid request body.',
        { requestId }
      );
    }

    const request = parsed.data;

    const result = await aiProvider.interpret({
      text: request.text,
      now: request.now,
      timezone: request.timezone,
      language: request.language,
      userName: request.userName,
      savedEmailNames: request.savedEmailNames,
    });

    // Throws AI_ERROR on an unknown tool, out-of-range input, or a burst of
    // actions. Nothing unvalidated reaches the phone.
    const actions = validateToolCalls(result.toolCalls);

    // A turn with no tools and no text is a dead end for a voice assistant -
    // the phone would have nothing to speak. Better an honest retry prompt.
    const reply =
      result.reply ||
      (actions.length > 0 ? 'Ho gaya.' : 'Samajh nahi aaya, ek baar phir boliye.');

    const response: CommandResponse = { requestId, reply, actions };

    // Command text, contact names and email bodies are deliberately absent -
    // docs/09-security-and-privacy.md keeps PII out of logs.
    logger.info('command.handled', {
      requestId,
      latencyMs: Date.now() - startedAt,
      language: request.language,
      textLength: request.text.length,
      actionCount: actions.length,
      riskyCount: actions.filter((a) => a.risky).length,
      tools: actions.map((a) => a.name),
      model: result.usage.model,
      usedFallback: result.usage.usedFallback,
      cacheReadTokens: result.usage.cacheReadTokens,
    });

    res.json(response);
  });

  return router;
}

import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/errors';
import { buildSystemPrompt } from './prompt';
import { buildTools } from './tools';
import type { AiProvider, InterpretInput, InterpretResult, RawToolCall } from './types';

/**
 * Claude provider. Reached only through ai/router.ts.
 *
 * MODEL CHOICE
 * Haiku 4.5 primary, Sonnet 5 on failure. Picking a command's tools is a fast
 * classification job, not a reasoning job, and the product has hard budgets to
 * meet: under 4 seconds end-to-end and under Rs 0.50 per command
 * (docs/02-product-requirements.md).
 *
 * NO THINKING, NO EFFORT
 * `output_config.effort` errors on Haiku 4.5, and extended thinking would blow
 * the latency budget on a task that does not need it. The Sonnet 5 fallback
 * explicitly disables thinking for the same reason - on that model omitting the
 * parameter runs adaptive thinking, which is not what we want here.
 */

// A few tool calls plus a one-line reply. The one output that needs real room
// is a generated email body, and 2048 covers that comfortably. The SDK's 16000
// default is for long prose and would only widen the timeout window.
const MAX_TOKENS = 2048;

let client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!client) {
    const config = getConfig();
    client = new Anthropic({
      apiKey: config.ANTHROPIC_API_KEY,
      // NOTE: the TypeScript SDK takes milliseconds (the Python SDK takes
      // seconds). Retries are handled by hand below so a failure can switch
      // models rather than just repeating the same losing request.
      timeout: config.AI_TIMEOUT_MS,
      maxRetries: 0,
    });
  }
  return client;
}

/** Test-only: drop the memoized client so a new config takes effect. */
export function resetClientForTests(): void {
  client = undefined;
}

function extractResult(message: Anthropic.Messages.Message, usedFallback: boolean): InterpretResult {
  const toolCalls: RawToolCall[] = [];
  const textParts: string[] = [];

  for (const block of message.content) {
    if (block.type === 'tool_use') {
      toolCalls.push({ name: block.name, input: block.input });
    } else if (block.type === 'text') {
      textParts.push(block.text);
    }
  }

  return {
    reply: textParts.join(' ').trim(),
    toolCalls,
    usage: {
      model: message.model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: message.usage.cache_creation_input_tokens ?? 0,
      usedFallback,
    },
  };
}

/**
 * Worth retrying on the other model? Timeouts, rate limits and 5xx are
 * transient. A 400 or 401 is our bug or our key - repeating it on a second
 * model just burns another few seconds before the same failure.
 */
function isWorthFallback(error: unknown): boolean {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return true;
  if (error instanceof Anthropic.APIConnectionError) return true;
  if (error instanceof Anthropic.RateLimitError) return true;
  if (error instanceof Anthropic.InternalServerError) return true;
  if (error instanceof Anthropic.APIError) {
    return typeof error.status === 'number' && error.status >= 500;
  }
  return false;
}

function toAppError(error: unknown): AppError {
  if (error instanceof Anthropic.AuthenticationError) {
    // Our key is wrong - the user can do nothing about it, so don't blame them.
    return new AppError('AI_ERROR', 'AI service is unavailable. Please try again.', {
      reason: 'auth_failed',
    });
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new AppError('AI_ERROR', 'AI service rejected the request.', {
      reason: 'bad_request',
      // Surfaces an AI_STRICT_TOOLS incompatibility immediately instead of
      // leaving it as a mystery 502.
      apiMessage: error.message,
    });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AppError('AI_ERROR', 'AI service is busy. Please try again.', {
      reason: 'rate_limited',
    });
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AppError('AI_ERROR', 'AI service timed out. Please try again.', {
      reason: 'timeout',
    });
  }
  if (error instanceof Anthropic.APIError) {
    return new AppError('AI_ERROR', 'AI service failed. Please try again.', {
      reason: 'api_error',
      status: error.status,
    });
  }
  return new AppError('AI_ERROR', 'AI service failed. Please try again.', {
    reason: 'unknown',
    detail: error instanceof Error ? error.message : String(error),
  });
}

async function callModel(
  model: string,
  input: InterpretInput,
  disableThinking: boolean
): Promise<Anthropic.Messages.Message> {
  return getClient().messages.create({
    model,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(input),
    tools: buildTools(),
    messages: [{ role: 'user', content: input.text }],
    // Sonnet 5 runs adaptive thinking when `thinking` is omitted, which costs
    // seconds we do not have. Haiku 4.5 predates adaptive thinking and must not
    // receive the parameter at all.
    ...(disableThinking ? { thinking: { type: 'disabled' as const } } : {}),
  });
}

export const claudeProvider: AiProvider = {
  name: 'claude',

  async interpret(input: InterpretInput): Promise<InterpretResult> {
    const config = getConfig();
    const startedAt = Date.now();

    try {
      const message = await callModel(config.AI_MODEL, input, false);
      const result = extractResult(message, false);

      // Log cache numbers on every call. A silently dead cache is the single
      // most expensive thing that can go wrong here, and zero reads on a warm
      // prefix is the only signal it gives.
      logger.info('ai.interpret', {
        model: result.usage.model,
        latencyMs: Date.now() - startedAt,
        toolCount: result.toolCalls.length,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cacheReadTokens: result.usage.cacheReadTokens,
        cacheCreationTokens: result.usage.cacheCreationTokens,
      });

      return result;
    } catch (primaryError) {
      if (!isWorthFallback(primaryError)) {
        throw toAppError(primaryError);
      }

      logger.warn('ai.primary_failed', {
        model: config.AI_MODEL,
        latencyMs: Date.now() - startedAt,
        reason: primaryError instanceof Error ? primaryError.message : String(primaryError),
      });

      try {
        // Thinking off on the fallback too - a rescue attempt that takes ten
        // seconds to reason is no rescue for a voice assistant.
        const message = await callModel(config.AI_FALLBACK_MODEL, input, true);
        const result = extractResult(message, true);

        logger.info('ai.interpret', {
          model: result.usage.model,
          latencyMs: Date.now() - startedAt,
          toolCount: result.toolCalls.length,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          cacheReadTokens: result.usage.cacheReadTokens,
          cacheCreationTokens: result.usage.cacheCreationTokens,
          usedFallback: true,
        });

        return result;
      } catch (fallbackError) {
        logger.error('ai.fallback_failed', {
          model: config.AI_FALLBACK_MODEL,
          latencyMs: Date.now() - startedAt,
          reason: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
        throw toAppError(fallbackError);
      }
    }
  },
};

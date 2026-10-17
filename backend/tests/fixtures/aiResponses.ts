import type { AiProvider, InterpretInput, InterpretResult, RawToolCall } from '../../src/ai/types';

/**
 * Test doubles for the AI provider.
 *
 * createApp() takes an injected AiProvider, so the suite exercises the real
 * validation, risk-stamping and error paths without touching the network or
 * needing an API key. What the model would have returned is the one thing we
 * stub; everything downstream of it is the code under test.
 */

export const ZERO_USAGE = {
  model: 'stub',
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  usedFallback: false,
};

/** A provider that always returns the same canned answer. */
export function stubProvider(reply: string, toolCalls: RawToolCall[] = []): AiProvider {
  return {
    name: 'stub',
    async interpret(): Promise<InterpretResult> {
      return { reply, toolCalls, usage: ZERO_USAGE };
    },
  };
}

/** A provider that throws, for exercising the AI_ERROR path. */
export function throwingProvider(error: Error): AiProvider {
  return {
    name: 'stub-throwing',
    async interpret(): Promise<InterpretResult> {
      throw error;
    },
  };
}

/** Captures the input the route passed through, to assert on context plumbing. */
export function recordingProvider(result: InterpretResult): {
  provider: AiProvider;
  calls: InterpretInput[];
} {
  const calls: InterpretInput[] = [];
  return {
    calls,
    provider: {
      name: 'stub-recording',
      async interpret(input: InterpretInput): Promise<InterpretResult> {
        calls.push(input);
        return result;
      },
    },
  };
}

/** Valid request body with sensible defaults. Override per test. */
export function requestBody(overrides: Record<string, unknown> = {}) {
  return {
    text: 'test command',
    now: '2026-10-14T11:45:00+05:30',
    timezone: 'Asia/Kolkata',
    language: 'hinglish',
    userName: 'Praveen',
    savedEmailNames: ['disha hr', 'manager'],
    ...overrides,
  };
}

/** A future ISO datetime, so reminder tests don't rot as the clock moves. */
export function futureIso(hoursAhead = 6): string {
  return new Date(Date.now() + hoursAhead * 3600_000).toISOString();
}

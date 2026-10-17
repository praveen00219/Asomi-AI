import type { AiProvider, InterpretInput, InterpretResult, RawToolCall } from './types';

/**
 * Deterministic provider for development without an API key.
 *
 * This is NOT the phone's `localIntent` matcher (CLAUDE.md asks for that on the
 * device, so simple commands never hit the network at all) and it is not a
 * fallback when Claude fails - a wrong guess on a call or a payment is worse
 * than an honest error. It exists so the mobile app can be built against a live
 * endpoint for free, and so `npm test` never needs a key.
 *
 * Keyword matching only. Anything it does not recognize comes back as a reply
 * with no actions.
 */

const HOUR_WORDS: Array<{ pattern: RegExp; shift: 'am' | 'pm' }> = [
  { pattern: /\b(subah|morning)\b/i, shift: 'am' },
  { pattern: /\b(dopahar|afternoon)\b/i, shift: 'pm' },
  { pattern: /\b(shaam|evening)\b/i, shift: 'pm' },
  { pattern: /\b(raat|night)\b/i, shift: 'pm' },
];

function resolveHour(text: string, rawHour: number): number {
  if (rawHour === 0 || rawHour > 12) return rawHour;

  for (const { pattern, shift } of HOUR_WORDS) {
    if (pattern.test(text)) {
      if (shift === 'pm') return rawHour === 12 ? 12 : rawHour + 12;
      return rawHour === 12 ? 0 : rawHour;
    }
  }
  // No time word: an alarm with a bare hour means morning.
  return rawHour;
}

function matchCommand(text: string): { toolCalls: RawToolCall[]; reply: string } {
  const lower = text.toLowerCase();

  // Timer: a duration, so check before alarm (both mention minutes).
  const timerMatch = lower.match(/(\d+)\s*(minute|min|ghante|ghanta|hour|second|sec)/);
  if (timerMatch && /timer/.test(lower)) {
    const amount = Number(timerMatch[1]);
    const unit = timerMatch[2] ?? 'minute';
    const seconds = /ghante|ghanta|hour/.test(unit)
      ? amount * 3600
      : /second|sec/.test(unit)
        ? amount
        : amount * 60;
    return {
      toolCalls: [{ name: 'set_timer', input: { seconds } }],
      reply: `${amount} ${unit} ka timer shuru kar diya.`,
    };
  }

  // Alarm: a clock time.
  if (/alarm/.test(lower)) {
    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(?:baje|am|pm|o'clock)?/);
    const rawHour = timeMatch ? Number(timeMatch[1]) : 7;
    const minute = timeMatch?.[2] ? Number(timeMatch[2]) : 0;
    const hour = resolveHour(lower, rawHour);
    return {
      toolCalls: [{ name: 'set_alarm', input: { hour, minute, label: 'Alarm' } }],
      reply: `${hour}:${String(minute).padStart(2, '0')} ka alarm laga diya.`,
    };
  }

  if (/\b(call|phone)\b/.test(lower)) {
    const nameMatch = text.match(/^(?:call\s+)?(.+?)\s+ko\s+(?:call|phone)/i);
    const name = nameMatch?.[1]?.trim();
    if (!name) {
      return { toolCalls: [], reply: 'Kisko call karna hai?' };
    }
    return {
      toolCalls: [{ name: 'make_call', input: { contact_name: name } }],
      reply: `${name} ko call kar raha hoon.`,
    };
  }

  if (/\b(kholo|khol|open)\b/.test(lower)) {
    const appMatch = lower.match(
      /\b(whatsapp|instagram|youtube|gmail|facebook|spotify|paytm|settings|camera)\b/
    );
    if (appMatch?.[1]) {
      return {
        toolCalls: [{ name: 'open_app', input: { app_name: appMatch[1] } }],
        reply: `${appMatch[1]} khol diya.`,
      };
    }
  }

  if (/\b(photo|selfie)\b/.test(lower)) {
    return {
      toolCalls: [{ name: 'take_photo', input: {} }],
      reply: 'Camera khol diya.',
    };
  }

  return {
    toolCalls: [],
    reply: 'Mock mode mein yeh command nahi samjha. Set AI_PROVIDER=claude for real answers.',
  };
}

export const mockProvider: AiProvider = {
  name: 'mock',

  async interpret(input: InterpretInput): Promise<InterpretResult> {
    const { toolCalls, reply } = matchCommand(input.text);

    return {
      reply,
      toolCalls,
      usage: {
        model: 'mock',
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        usedFallback: false,
      },
    };
  },
};

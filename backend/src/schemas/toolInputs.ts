import { z } from 'zod';
import { AppError } from '../middleware/errors';
import { isKnownTool, type ToolName } from '../ai/tools';
import { isRisky, assertWithinActionCaps } from '../lib/risky';
import type { CommandAction } from './command';
import type { RawToolCall } from '../ai/types';

/**
 * Validation of what the AI returned, before any of it reaches the phone.
 *
 * Security checklist (docs/09-security-and-privacy.md): "Zod checks every
 * request and every AI tool output before it reaches the phone."
 *
 * These schemas enforce real-world bounds, not just types. An hour of 25 or a
 * payment of 10,00,000 is type-correct and still wrong, and the phone turns
 * these values straight into Android intents and UPI links.
 */

const nonEmpty = (max: number) => z.string().trim().min(1).max(max);

/** Future-dated ISO 8601. A reminder in the past silently never fires. */
const futureIsoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'must be an ISO 8601 datetime' })
  .refine((v) => Date.parse(v) > Date.now() - 60_000, {
    // One minute of slack absorbs clock skew between phone and server.
    message: 'must be in the future',
  });

const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'must be an ISO 8601 datetime' });

/**
 * Upper bound on a voice-initiated payment.
 *
 * The user still enters their UPI PIN, so this is not the only safeguard - but
 * a voice assistant should not be able to stage a six-figure transfer from a
 * misheard number or an injected instruction.
 */
const MAX_UPI_AMOUNT = 100_000;

export const TOOL_INPUT_SCHEMAS: Record<ToolName, z.ZodType> = {
  open_app: z.object({ app_name: nonEmpty(40) }).strict(),

  make_call: z.object({ contact_name: nonEmpty(80) }).strict(),

  send_email: z
    .object({
      to_name: nonEmpty(80),
      subject: nonEmpty(200),
      body: nonEmpty(5000),
    })
    .strict(),

  send_whatsapp: z
    .object({
      contact_name: nonEmpty(80),
      message: nonEmpty(2000),
    })
    .strict(),

  send_sms: z
    .object({
      contact_name: nonEmpty(80),
      // SMS is billed per 160-char segment; a voice-written SMS has no business
      // running past a couple of them.
      message: nonEmpty(320),
    })
    .strict(),

  set_alarm: z
    .object({
      hour: z.number().int().min(0).max(23),
      minute: z.number().int().min(0).max(59),
      label: z.string().trim().max(60).optional(),
    })
    .strict(),

  set_timer: z
    .object({
      // One second to 24 hours. The SET_TIMER intent rejects zero or negative.
      seconds: z.number().int().min(1).max(86_400),
      label: z.string().trim().max(60).optional(),
    })
    .strict(),

  set_reminder: z
    .object({
      datetime: futureIsoDateTime,
      text: nonEmpty(300),
    })
    .strict(),

  add_calendar_event: z
    .object({
      title: nonEmpty(200),
      start: isoDateTime,
      end: isoDateTime.optional(),
    })
    .strict()
    .refine((v) => !v.end || Date.parse(v.end) > Date.parse(v.start), {
      message: 'end must be after start',
    }),

  take_photo: z.object({}).strict(),

  navigate: z.object({ destination: nonEmpty(200) }).strict(),

  get_weather: z
    .object({
      city: z.string().trim().max(80).optional(),
      day: z.enum(['today', 'tomorrow', 'week']).optional(),
    })
    .strict(),

  play_media: z
    .object({
      app: z.enum(['youtube', 'spotify']),
      query: nonEmpty(200),
    })
    .strict(),

  web_search: z.object({ query: nonEmpty(200) }).strict(),

  upi_pay: z
    .object({
      contact_name: nonEmpty(80),
      // Two decimal places max - paise, not floating-point dust.
      amount: z.number().positive().max(MAX_UPI_AMOUNT).multipleOf(0.01),
      note: z.string().trim().max(100).optional(),
    })
    .strict(),

  save_note: z.object({ text: nonEmpty(1000) }).strict(),

  log_expense: z
    .object({
      amount: z.number().positive().max(MAX_UPI_AMOUNT).multipleOf(0.01),
      category: z.enum(['food', 'travel', 'bills', 'shopping', 'health', 'other']),
      note: z.string().trim().max(100).optional(),
    })
    .strict(),
};

/**
 * Turn raw tool calls into validated, risk-stamped actions.
 *
 * WHY THIS THROWS INSTEAD OF DROPPING BAD ACTIONS
 * The AI's reply text is written assuming all of its tool calls will run. Drop
 * one quietly and the user hears "alarm laga diya" while no alarm exists -
 * a silent failure on an assistant people are meant to trust with leave mails
 * and payments. Failing the whole command lets the phone say "samajh nahi aaya"
 * honestly, and the user simply repeats themselves.
 */
export function validateToolCalls(toolCalls: readonly RawToolCall[]): CommandAction[] {
  assertWithinActionCaps(toolCalls.map((call) => call.name));

  return toolCalls.map((call) => {
    if (!isKnownTool(call.name)) {
      // A hallucinated tool name. The phone has no handler for it, so this
      // would be a no-op the reply still claims happened.
      throw new AppError('AI_ERROR', 'Could not complete that. Please try again.', {
        reason: 'unknown_tool',
        tool: call.name,
      });
    }

    const schema = TOOL_INPUT_SCHEMAS[call.name];
    const parsed = schema.safeParse(call.input ?? {});

    if (!parsed.success) {
      throw new AppError('AI_ERROR', 'Could not complete that. Please try again.', {
        reason: 'invalid_tool_input',
        tool: call.name,
        // Field paths and messages only - never the values, which can contain
        // contact names and email bodies.
        issues: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
      });
    }

    return {
      name: call.name,
      input: parsed.data as Record<string, unknown>,
      // The single place `risky` is ever assigned. Anything the model may have
      // said about risk was discarded when we rebuilt the object from
      // parsed.data.
      risky: isRisky(call.name),
    };
  });
}

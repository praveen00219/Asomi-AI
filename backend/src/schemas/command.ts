import { z } from 'zod';

/**
 * Request and response schemas for POST /v1/command.
 * Shape mirrors docs/07-api.md exactly.
 */

/** ISO 8601 with an offset, e.g. "2026-10-14T11:45:00+05:30". */
const isoDateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'must be an ISO 8601 datetime' });

export const CommandRequestSchema = z
  .object({
    // 500 chars is the documented cap. It also bounds AI input cost - nobody
    // speaks 500 characters into a voice assistant in one breath.
    text: z.string().trim().min(1, 'text is required').max(500, 'text must be 500 characters or fewer'),
    now: isoDateTime,
    timezone: z.string().min(1).default('Asia/Kolkata'),
    language: z.enum(['hindi', 'english', 'hinglish']).default('hinglish'),
    userName: z.string().trim().max(60).optional(),
    // Names only, never addresses: docs/09-security-and-privacy.md keeps email
    // addresses on the phone. The AI picks a short name; the phone resolves it.
    savedEmailNames: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  })
  .strict();

export type CommandRequest = z.infer<typeof CommandRequestSchema>;

export interface CommandAction {
  name: string;
  input: Record<string, unknown>;
  /** Set by the server from lib/risky.ts. Never from the AI. */
  risky: boolean;
}

export interface CommandResponse {
  requestId: string;
  reply: string;
  actions: CommandAction[];
}

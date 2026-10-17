import type Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config';

/**
 * The 17 tools Asomi exposes to the AI. Mirrors the table in docs/07-api.md.
 *
 * THREE RULES FOR THIS FILE:
 *
 * 1. Fixed order. Tool definitions render FIRST in the cached prefix
 *    (tools -> system -> messages), so a reordered array silently destroys
 *    every cache hit. Keep this a literal array; never build it from
 *    Object.keys() or a Map, whose iteration order is easy to perturb.
 *
 * 2. No `risky` field. The server classifies risk from a fixed list in
 *    lib/risky.ts. Giving the model a field for it would hand a prompt
 *    injection the steering wheel.
 *
 * 3. Every schema is closed: `additionalProperties: false` plus explicit
 *    `required`. The phone feeds these values straight into Android intents,
 *    so an unexpected key is a bug, not a convenience.
 *
 * Descriptions are written for a Hinglish-speaking user and carry the Indian
 * defaults (24-hour conversion, +91 numbers, UPI) the model needs.
 */

/**
 * The canonical tool names. Single source of truth for ToolName, which keys the
 * Zod validators in schemas/toolInputs.ts and the risk list in lib/risky.ts -
 * so adding a tool here makes TypeScript demand a validator for it.
 */
export const TOOL_NAMES = [
  'open_app',
  'make_call',
  'send_email',
  'send_whatsapp',
  'send_sms',
  'set_alarm',
  'set_timer',
  'set_reminder',
  'add_calendar_event',
  'take_photo',
  'navigate',
  'get_weather',
  'play_media',
  'web_search',
  'upi_pay',
  'save_note',
  'log_expense',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

interface ToolDefinition {
  name: ToolName;
  description: string;
  input_schema: Anthropic.Messages.Tool.InputSchema;
}

const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'open_app',
    description:
      'Open an app on the phone. Use for "WhatsApp kholo", "open Instagram", "camera chalu karo". ' +
      'Pass the common app name in lowercase (whatsapp, instagram, youtube, gmail, settings); ' +
      'the phone maps it to a package name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        app_name: {
          type: 'string',
          description: 'Lowercase common app name, e.g. "whatsapp", "youtube", "paytm".',
        },
      },
      required: ['app_name'],
      additionalProperties: false,
    },
  },
  {
    name: 'make_call',
    description:
      'Place a phone call to a saved contact. Use for "Ram ko call karo", "call mummy". ' +
      'Pass the contact name EXACTLY as the user said it - the phone searches its own ' +
      'contact list, which you cannot see. Never invent or guess a phone number. ' +
      'If the user did not say who to call, do not use this tool; ask who instead.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_name: {
          type: 'string',
          description: 'Contact name as spoken by the user, e.g. "Ram", "mummy", "Disha HR".',
        },
      },
      required: ['contact_name'],
      additionalProperties: false,
    },
  },
  {
    name: 'send_email',
    description:
      'Write and send an email from the user\'s own Gmail. Use for "mail HR for leave", ' +
      '"boss ko mail karo". YOU write the subject and body - that is the main value here. ' +
      'Write correct, polite, professional English even when the command is in Hinglish. ' +
      'Sign off with the user\'s name from the context. Pass the recipient as the short name ' +
      'the user said ("disha hr", "manager"); the phone resolves it to a real address.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to_name: {
          type: 'string',
          description:
            'Saved short name of the recipient, lowercase, e.g. "disha hr". Prefer an exact ' +
            'match from the saved email names in the context.',
        },
        subject: {
          type: 'string',
          description: 'Short, specific subject line in English, e.g. "Leave request for today".',
        },
        body: {
          type: 'string',
          description:
            'Full email body in polite professional English. Greeting, reason, and a sign-off ' +
            "with the user's name. No placeholders like [Name] - use the real name or omit it.",
        },
      },
      required: ['to_name', 'subject', 'body'],
      additionalProperties: false,
    },
  },
  {
    name: 'send_whatsapp',
    description:
      'Open a WhatsApp chat with a message ready to send. Use for "mummy ko bolo main 8 baje ' +
      'aaunga". YOU write the message in the language the user would naturally use with that ' +
      'person - Hinglish or Hindi for family and friends, English for work contacts. ' +
      'Keep it short and natural, like a real text message.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_name: {
          type: 'string',
          description: 'Contact name as spoken by the user, e.g. "mummy", "Ram".',
        },
        message: {
          type: 'string',
          description: 'The message text, written naturally for this recipient.',
        },
      },
      required: ['contact_name', 'message'],
      additionalProperties: false,
    },
  },
  {
    name: 'send_sms',
    description:
      'Open the SMS app with a message ready to send. Only use when the user explicitly says ' +
      'SMS or text message - prefer send_whatsapp otherwise, since almost everyone in India ' +
      'uses WhatsApp.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_name: {
          type: 'string',
          description: 'Contact name as spoken by the user.',
        },
        message: { type: 'string', description: 'The SMS text. Keep it short.' },
      },
      required: ['contact_name', 'message'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_alarm',
    description:
      'Set a clock alarm for a time of day. Use for "5 baje ka alarm lagao". ' +
      'ALWAYS convert to 24-hour time. Indian time words: "subah"/"morning" = AM, ' +
      '"shaam"/"evening" = PM, "raat"/"night" = PM, "dopahar"/"afternoon" = PM. ' +
      'So "shaam 5 baje" is hour 17, not 5. A bare "5 baje" with no time word means the ' +
      'next 5 o\'clock that makes sense for an alarm - usually 5 AM. ' +
      'For a countdown like "10 minute baad" use set_timer instead.',
    input_schema: {
      type: 'object' as const,
      properties: {
        hour: { type: 'integer', description: 'Hour in 24-hour format, 0 to 23.' },
        minute: { type: 'integer', description: 'Minute, 0 to 59. Use 0 if not specified.' },
        label: {
          type: 'string',
          description: 'Optional short label, e.g. "Wake up", "Medicine".',
        },
      },
      required: ['hour', 'minute'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_timer',
    description:
      'Start a countdown timer. Use for "10 minute ka timer lagao", "2 ghante ka timer". ' +
      'Convert everything to seconds: 1 minute = 60, 1 ghanta/hour = 3600. ' +
      'For a specific clock time use set_alarm instead.',
    input_schema: {
      type: 'object' as const,
      properties: {
        seconds: { type: 'integer', description: 'Countdown length in seconds.' },
        label: { type: 'string', description: 'Optional short label, e.g. "Chai".' },
      },
      required: ['seconds'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_reminder',
    description:
      'Create a reminder notification at a specific date and time. Use for "shaam 6 baje ' +
      'doodh lene ki yaad dilana". Resolve the datetime against the current time in the ' +
      'context and return a full ISO 8601 string with the timezone offset. ' +
      'The time must be in the future.',
    input_schema: {
      type: 'object' as const,
      properties: {
        datetime: {
          type: 'string',
          description: 'ISO 8601 datetime with offset, e.g. "2026-10-14T18:00:00+05:30".',
        },
        text: {
          type: 'string',
          description: 'What to remind the user about, in their own words.',
        },
      },
      required: ['datetime', 'text'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_calendar_event',
    description:
      'Add an event to the calendar. Use for "kal 11 baje interview add karo". ' +
      'Resolve relative dates ("kal" = tomorrow, "parso" = day after) against the current ' +
      'time in the context. If no end time is given, leave `end` out and the phone assumes ' +
      'one hour.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Event title, e.g. "Interview".' },
        start: {
          type: 'string',
          description: 'ISO 8601 start datetime with offset.',
        },
        end: {
          type: 'string',
          description: 'Optional ISO 8601 end datetime with offset.',
        },
      },
      required: ['title', 'start'],
      additionalProperties: false,
    },
  },
  {
    name: 'take_photo',
    description: 'Open the camera and take a photo. Use for "photo lo", "selfie lo".',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'navigate',
    description:
      'Start turn-by-turn navigation to a place. Use for "railway station ka rasta dikhao". ' +
      'Pass the destination as the user said it; the maps app handles the search.',
    input_schema: {
      type: 'object' as const,
      properties: {
        destination: {
          type: 'string',
          description: 'Place name or address, e.g. "Jodhpur railway station".',
        },
      },
      required: ['destination'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_weather',
    description:
      'Get the weather forecast. Use for "kal barish hogi?", "aaj ka mausam". ' +
      'Leave `city` out to use the phone\'s current location.',
    input_schema: {
      type: 'object' as const,
      properties: {
        city: { type: 'string', description: 'Optional city name. Omit for current location.' },
        day: {
          type: 'string',
          enum: ['today', 'tomorrow', 'week'],
          description: 'Which forecast to fetch. Defaults to today.',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'play_media',
    description:
      'Play music or video in an app. Use for "YouTube pe Arijit ke gaane chalao", ' +
      '"Spotify pe lofi chalao". Pick the app the user named; default to youtube.',
    input_schema: {
      type: 'object' as const,
      properties: {
        app: {
          type: 'string',
          enum: ['youtube', 'spotify'],
          description: 'Which app to play in.',
        },
        query: { type: 'string', description: 'What to search for and play.' },
      },
      required: ['app', 'query'],
      additionalProperties: false,
    },
  },
  {
    name: 'web_search',
    description:
      'Open a web search in the browser. Use ONLY when the user explicitly asks to search ' +
      'or wants live information you cannot know, like today\'s score or news. ' +
      'For general knowledge, translation or maths, answer directly in your reply instead - ' +
      'do not use a tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'The search query.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'upi_pay',
    description:
      'Open the UPI app with a payment ready. Use for "Ram ko 500 rupaye bhejo". ' +
      'The user always enters their own PIN in the UPI app - you never handle credentials. ' +
      'Amount is in rupees. Only ever one payment per command.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_name: { type: 'string', description: 'Who to pay, as the user said it.' },
        amount: { type: 'number', description: 'Amount in rupees.' },
        note: { type: 'string', description: 'Optional payment note.' },
      },
      required: ['contact_name', 'amount'],
      additionalProperties: false,
    },
  },
  {
    name: 'save_note',
    description:
      'Save a short note or to-do. Use for "note karo: Monday ko rent dena hai". ' +
      'Keep the user\'s own words.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The note text.' },
      },
      required: ['text'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_expense',
    description:
      'Record a spend for expense tracking. Use for "aaj 200 chai pe kharch hue". ' +
      'Amount is in rupees. Pick a simple lowercase category: food, travel, bills, ' +
      'shopping, health, other.',
    input_schema: {
      type: 'object' as const,
      properties: {
        amount: { type: 'number', description: 'Amount spent in rupees.' },
        category: {
          type: 'string',
          enum: ['food', 'travel', 'bills', 'shopping', 'health', 'other'],
          description: 'Expense category.',
        },
        note: { type: 'string', description: 'Optional detail, e.g. "chai".' },
      },
      required: ['amount', 'category'],
      additionalProperties: false,
    },
  },
];

// Catches the easy mistake: adding a name to TOOL_NAMES (which TypeScript then
// demands a Zod validator for) but forgetting the definition the AI actually
// sees, or vice versa. Fails at import, so a test run surfaces it immediately.
{
  const defined = TOOL_DEFINITIONS.map((t) => t.name);
  const missing = TOOL_NAMES.filter((name) => !defined.includes(name));
  const extra = defined.filter((name) => !(TOOL_NAMES as readonly string[]).includes(name));
  if (missing.length > 0 || extra.length > 0 || defined.length !== TOOL_NAMES.length) {
    throw new Error(
      `tools.ts is inconsistent. Missing definitions: [${missing.join(', ')}]. ` +
        `Unexpected or duplicate definitions: [${extra.join(', ')}].`
    );
  }
}

export function isKnownTool(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}

/**
 * Build the `tools` array for the API.
 *
 * `strict: true` makes the API guarantee `tool_use.input` matches the schema,
 * which matters because these values go straight into Android intents. It is
 * unverified on Haiku 4.5 though, so AI_STRICT_TOOLS can switch it off without
 * a code change - schemas/toolInputs.ts validates either way.
 *
 * Memoized, for two reasons: it runs on every request, and one shared array
 * serializes to identical bytes every time. Tool definitions open the cached
 * prefix, so byte stability here is what keeps cache hits alive.
 */
let memoizedTools: Anthropic.Messages.ToolUnion[] | undefined;

export function buildTools(): Anthropic.Messages.ToolUnion[] {
  if (memoizedTools) return memoizedTools;

  const strict = getConfig().AI_STRICT_TOOLS;

  memoizedTools = TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
    ...(strict ? { strict: true } : {}),
  }));

  return memoizedTools;
}

/** Test-only: drop the memoized array so a new AI_STRICT_TOOLS value applies. */
export function resetToolsForTests(): void {
  memoizedTools = undefined;
}

# Asomi – backend

Node + Express + TypeScript server for the Asomi voice assistant. One endpoint
matters: `POST /v1/command` takes a transcribed Hindi/English/Hinglish command
and returns the phone actions it maps to, plus a short spoken reply.

The server **runs nothing itself**. Calls, alarms, Gmail, WhatsApp and UPI all
happen on the phone, which is what keeps contacts, phone numbers and the user's
Google token off this machine entirely.

Specs: `../project_planning/docs/` — `07-api.md` for the contract,
`05-architecture-and-tech-stack.md` for the request flow,
`09-security-and-privacy.md` for the rules this code enforces.

## Run it

```bash
npm install
cp .env.example .env     # then fill in ANTHROPIC_API_KEY
npm run dev              # http://localhost:3000
```

No API key? Set `AI_PROVIDER=mock` in `.env`. You get a keyword matcher that
handles alarms, timers, calls, open-app and photos — enough to build the mobile
app against a live endpoint for free. `npm test` needs no key either.

```bash
npm test              # 49 tests, no network, no key
npm run typecheck
npm run lint
npm run build         # -> dist/index.js (what Render runs)
npm run count-prefix  # needs a key; see "Cost" below
```

## The request

```bash
curl -X POST http://localhost:3000/v1/command \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "i am feeling sick, send leave mail to disha hr and set alarm at 5am",
    "now": "2026-10-14T11:45:00+05:30",
    "timezone": "Asia/Kolkata",
    "language": "hinglish",
    "userName": "Praveen",
    "savedEmailNames": ["disha hr", "manager"]
  }'
```

```json
{
  "requestId": "cmd_8f2a91b3c4d5",
  "reply": "Alarm laga diya. Leave mail ready hai, confirm karo.",
  "actions": [
    { "name": "set_alarm", "input": { "hour": 5, "minute": 0 }, "risky": false },
    { "name": "send_email", "input": { "to_name": "disha hr", "subject": "...", "body": "..." }, "risky": true }
  ]
}
```

`risky: true` means the app **must** show a confirmation card before running
the action. Safe actions run immediately.

## How a command flows

```
POST /v1/command
  → Zod validates the request                     schemas/command.ts
  → provider picks tools                          ai/router.ts → ai/claude.ts
  → Zod validates every tool input                schemas/toolInputs.ts
  → server stamps `risky` from its own list       lib/risky.ts
  → { requestId, reply, actions }
```

## Three things that are load-bearing

**The AI never decides what is risky.** `lib/risky.ts` holds a fixed list, the
tool schemas have no `risky` field, and every action object is rebuilt from
validated data. There is nothing for a prompt injection to flip. Caps go with
it: five actions per command, and at most one call, email, message or payment —
so "call 100 people" is structurally impossible, not just discouraged.

**Bad AI output fails the command instead of being dropped.** A malformed action
returns `502 AI_ERROR`. Dropping it quietly would leave the reply claiming
"alarm laga diya" with no alarm set — a silent failure in an app people are
meant to trust with leave mails and payments.

**Every AI call goes through `ai/router.ts`.** Swapping provider is an
`AI_PROVIDER` change, not a refactor.

## Cost

`AI_MODEL=claude-haiku-4-5`, `AI_FALLBACK_MODEL=claude-sonnet-5`. The product
budget is under ₹0.50 per command and under 4 seconds end to end
(`docs/02-product-requirements.md`), so there's no extended thinking and no
`effort` parameter — picking tools is fast classification, not reasoning.

> The docs list `claude-haiku-5-5` and `claude-sonnet-5-5`. Those model IDs do
> not exist; the two above are the real ones.

**Haiku 4.5 will not cache a prefix under 4096 tokens, and it fails silently** —
no error, just `cache_creation_input_tokens: 0` and full price forever. The
system prompt is deliberately long to clear that floor, which makes it both
cheaper (~₹0.15/command cached vs ~₹0.33 uncached) and more accurate, since the
extra tokens are few-shot Hinglish examples. `npm run count-prefix` checks the
number and prints the cost either way.

To confirm caching is actually live, send two commands within five minutes and
look for a non-zero `cacheReadTokens` in the second `command.handled` log line.
Zero means a silent invalidator crept into the cached prefix — most likely
something volatile moved ahead of the `cache_control` breakpoint in
`ai/prompt.ts`.

## Not built yet

Supabase, login, history sync, daily usage limits and billing are v2
(`docs/07-api.md` Phase 9–10). `FREE_DAILY_LIMIT` is in `.env.example` and
`LIMIT_REACHED` is in the error enum, but nothing enforces a limit today.

## Deploy

Render web service, root `backend/`, build `npm ci && npm run build`, start
`node dist/index.js`, health check `/health`. Set `MVP_API_KEY` — the server
refuses to boot in production without it.

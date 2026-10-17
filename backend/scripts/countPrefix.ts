import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../src/config';
import { buildSystemPrompt, getStableSystemPrompt } from '../src/ai/prompt';
import { buildTools, TOOL_NAMES } from '../src/ai/tools';

/**
 * Measure the cacheable prefix against the model's minimum.
 *
 * WHY THIS SCRIPT EXISTS
 * Prompt caching fails SILENTLY below the per-model minimum: no error, just
 * cache_creation_input_tokens: 0 and a full-price bill on every request.
 * Haiku 4.5's floor is 4096 tokens, which is unusually high - Opus 5 is 512 -
 * and a lean prompt with 17 tool schemas lands just under it. That is the worst
 * place to be, so this number gets checked rather than assumed.
 *
 * Run: npm run count-prefix   (needs ANTHROPIC_API_KEY)
 */

/** Per-model minimum cacheable prefix, in tokens. */
const CACHE_MINIMUMS: Record<string, number> = {
  'claude-haiku-4-5': 4096,
  'claude-opus-4-6': 4096,
  'claude-opus-4-5': 4096,
  'claude-opus-4-7': 2048,
  'claude-haiku-3-5': 2048,
  'claude-sonnet-5': 1024,
  'claude-sonnet-4-6': 1024,
  'claude-opus-4-8': 1024,
  'claude-opus-5': 512,
  'claude-fable-5': 512,
};

const USD_PER_INR = 1 / 88;

/** Input/output price per million tokens. */
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-opus-5': { input: 5, output: 25 },
};

const TYPICAL_OUTPUT_TOKENS = 250;

function inr(usd: number): string {
  return `Rs ${(usd / USD_PER_INR).toFixed(2)}`;
}

async function main(): Promise<void> {
  const config = getConfig();

  if (!config.ANTHROPIC_API_KEY) {
    console.error(
      'ANTHROPIC_API_KEY is not set.\n' +
        'Add it to backend/.env (AI_PROVIDER can stay as mock - this script only counts tokens).'
    );
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  const model = config.AI_MODEL;
  const minimum = CACHE_MINIMUMS[model];

  const volatileContext = {
    now: '2026-10-14T11:45:00+05:30',
    timezone: 'Asia/Kolkata',
    language: 'hinglish' as const,
    userName: 'Praveen',
    savedEmailNames: ['disha hr', 'manager'],
  };

  const tools = buildTools();
  const system = buildSystemPrompt(volatileContext);
  const stableBlock = system[0];
  const volatileBlock = system[1];

  if (!stableBlock || !volatileBlock) {
    throw new Error('buildSystemPrompt must return a stable block and a volatile block.');
  }

  // Three counts isolate each part of the prefix. count_tokens does not bill
  // for inference, so this is cheap to run as often as you like.
  const [toolsOnly, toolsPlusStable, everything] = await Promise.all([
    client.messages.countTokens({
      model,
      tools,
      messages: [{ role: 'user', content: 'x' }],
    }),
    client.messages.countTokens({
      model,
      tools,
      system: [stableBlock],
      messages: [{ role: 'user', content: 'x' }],
    }),
    client.messages.countTokens({
      model,
      tools,
      system,
      messages: [
        {
          role: 'user',
          content: 'i am feeling sick, send leave mail to disha hr and set alarm at 5am',
        },
      ],
    }),
  ]);

  // Both counts include the same 1-token user message, so the difference is
  // the stable system block alone.
  const stableSystemTokens = toolsPlusStable.input_tokens - toolsOnly.input_tokens;
  const cachedPrefix = toolsPlusStable.input_tokens;
  const uncachedPerRequest = everything.input_tokens - cachedPrefix;

  console.log('');
  console.log(`Model: ${model}`);
  console.log(`Tools: ${TOOL_NAMES.length}`);
  console.log('');
  console.log('Prefix breakdown');
  console.log(`  tool definitions      ${String(toolsOnly.input_tokens).padStart(6)} tokens`);
  console.log(`  stable system prompt  ${String(stableSystemTokens).padStart(6)} tokens`);
  console.log(`  ------------------------------------`);
  console.log(`  CACHED PREFIX         ${String(cachedPrefix).padStart(6)} tokens`);
  console.log('');
  console.log(`  uncached per request  ${String(uncachedPerRequest).padStart(6)} tokens`);
  console.log(`    (volatile context + the command itself)`);
  console.log('');
  console.log(`Stable prompt characters: ${getStableSystemPrompt().length}`);
  console.log('');

  if (minimum === undefined) {
    console.log(`No recorded cache minimum for ${model}. Check the current docs.`);
  } else if (cachedPrefix >= minimum) {
    const headroom = cachedPrefix - minimum;
    console.log(`PASS - ${cachedPrefix} >= ${minimum} token minimum (headroom: ${headroom}).`);
    console.log('Caching will engage. Verify with a real call: the second request in a');
    console.log('5-minute window must report a non-zero cache_read_input_tokens.');
  } else {
    const shortfall = minimum - cachedPrefix;
    console.log(`FAIL - ${cachedPrefix} < ${minimum} token minimum for ${model}.`);
    console.log(`Short by ${shortfall} tokens, and it fails SILENTLY - no error, just`);
    console.log('cache_creation_input_tokens: 0 and full price on every request.');
    console.log('');
    console.log('Fixes, best first:');
    console.log('  1. Add more few-shot examples to STABLE_SYSTEM_PROMPT in src/ai/prompt.ts.');
    console.log('     Cheaper AND more accurate - see the comment at the top of that file.');
    console.log('  2. Accept the uncached cost below (still inside the Rs 0.50 cap).');
    console.log('  3. Switch AI_MODEL to claude-sonnet-5, whose minimum is 1024.');
  }

  const price = PRICING[model];
  if (price) {
    const outputCost = (TYPICAL_OUTPUT_TOKENS * price.output) / 1_000_000;
    const caches = minimum !== undefined && cachedPrefix >= minimum;

    const uncachedInput = (everything.input_tokens * price.input) / 1_000_000;
    // Cache reads cost ~0.1x base input price.
    const cachedInput =
      (cachedPrefix * price.input * 0.1) / 1_000_000 +
      (uncachedPerRequest * price.input) / 1_000_000;

    console.log('');
    console.log(`Per-command cost (assuming ~${TYPICAL_OUTPUT_TOKENS} output tokens)`);
    console.log(`  without caching  ${inr(uncachedInput + outputCost)}`);
    console.log(`  with caching     ${inr(cachedInput + outputCost)}`);
    console.log(`  budget           Rs 0.50 (docs/02-product-requirements.md)`);
    console.log(`  actual today     ${inr((caches ? cachedInput : uncachedInput) + outputCost)}`);
    console.log('');
    console.log('Cache writes cost 1.25x, so the first request of each 5-minute window');
    console.log('is slightly more than "without caching" above. Break-even is 2 requests.');
  }

  console.log('');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

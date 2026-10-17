import { getConfig } from '../config';
import { claudeProvider } from './claude';
import { mockProvider } from './mock';
import type { AiProvider } from './types';

/**
 * The one place a concrete AI provider is chosen.
 *
 * CLAUDE.md requires every AI call to pass through here so the provider can be
 * switched with AI_PROVIDER alone. Adding Gemini or an on-device model later
 * means writing one file that satisfies AiProvider and adding a case below -
 * no route or test changes.
 */

const PROVIDERS: Record<string, AiProvider> = {
  claude: claudeProvider,
  mock: mockProvider,
};

export function getAiProvider(): AiProvider {
  const name = getConfig().AI_PROVIDER;
  const provider = PROVIDERS[name];

  if (!provider) {
    // Unreachable while config.ts validates the enum, but an unguarded
    // undefined here would surface as a confusing TypeError at request time.
    throw new Error(`Unknown AI_PROVIDER: ${name}`);
  }

  return provider;
}

export type { AiProvider } from './types';

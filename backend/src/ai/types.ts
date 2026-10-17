import type { PromptContext } from './prompt';

/**
 * The provider seam.
 *
 * CLAUDE.md: "Put every AI call behind ai/router.ts so the provider (Claude,
 * Gemini, local model) can be switched with AI_PROVIDER."
 *
 * Only ai/router.ts imports a concrete provider. Routes depend on this
 * interface, which is also what makes the endpoint testable with a stub instead
 * of a mocked SDK module.
 */

export interface InterpretInput extends PromptContext {
  /** The user's spoken command, already transcribed on the phone. */
  text: string;
}

/** One tool the model chose. `input` is unvalidated - schemas/toolInputs.ts checks it. */
export interface RawToolCall {
  name: string;
  input: unknown;
}

export interface InterpretUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  /** True when the primary model failed and the fallback answered. */
  usedFallback: boolean;
}

export interface InterpretResult {
  /** Short spoken reply. May be empty if the model only called tools. */
  reply: string;
  toolCalls: RawToolCall[];
  usage: InterpretUsage;
}

export interface AiProvider {
  readonly name: string;
  interpret(input: InterpretInput): Promise<InterpretResult>;
}

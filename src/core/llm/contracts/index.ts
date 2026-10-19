/**
 * LLM port.
 *
 * Declared here because the domain is what needs text generation; the SDK that
 * provides it is an implementation detail. `infrastructure/llm/` implements
 * this, and `core/` never imports the vendor SDK.
 *
 * Model output is untrusted input. A service that calls `complete` with an
 * `outputSchema` still parses and validates the result into domain types before
 * any other layer sees it.
 */

/**
 * How much the model may reason before answering. Current models always think;
 * effort is the only control over how deeply, and it is the first lever to pull
 * when a route costs too much. `low` for short or high-volume calls, `high` for
 * work where a wrong answer is expensive, `max` only when measurement shows the
 * level below is not enough.
 */
export type LLMEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface LLMOptions {
  systemPrompt?: string;
  /**
   * Budget for the ANSWER, not for the whole response. Reasoning draws on the
   * same ceiling the API enforces, so the adapter adds its own headroom on top
   * of this number. Sizing this as if it were the API's `max_tokens` is how a
   * caller written for a pre-thinking model gets answers truncated mid-sentence.
   */
  maxTokens: number;
  /** Defaults to the adapter's own default model, never to the caller's guess. */
  model?: string;
  effort?: LLMEffort;
  outputSchema?: Record<string, unknown>;
  signal?: AbortSignal;
}

export type LLMMessage = { role: 'user' | 'assistant'; content: string };

export interface ILLMProvider {
  complete(messages: LLMMessage[], options: LLMOptions): Promise<string>;

  stream(
    messages: LLMMessage[],
    options: LLMOptions,
    onChunk: (chunk: string) => void
  ): Promise<string>;
}

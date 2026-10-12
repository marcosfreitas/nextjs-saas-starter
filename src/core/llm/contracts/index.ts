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

export interface LLMOptions {
  systemPrompt?: string;
  maxTokens: number;
  model?: string;
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

import Anthropic from '@anthropic-ai/sdk';
import type { ILLMProvider, LLMMessage, LLMOptions } from '@/core/llm/contracts';
import { ConfigurationError, ExternalApiError } from '@/shared/errors';

export class AnthropicProvider implements ILLMProvider {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new ConfigurationError('ANTHROPIC_API_KEY');
    this.client = new Anthropic({ apiKey });
  }

  async complete(
    messages: LLMMessage[],
    { systemPrompt, maxTokens, model: modelOverride, outputSchema, signal }: LLMOptions
  ): Promise<string> {
    const model = modelOverride ?? (maxTokens <= 5000 ? 'claude-sonnet-4-6' : 'claude-opus-4-8');

    const attempt = async (): Promise<string> => {
      const response = await this.client.messages.create(
        {
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: messages as Anthropic.MessageParam[],
          ...(outputSchema
            ? { output_config: { format: { type: 'json_schema' as const, schema: outputSchema } } }
            : {}),
        },
        signal ? { signal } : undefined
      );

      const block = response.content[0];
      if (!block || block.type !== 'text') {
        throw new ExternalApiError('Anthropic', 'No text content in response.');
      }
      return block.text;
    };

    let retries = 0;
    const MAX_RETRIES = 5;

    const runAttempt = async (): Promise<string> => {
      try {
        return await attempt();
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError) {
          if (retries >= MAX_RETRIES) throw err;
          retries++;
          const backoff = Math.pow(2, retries) * 2000;
          console.warn(`[Anthropic] Rate limited. Retry ${retries}/${MAX_RETRIES} in ${backoff}ms`);
          await new Promise((r) => setTimeout(r, backoff));
          return runAttempt();
        }
        throw err;
      }
    };

    return runAttempt();
  }

  async stream(
    messages: LLMMessage[],
    { systemPrompt, maxTokens, model: modelOverride, signal }: LLMOptions,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const model = modelOverride ?? 'claude-sonnet-4-6';
    let fullText = '';

    const stream = this.client.messages.stream({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages as Anthropic.MessageParam[],
    });

    if (signal) {
      signal.addEventListener('abort', () => stream.abort());
    }

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        onChunk(event.delta.text);
        fullText += event.delta.text;
      }
    }

    return fullText;
  }
}

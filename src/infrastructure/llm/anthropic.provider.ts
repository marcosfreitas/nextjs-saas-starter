import Anthropic from '@anthropic-ai/sdk';
import type { ILLMProvider, LLMEffort, LLMMessage, LLMOptions } from '@/core/llm/contracts';
import { ConfigurationError, ExternalApiError, LLMRefusalError } from '@/shared/errors';

/**
 * One default model, not a cost heuristic. The previous version picked Sonnet
 * under 5000 tokens and Opus above, which decided spend inside the adapter
 * where no caller could see it; token count is a poor proxy for how hard a task
 * is. A route that wants a cheaper model asks for it through `model`, and a
 * route that wants less spend on the same model lowers `effort` first.
 */
const DEFAULT_MODEL = 'claude-opus-5-5';

/**
 * Set explicitly because the per-model default moved: Opus 5.5 defaults to
 * `medium` where Opus 5 defaulted to `high`. Inheriting it means changing the
 * model string silently changes how deeply every call reasons.
 */
const DEFAULT_EFFORT: LLMEffort = 'high';

/**
 * Reasoning spends the same ceiling as the answer, so the caller's answer
 * budget alone would leave nothing for it and the reply would stop mid-sentence
 * with `stop_reason: "max_tokens"`.
 */
const THINKING_HEADROOM_TOKENS = 8_192;

/** Current models cap output here; asking for more is rejected. */
const MAX_OUTPUT_TOKENS = 128_000;

function budget(maxTokens: number): number {
  return Math.min(maxTokens + THINKING_HEADROOM_TOKENS, MAX_OUTPUT_TOKENS);
}

/**
 * Reads the answer out of a response.
 *
 * Scans for the text block instead of taking `content[0]`, because thinking
 * blocks come first when the model reasons. Indexing position 0 reports
 * "no text content" for a response that answered perfectly well.
 */
function extractText(blocks: Anthropic.ContentBlock[]): string {
  const text = blocks
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  if (!text) throw new ExternalApiError('Anthropic', 'No text content in response.');
  return text;
}

/**
 * A policy decline arrives as HTTP 200, so nothing throws on its own. Checked
 * before reading content: a refused response carries no answer to read.
 */
function assertNotRefused(message: {
  stop_reason: string | null;
  stop_details?: Anthropic.RefusalStopDetails | null;
}): void {
  if (message.stop_reason !== 'refusal') return;
  throw new LLMRefusalError(
    message.stop_details?.category ?? null,
    message.stop_details?.explanation ?? null
  );
}

export class AnthropicProvider implements ILLMProvider {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new ConfigurationError('ANTHROPIC_API_KEY');
    this.client = new Anthropic({ apiKey });
  }

  async complete(
    messages: LLMMessage[],
    { systemPrompt, maxTokens, model, effort, outputSchema, signal }: LLMOptions
  ): Promise<string> {
    const attempt = async (): Promise<string> => {
      const response = await this.client.messages.create(
        {
          model: model ?? DEFAULT_MODEL,
          max_tokens: budget(maxTokens),
          system: systemPrompt,
          messages: messages as Anthropic.MessageParam[],
          thinking: { type: 'adaptive' },
          output_config: {
            effort: effort ?? DEFAULT_EFFORT,
            ...(outputSchema
              ? { format: { type: 'json_schema' as const, schema: outputSchema } }
              : {}),
          },
        },
        signal ? { signal } : undefined
      );

      assertNotRefused(response);
      return extractText(response.content);
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
    { systemPrompt, maxTokens, model, effort, signal }: LLMOptions,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    let fullText = '';

    const stream = this.client.messages.stream({
      model: model ?? DEFAULT_MODEL,
      max_tokens: budget(maxTokens),
      system: systemPrompt,
      messages: messages as Anthropic.MessageParam[],
      thinking: { type: 'adaptive' },
      output_config: { effort: effort ?? DEFAULT_EFFORT },
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

    // Only the assembled message carries stop_reason. A refusal streams no text
    // deltas at all, so without this check the caller gets an empty string and
    // no reason for it.
    assertNotRefused(await stream.finalMessage());

    return fullText;
  }
}

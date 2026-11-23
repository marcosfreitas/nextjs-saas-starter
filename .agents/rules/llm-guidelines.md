---
paths:
  - "src/infrastructure/llm/**"
  - "src/core/llm/**"
  - "src/config/prompts/**"
---

# LLM Guidelines

Decisions the template has made for model calls. Each one carries the failure it prevents.

## Where the code lives
- The SDK is imported only in `src/infrastructure/llm/`. The port (`ILLMProvider`) lives in `src/core/llm/contracts/`, and everything else depends on the port.
- Model output crosses a translator in `core/<domain>/` that parses and validates it into domain types before any other layer sees it. Raw output is never passed to the UI or stored as a domain entity.

## Reading a response
- **Find the answer by block type, not by position.** Scan the content blocks for `type === 'text'`. Current models reason first, so a thinking block sits at position 0. Reading `content[0]` reports a correct answer as "no text content", which looks like an API failure.
- **Check for a refusal before reading content.** A policy decline arrives as HTTP 200 with `stop_reason: 'refusal'`. Raise `LLMRefusalError` (422), never `ExternalApiError` (502): a 502 says the integration is broken when it is healthy, and a streamed refusal with no check hands the caller an empty string and no reason.

## Sizing a request
- **Never pass the caller's token budget straight to `max_tokens`.** Reasoning draws on the same ceiling as the answer, so the adapter adds its own headroom. A budget sized for a model that did not reason cuts the answer mid-sentence with `stop_reason: 'max_tokens'`.
- **Set `effort` explicitly in the adapter.** Defaults differ per model, so changing only the model ID silently changes reasoning depth and cost.

## Prompt caching
- Stable content first, per-turn content after the last cache breakpoint. Caching is a prefix match: a timestamp, a counter or a "synced N min ago" line early in the prompt repays the whole history on every call.
- Every database read that feeds a prompt carries an `ORDER BY`. Without it an unrelated `UPDATE` can reorder the rows and break the cached prefix, with nothing in the diff to show why.

## Input
- Never pass raw user input as the system prompt. Validate and bound it before it enters a prompt (see `security-analysis.md`).

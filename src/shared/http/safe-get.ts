/**
 * GET for URLs that someone outside the app can influence.
 *
 * Why not `fetch`: the built-in fetch (and undici's fetch) decodes
 * `Content-Encoding: br` whatever you asked for, and it does so before your
 * code sees the response. A server that answers with a Brotli body therefore
 * reaches the Brotli decoder, and CVE-2026-111497 (fixed in Node 22.23.4,
 * 24.22.1 and 26.12.1) is a flaw in that decoder. Removing `br` from
 * `Accept-Encoding` does not stop it: the server answers anyway.
 *
 * Why `node:http`/`node:https`: they never decode. The body arrives as bytes
 * and only what we explicitly decode gets decoded. We check the header before
 * reading a byte and decode only gzip and deflate, with zlib, ourselves.
 *
 * Not for vendor SDKs or fixed vendor hosts over HTTPS: the built-in fetch is
 * fine there, and the cost of switching is one more client to maintain.
 */
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { gunzip, inflate } from 'node:zlib';
import { promisify } from 'node:util';

const gunzipAsync = promisify(gunzip);
const inflateAsync = promisify(inflate);

const DEFAULT_MAX_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;

/** The only codings this helper will decode. Anything else is refused. */
const DECODABLE_CODINGS = new Set(['gzip', 'deflate']);

export class UnsafeResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeResponseError';
  }
}

export interface SafeGetOptions {
  /** Applies to the body as received and to the body after decoding. */
  maxBytes?: number;
  timeoutMs?: number;
}

/**
 * Splits a `Content-Encoding` header into lowercase tokens.
 *
 * Clients disagree on `BR`, ` br `, `gzip, br` and `identity, br`, and a
 * server can send any of them. The header is joined when repeated, split on
 * commas, trimmed and lowercased, so the allow-list compares like with like.
 */
export function parseContentEncoding(
  header: string | string[] | undefined
): string[] {
  if (header === undefined) return [];
  const joined = Array.isArray(header) ? header.join(',') : header;
  return joined
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token !== '');
}

/**
 * Fetches `url` with GET and returns the decoded body.
 *
 * Refuses, before reading the body:
 * - any status outside 2xx. Redirects are not followed, so every hop is a
 *   decision the caller makes, not one this helper makes silently;
 * - any coding other than gzip, deflate or identity, including `br`, and more
 *   than one coding (`gzip, gzip` is not something this helper decodes).
 *
 * Refuses, while reading:
 * - a body over `maxBytes`, and a decoded body over `maxBytes`;
 * - a body still open after `timeoutMs`.
 *
 * Accepts `http:` as well as `https:` because the tests run a local server.
 * Callers that talk to the outside should pass `https:` URLs only.
 */
export async function safeGet(
  url: string,
  options: SafeGetOptions = {}
): Promise<Buffer> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const target = new URL(url);
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    throw new UnsafeResponseError(`protocol ${target.protocol} is not allowed.`);
  }
  const send = target.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise<Buffer>((resolve, reject) => {
    const req = send(
      target,
      {
        method: 'GET',
        headers: { accept: '*/*', 'accept-encoding': 'gzip, deflate' },
        signal: AbortSignal.timeout(timeoutMs),
      },
      (res) => {
        readResponse(res, maxBytes).then(resolve, reject);
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function readResponse(
  res: IncomingMessage,
  maxBytes: number
): Promise<Buffer> {
  const status = res.statusCode ?? 0;
  if (status < 200 || status > 299) {
    discard(res);
    throw new UnsafeResponseError(
      `status ${status} not accepted; redirects are not followed.`
    );
  }

  const codings = parseContentEncoding(res.headers['content-encoding']).filter(
    (coding) => coding !== 'identity'
  );
  const refused = codings.find((coding) => !DECODABLE_CODINGS.has(coding));
  if (refused !== undefined || codings.length > 1) {
    discard(res);
    throw new UnsafeResponseError(
      `content-encoding '${res.headers['content-encoding']}' not accepted.`
    );
  }

  const chunks: Buffer[] = [];
  let received = 0;
  try {
    for await (const chunk of res) {
      received += (chunk as Buffer).length;
      if (received > maxBytes) {
        throw new UnsafeResponseError(`body exceeds ${maxBytes} bytes.`);
      }
      chunks.push(chunk as Buffer);
    }
  } catch (err) {
    discard(res);
    throw err;
  }

  const raw = Buffer.concat(chunks);
  const [coding] = codings;
  if (coding === undefined) return raw;

  try {
    return coding === 'gzip'
      ? await gunzipAsync(raw, { maxOutputLength: maxBytes })
      : await inflateAsync(raw, { maxOutputLength: maxBytes });
  } catch (err) {
    throw new UnsafeResponseError(
      `cannot decode ${coding} body: ${(err as Error).message}`
    );
  }
}

/**
 * Drops the rest of a response we refuse.
 *
 * The error listener goes first: destroying a stream can emit `error` on it,
 * and an `error` with no listener is an uncaught exception that takes the
 * process down. The peers measured this path with a Brotli body and it is
 * the one place where the refusal itself could crash the server.
 */
function discard(res: IncomingMessage): void {
  res.on('error', () => {});
  res.destroy();
}

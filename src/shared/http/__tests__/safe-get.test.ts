/**
 * @jest-environment node
 */
import { createServer, type Server } from 'node:http';
import { deflateSync, gzipSync } from 'node:zlib';
import { AddressInfo } from 'node:net';
import {
  parseContentEncoding,
  safeGet,
  UnsafeResponseError,
} from '@/shared/http/safe-get';

const BODY = 'hello from the server';

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    switch (req.url) {
      case '/identity':
        res.writeHead(200).end(BODY);
        return;
      case '/gzip':
        res.writeHead(200, { 'content-encoding': 'gzip' }).end(gzipSync(BODY));
        return;
      case '/deflate':
        res.writeHead(200, { 'content-encoding': 'deflate' }).end(deflateSync(BODY));
        return;
      case '/br':
        // Not a valid Brotli stream on purpose: a decoder would fail on it,
        // and the helper must refuse before any decoder sees it.
        res.writeHead(200, { 'content-encoding': 'br' }).end(Buffer.from('not brotli'));
        return;
      case '/gzip-and-br':
        res.writeHead(200, { 'content-encoding': 'gzip, br' }).end(gzipSync(BODY));
        return;
      case '/upper-br':
        res.writeHead(200, { 'content-encoding': 'BR' }).end(Buffer.from('not brotli'));
        return;
      case '/redirect':
        res.writeHead(302, { location: '/identity' }).end();
        return;
      case '/big':
        res.writeHead(200).end('x'.repeat(5000));
        return;
      case '/slow':
        res.writeHead(200);
        res.write('start');
        return;
      default:
        res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('parseContentEncoding', () => {
  it('normalises case, spacing and repeated headers', () => {
    expect(parseContentEncoding(' BR ')).toEqual(['br']);
    expect(parseContentEncoding('gzip, br')).toEqual(['gzip', 'br']);
    expect(parseContentEncoding(['identity', ' Gzip '])).toEqual(['identity', 'gzip']);
    expect(parseContentEncoding(undefined)).toEqual([]);
  });
});

describe('safeGet', () => {
  it('returns identity bodies as received', async () => {
    const body = await safeGet(`${base}/identity`);
    expect(body.toString()).toBe(BODY);
  });

  it('decodes gzip and deflate itself', async () => {
    expect((await safeGet(`${base}/gzip`)).toString()).toBe(BODY);
    expect((await safeGet(`${base}/deflate`)).toString()).toBe(BODY);
  });

  it('refuses br before reading the body, and crashes nothing', async () => {
    const uncaught = jest.fn();
    process.on('uncaughtException', uncaught);
    try {
      const failure = await safeGet(`${base}/br`).catch((err: unknown) => err);
      expect(failure).toBeInstanceOf(UnsafeResponseError);
      expect((failure as Error).message).toMatch(/'br' not accepted/);
      // A decoder error would mean the body got past the header check.
      expect((failure as Error).message).not.toMatch(/cannot decode/);
      await new Promise((resolve) => setImmediate(resolve));
      expect(uncaught).not.toHaveBeenCalled();
    } finally {
      process.off('uncaughtException', uncaught);
    }
  });

  it('refuses a list that contains br, even next to a decodable coding', async () => {
    await expect(safeGet(`${base}/gzip-and-br`)).rejects.toThrow(UnsafeResponseError);
  });

  it('refuses an uppercase BR', async () => {
    await expect(safeGet(`${base}/upper-br`)).rejects.toThrow(UnsafeResponseError);
  });

  it('does not follow redirects', async () => {
    await expect(safeGet(`${base}/redirect`)).rejects.toThrow(/redirects are not followed/);
  });

  it('refuses a status outside 2xx', async () => {
    await expect(safeGet(`${base}/missing`)).rejects.toThrow(/status 404/);
  });

  it('caps the body at maxBytes', async () => {
    await expect(safeGet(`${base}/big`, { maxBytes: 100 })).rejects.toThrow(/exceeds 100 bytes/);
  });

  it('gives up on a body that never ends', async () => {
    await expect(safeGet(`${base}/slow`, { timeoutMs: 100 })).rejects.toThrow();
  });

  it('refuses protocols other than http and https', async () => {
    await expect(safeGet('file:///etc/passwd')).rejects.toThrow(/not allowed/);
  });
});

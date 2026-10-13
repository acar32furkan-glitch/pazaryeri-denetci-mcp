import { request as httpRequest } from 'node:http';

import { Client } from '@modelcontextprotocol/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createServerConfig } from '../src/config.ts';
import { createHttpServer, listen } from '../src/http.ts';

import type { RunningHttpServer } from '../src/http.ts';

/**
 * Streamable HTTP taşıması güvenlik ve işlev testleri.
 *
 * Sunucu **aynı süreçte** ama gerçek HTTP üzerinden çalışır; yani 401/403/413/429 davranışı ve
 * araç çağrıları ağdan geçerek doğrulanır.
 */
const TOKEN = 'test-token-123';
const ORIGIN_ALLOWED = 'https://izinli.example';
const PRODUCTS = 40;
const TEST_TIMEOUT = 30_000;

let running: RunningHttpServer;
let client: Client;
let strict: RunningHttpServer;

const authHeaders = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' };

function rpc(method: string): string {
  return JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: {} });
}

/** Host başlığını elle vermek için (fetch `host` başlığını engeller). */
function rawRequest(
  url: string,
  headers: Record<string, string>,
  body?: string,
): Promise<{
  status: number;
  body: string;
  headers: Record<string, string | string[] | undefined>;
}> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port: target.port,
        path: target.pathname,
        method: body === undefined ? 'GET' : 'POST',
        headers,
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          text += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: text, headers: res.headers });
        });
      },
    );
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

describe('MCP sunucusu — Streamable HTTP taşıması', () => {
  beforeAll(async () => {
    running = await listen({
      config: createServerConfig({
        MOCK_CATALOG_PRODUCTS: String(PRODUCTS),
        MOCK_CATALOG_DEFECTS_PER_KIND: '1',
      }),
      token: TOKEN,
      port: 0,
      allowedOrigins: [ORIGIN_ALLOWED],
      log: () => undefined,
    });
    client = new Client({ name: 'http-test-client', version: '0.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(running.url), {
        requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } },
      }),
    );
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await client.close();
    await running.close();
    if (strict !== undefined) await strict.close();
  });

  it(
    'kimlik doğrulaması olmadan HTTP sunucusu başlatılmaz',
    () => {
      // Token yoksa "kimlik doğrulaması kapalı" bir uç nokta oluşmasın diye başlatma reddedilir.
      expect(() =>
        createHttpServer({
          config: createServerConfig({
            MOCK_CATALOG_PRODUCTS: String(PRODUCTS),
            MOCK_CATALOG_DEFECTS_PER_KIND: '1',
          }),
          token: '   ',
          log: () => undefined,
        }),
      ).toThrow(/MCP_HTTP_TOKEN/u);
    },
    TEST_TIMEOUT,
  );

  it(
    'token olmadan istek 401 döner (WWW-Authenticate ile)',
    async () => {
      const response = await fetch(running.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: rpc('tools/list'),
      });
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toContain('Bearer');
      const payload = (await response.json()) as { error: string };
      expect(payload.error).toContain('Bearer token');
    },
    TEST_TIMEOUT,
  );

  it(
    'yanlış token 401 döner',
    async () => {
      const response = await fetch(running.url, {
        method: 'POST',
        headers: { authorization: 'Bearer yanlis-token', 'content-type': 'application/json' },
        body: rpc('tools/list'),
      });
      expect(response.status).toBe(401);
    },
    TEST_TIMEOUT,
  );

  it(
    'sağlık ucu (healthz) kimlik doğrulaması istemez ve canlılık bildirir',
    async () => {
      const response = await fetch(`http://127.0.0.1:${String(running.port)}/healthz`);
      expect(response.status).toBe(200);
      const payload = (await response.json()) as { status: string; service: string };
      expect(payload.status).toBe('ok');
      expect(payload.service).toBe('pazaryeri-denetci-mcp');
    },
    TEST_TIMEOUT,
  );

  it(
    'izin verilmeyen Host başlığı 403 döner (DNS rebinding koruması)',
    async () => {
      const response = await rawRequest(
        running.url,
        {
          ...authHeaders,
          host: 'kotu.example',
        },
        rpc('tools/list'),
      );
      expect(response.status).toBe(403);
      expect(response.body).toContain('Host');
    },
    TEST_TIMEOUT,
  );

  it(
    'izin verilmeyen Origin 403 döner; izinli Origin CORS başlığı alır',
    async () => {
      const denied = await fetch(running.url, {
        method: 'POST',
        headers: { ...authHeaders, origin: 'https://kotu.example' },
        body: rpc('tools/list'),
      });
      expect(denied.status).toBe(403);

      const allowed = await fetch(running.url, {
        method: 'POST',
        headers: { ...authHeaders, origin: ORIGIN_ALLOWED },
        body: rpc('tools/list'),
      });
      expect(allowed.status).not.toBe(403);
      expect(allowed.headers.get('access-control-allow-origin')).toBe(ORIGIN_ALLOWED);
    },
    TEST_TIMEOUT,
  );

  it(
    'OPTIONS ön kontrol isteği 204 ve kısıtlı CORS başlıkları döner',
    async () => {
      const response = await fetch(running.url, {
        method: 'OPTIONS',
        headers: { origin: ORIGIN_ALLOWED, 'access-control-request-method': 'POST' },
      });
      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-methods')).toContain('POST');
      expect(response.headers.get('access-control-allow-headers')).toContain('mcp-session-id');
    },
    TEST_TIMEOUT,
  );

  it(
    'çok büyük gövde 413 ile reddedilir',
    async () => {
      const huge = `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"x","arguments":{"data":"${'a'.repeat(300 * 1024)}"}}}`;
      const response = await fetch(running.url, {
        method: 'POST',
        headers: authHeaders,
        body: huge,
      });
      expect(response.status).toBe(413);
    },
    TEST_TIMEOUT,
  );

  it(
    'hız sınırı aşıldığında 429 döner',
    async () => {
      strict = await listen({
        config: createServerConfig({
          MOCK_CATALOG_PRODUCTS: '30',
          MOCK_CATALOG_DEFECTS_PER_KIND: '1',
        }),
        token: TOKEN,
        port: 0,
        log: () => undefined,
        rateLimit: { windowMs: 60_000, maxRequests: 3 },
      });
      const url = strict.url;
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await fetch(url, {
          method: 'POST',
          headers: authHeaders,
          body: rpc('tools/list'),
        });
        statuses.push(response.status);
      }
      expect(statuses.slice(0, 3).every((status) => status !== 429)).toBe(true);
      expect(statuses[3]).toBe(429);
      expect(statuses[4]).toBe(429);
    },
    TEST_TIMEOUT,
  );

  it(
    'geçerli token ile araçlar HTTP üzerinden çağrılır (gerçek bulgular)',
    async () => {
      const { tools } = await client.listTools();
      expect(tools.length).toBe(6);

      const result = (await client.callTool({
        name: 'audit_catalog',
        arguments: { topN: 2 },
      })) as unknown as { content?: { type: string; text?: string }[]; isError?: boolean };
      expect(result.isError).not.toBe(true);
      const text = result.content?.find((block) => block.type === 'text')?.text ?? '{}';
      const payload = JSON.parse(text) as {
        summary: { productCount: number; findingCount: number };
        findings: unknown[];
      };
      expect(payload.summary.productCount).toBe(PRODUCTS);
      expect(payload.summary.findingCount).toBeGreaterThan(0);
      expect(payload.findings.length).toBe(2);
    },
    TEST_TIMEOUT,
  );
});

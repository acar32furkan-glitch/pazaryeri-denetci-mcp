/**
 * Streamable HTTP taşıması — canlı (uzak) kullanım için MCP uç noktası.
 *
 * Güvenlik katmanları (hepsi burada, sunucu tarafında):
 * 1. **Bearer token zorunlu** (`MCP_HTTP_TOKEN`). Token yoksa sunucu **başlamaz**: "kimlik
 *    doğrulaması kapalı" bir yapılandırma sessizce açık uç nokta bırakırdı.
 * 2. **Host doğrulama** (`ALLOWED_HOSTS`) — DNS rebinding saldırılarına karşı.
 * 3. **Origin doğrulama** (`ALLOWED_ORIGINS`) — tarayıcıdan gelen istekler yalnızca listedeki
 *    kaynaklardan; tarayıcı olmayan istemciler (Origin başlığı yok) kabul edilir.
 * 4. **Gövde boyutu sınırı** (`MCP_MAX_BODY_BYTES`) — bellek tüketimini sınırlar.
 * 5. **Basit hız sınırı** (istemci başına pencere) — tek istemcinin sunucuyu doldurmasını engeller.
 * 6. Token karşılaştırması `timingSafeEqual` ile yapılır (zamanlama sızıntısına karşı).
 */
import { createServer as createNodeServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';

import { createServer } from './server.ts';

import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { NodeIncomingMessageLike, NodeServerResponseLike } from '@modelcontextprotocol/node';
import type { ServerConfig } from './config.ts';

export interface RateLimitOptions {
  readonly windowMs: number;
  readonly maxRequests: number;
}

export interface HttpServerOptions {
  readonly config: ServerConfig;
  /** Zorunlu; boş/undefined verilirse `createHttpServer` hata atar. */
  readonly token: string | undefined;
  readonly allowedHosts?: readonly string[];
  readonly allowedOrigins?: readonly string[];
  readonly maxBodyBytes?: number;
  readonly rateLimit?: RateLimitOptions;
  readonly path?: string;
  readonly log?: (line: string) => void;
}

export interface RunningHttpServer {
  readonly server: Server;
  readonly port: number;
  readonly url: string;
  close(): Promise<void>;
}

const DEFAULT_PATH = '/mcp';
const DEFAULT_MAX_BODY_BYTES = 256 * 1024;
const DEFAULT_RATE_LIMIT: RateLimitOptions = { windowMs: 60_000, maxRequests: 120 };
const HEALTH_PATH = '/healthz';

interface RateBucket {
  count: number;
  resetAt: number;
}

function constantTimeEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sendJson(response: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}): void {
  const body = `${JSON.stringify(payload)}\n`;
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    ...headers,
  });
  response.end(body);
}

function hostnameOf(hostHeader: string | undefined): string | null {
  if (hostHeader === undefined || hostHeader === '') return null;
  // IPv6 literal: [::1]:8787 → ::1
  if (hostHeader.startsWith('[')) {
    const end = hostHeader.indexOf(']');
    return end === -1 ? hostHeader : hostHeader.slice(1, end);
  }
  const separator = hostHeader.lastIndexOf(':');
  return separator === -1 ? hostHeader : hostHeader.slice(0, separator);
}

function clientKey(request: IncomingMessage): string {
  return request.socket.remoteAddress ?? 'bilinmeyen';
}

export function createHttpServer(options: HttpServerOptions): RunningHttpServer {
  const token = options.token?.trim();
  if (token === undefined || token === '') {
    throw new Error(
      'MCP_HTTP_TOKEN tanımlı değil: HTTP taşıması kimlik doğrulaması olmadan başlatılmaz.',
    );
  }

  const path = options.path ?? DEFAULT_PATH;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const rateLimit = options.rateLimit ?? DEFAULT_RATE_LIMIT;
  const allowedHosts = options.allowedHosts ?? ['localhost', '127.0.0.1', '::1'];
  const allowedOrigins = options.allowedOrigins ?? [];
  const log = options.log ?? ((line: string) => process.stderr.write(`${line}\n`));
  const buckets = new Map<string, RateBucket>();

  const handler = createMcpHandler(() => createServer(options.config));
  const nodeHandler = toNodeHandler(handler);

  const server = createNodeServer((request: IncomingMessage, response: ServerResponse) => {
    const now = Date.now();
    const key = clientKey(request);
    const bucket = buckets.get(key);
    if (bucket === undefined || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + rateLimit.windowMs });
    } else if (bucket.count >= rateLimit.maxRequests) {
      log(`hız sınırı aşıldı: ${key}`);
      sendJson(response, 429, { error: 'Çok fazla istek; lütfen bekleyin.' }, { 'retry-after': '60' });
      return;
    } else {
      bucket.count += 1;
    }

    const url = request.url ?? '/';

    if (url === HEALTH_PATH) {
      sendJson(response, 200, { status: 'ok', service: 'pazaryeri-denetci-mcp' });
      return;
    }

    if (!url.startsWith(path)) {
      sendJson(response, 404, { error: `Bu sunucuda yalnızca ${path} ve ${HEALTH_PATH} vardır.` });
      return;
    }

    const hostName = hostnameOf(request.headers.host);
    if (hostName === null || !allowedHosts.includes(hostName)) {
      log(`izin verilmeyen Host başlığı: ${String(request.headers.host)}`);
      sendJson(response, 403, { error: 'Host başlığı izin listesinde değil.' });
      return;
    }

    const origin = request.headers.origin;
    if (origin !== undefined && origin !== '' && !allowedOrigins.includes(origin)) {
      log(`izin verilmeyen Origin: ${origin}`);
      sendJson(response, 403, { error: 'Origin izin listesinde değil.' });
      return;
    }
    if (origin !== undefined && origin !== '') {
      response.setHeader('access-control-allow-origin', origin);
      response.setHeader('vary', 'Origin');
    }

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
        'access-control-allow-headers':
          'authorization, content-type, mcp-session-id, mcp-protocol-version, last-event-id',
        'access-control-max-age': '600',
      });
      response.end();
      return;
    }

    const authorization = request.headers.authorization ?? '';
    const presented = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (presented === '' || !constantTimeEquals(presented, token)) {
      sendJson(
        response,
        401,
        { error: 'Geçerli bir Bearer token gerekli.' },
        { 'www-authenticate': 'Bearer realm="pazaryeri-denetci-mcp"' },
      );
      return;
    }

    const declaredLength = Number(request.headers['content-length'] ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
      sendJson(response, 413, {
        error: `İstek gövdesi çok büyük (üst sınır ${String(maxBodyBytes)} bayt).`,
      });
      return;
    }
    let received = 0;
    request.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > maxBodyBytes) {
        log(`gövde sınırı aşıldı: ${key}`);
        request.destroy();
        if (!response.headersSent) {
          sendJson(response, 413, { error: 'İstek gövdesi çok büyük.' });
        }
      }
    });

    // SDK'nın `...Like` tipleri `exactOptionalPropertyTypes` altında Node'un tipleriyle birebir
    // örtüşmüyor; protokol sınırı tam olarak burası olduğu için dar bir cast yapıyoruz.
    void Promise.resolve(
      nodeHandler(
        request as unknown as NodeIncomingMessageLike,
        response as unknown as NodeServerResponseLike,
      ),
    ).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      log(`istek işlenemedi: ${message}`);
      if (!response.headersSent) {
        sendJson(response, 500, { error: 'İstek işlenemedi.' });
      } else {
        response.end();
      }
    });
  });

  return {
    server,
    port: 0,
    url: '',
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

/** Sunucuyu belirtilen portta başlatır (0 = boş port seç). */
export async function listen(
  options: HttpServerOptions & { readonly port?: number; readonly host?: string },
): Promise<RunningHttpServer> {
  const running = createHttpServer(options);
  const port = options.port ?? 8787;
  const host = options.host ?? '127.0.0.1';
  await new Promise<void>((resolve, reject) => {
    running.server.once('error', reject);
    running.server.listen(port, host, () => {
      running.server.removeListener('error', reject);
      resolve();
    });
  });
  const address = running.server.address();
  const actualPort = typeof address === 'object' && address !== null ? address.port : port;
  return {
    ...running,
    port: actualPort,
    url: `http://${host}:${String(actualPort)}${options.path ?? DEFAULT_PATH}`,
  };
}

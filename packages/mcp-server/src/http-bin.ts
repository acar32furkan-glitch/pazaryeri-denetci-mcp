/**
 * HTTP (Streamable HTTP) girişi — canlı/uç nokta kullanımı.
 *
 * Örnek:
 *   MCP_HTTP_TOKEN=... ALLOWED_ORIGINS=https://demo.example pnpm run mcp:http
 */
import { listen } from './http.ts';
import { createServerConfig } from './config.ts';

function listFromEnv(raw: string | undefined, fallback: readonly string[]): readonly string[] {
  if (raw === undefined || raw.trim() === '') return fallback;
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value !== '');
}

async function main(): Promise<void> {
  const port = Number(process.env['MCP_HTTP_PORT'] ?? '8787');
  const host = process.env['MCP_HTTP_HOST'] ?? '127.0.0.1';
  const token = process.env['MCP_HTTP_TOKEN'];
  const config = createServerConfig();

  const running = await listen({
    config,
    token,
    host,
    port: Number.isInteger(port) ? port : 8787,
    allowedHosts: listFromEnv(process.env['ALLOWED_HOSTS'], ['localhost', '127.0.0.1', '::1']),
    allowedOrigins: listFromEnv(process.env['ALLOWED_ORIGINS'], []),
  });

  process.stderr.write(
    `pazaryeri-denetci-mcp (HTTP): ${running.url} · katalog ${config.source} ` +
      `(${String(config.catalog.products.length)} ürün) · kimlik doğrulama: Bearer token\n`,
  );

  const shutdown = (signal: string): void => {
    process.stderr.write(`${signal} alındı, kapatılıyor…\n`);
    void running.close().then(() => {
      process.exitCode = 0;
    });
  };
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
}

main().catch((error: unknown) => {
  process.stderr.write(
    `HTTP sunucusu başlatılamadı: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});

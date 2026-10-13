/**
 * stdio girişi — Claude Desktop, MCP Inspector ve diğer istemciler bu dosyayı çalıştırır.
 *
 * Örnek istemci yapılandırması docs/MCP.md içindedir. Hiçbir çıktı stdout'a yazılmaz: stdio
 * taşımasında stdout protokol kanalıdır, günlükler stderr'e gider.
 */
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';

import { createServerConfig } from './config.ts';
import { createServer } from './server.ts';

async function main(): Promise<void> {
  const config = createServerConfig();
  process.stderr.write(
    `pazaryeri-denetci-mcp: katalog kaynağı ${config.source} (${config.sourceDetail}), ` +
      `${String(config.catalog.products.length)} ürün\n`,
  );

  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `pazaryeri-denetci-mcp başlatılamadı: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/client/stdio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * **Derlenmiş** sunucu (`dist/bin.js`) testi: kullanıcıların gerçekten çalıştırdığı yapı budur
 * (Claude Desktop yapılandırması da bunu işaret eder). Derleme yapılmamışsa test atlanır —
 * kaynak düzeyi davranışı `stdio-integration.test.ts` zaten doğruluyor.
 */
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const builtEntry = fileURLToPath(new URL('../dist/bin.js', import.meta.url));
const built = existsSync(builtEntry);
const TEST_TIMEOUT = 60_000;
/** 21 hata türü olduğu için ürün sayısı tür sayısından büyük olmalı (üretici aksi hâlde durur). */
const BUILT_TEST_PRODUCTS = 30;

describe.skipIf(!built)('MCP sunucusu — derlenmiş giriş (dist/bin.js)', () => {
  let client: Client;

  beforeAll(async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [builtEntry],
      cwd: repoRoot,
      env: {
        ...getDefaultEnvironment(),
        MOCK_CATALOG_PRODUCTS: String(BUILT_TEST_PRODUCTS),
        MOCK_CATALOG_DEFECTS_PER_KIND: '1',
      },
    });
    client = new Client({ name: 'built-entry-test', version: '0.0.0' });
    await client.connect(transport);
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await client.close();
  });

  it(
    'derlenmiş sunucu 6 aracı listeler',
    async () => {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name).sort()).toEqual([
        'audit_catalog',
        'audit_product',
        'compare_channels',
        'export_report',
        'get_product',
        'list_products',
      ]);
    },
    TEST_TIMEOUT,
  );

  it(
    'derlenmiş sunucu denetim aracını gerçek veriyle çalıştırır',
    async () => {
      const result = (await client.callTool({
        name: 'audit_catalog',
        arguments: { topN: 3 },
      })) as unknown as { content?: { type: string; text?: string }[]; isError?: boolean };
      expect(result.isError).not.toBe(true);
      const text = result.content?.find((block) => block.type === 'text')?.text ?? '{}';
      const payload = JSON.parse(text) as {
        summary: { productCount: number; findingCount: number };
      };
      expect(payload.summary.productCount).toBe(BUILT_TEST_PRODUCTS);
      expect(payload.summary.findingCount).toBeGreaterThan(0);
    },
    TEST_TIMEOUT,
  );
});

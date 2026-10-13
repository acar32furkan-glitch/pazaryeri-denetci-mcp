import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/client/stdio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Gerçek stdio entegrasyon testi: sunucu **ayrı bir süreç** olarak başlatılır, resmî
 * `@modelcontextprotocol/client` ile bağlanılır ve araçlar/kaynaklar/prompt'lar uçtan uca çağrılır.
 *
 * Bu test, "sunucu gerçekten MCP protokolünü konuşuyor mu" sorusunun kanıtıdır; birim testleri
 * değil.
 */
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const serverEntry = fileURLToPath(new URL('../src/bin.ts', import.meta.url));
const TEST_TIMEOUT = 60_000;
const PRODUCTS = 24;

interface TextBlock {
  type: string;
  text?: string;
}

interface TextResult {
  content?: TextBlock[];
  isError?: boolean;
}

function firstText(result: TextResult): string {
  const block = result.content?.find((candidate) => candidate.type === 'text');
  if (block?.text === undefined) throw new Error('Yanıtta metin bloğu yok.');
  return block.text;
}

function parseJson(result: TextResult): Record<string, unknown> {
  return JSON.parse(firstText(result)) as Record<string, unknown>;
}

function toolResult(value: unknown): TextResult {
  return value as TextResult;
}

describe('MCP sunucusu — stdio entegrasyonu', () => {
  let client: Client;

  beforeAll(async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', serverEntry],
      cwd: repoRoot,
      env: {
        ...getDefaultEnvironment(),
        MOCK_CATALOG_PRODUCTS: String(PRODUCTS),
        MOCK_CATALOG_DEFECTS_PER_KIND: '1',
        MOCK_CATALOG_SEED: '4242',
      },
    });
    client = new Client({ name: 'pazaryeri-denetci-test', version: '0.0.0' });
    await client.connect(transport);
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await client.close();
  });

  it(
    'araç listesi beklenen 6 salt-okunur aracı içerir ve açıklamaları doludur',
    async () => {
      const { tools } = await client.listTools();
      const names = tools.map((tool) => tool.name).sort();
      expect(names).toEqual([
        'audit_catalog',
        'audit_product',
        'compare_channels',
        'export_report',
        'get_product',
        'list_products',
      ]);
      for (const tool of tools) {
        expect((tool.description ?? '').length).toBeGreaterThan(20);
        expect(tool.inputSchema).toBeDefined();
      }
    },
    TEST_TIMEOUT,
  );

  it(
    'list_products sayfalar ve filtrelenir',
    async () => {
      const page = parseJson(
        toolResult(await client.callTool({ name: 'list_products', arguments: { limit: 5 } })),
      );
      expect(page['total']).toBe(PRODUCTS);
      expect(page['limit']).toBe(5);
      expect(page['hasMore']).toBe(true);
      expect((page['items'] as unknown[]).length).toBe(5);

      const firstItem = (page['items'] as { id: string }[])[0];
      expect(firstItem?.id).toMatch(/^snt-prd-\d{4}$/u);
    },
    TEST_TIMEOUT,
  );

  it(
    'audit_catalog özet + en kritik N bulguyu döner ve çıktı deterministiktir',
    async () => {
      const first = toolResult(
        await client.callTool({ name: 'audit_catalog', arguments: { topN: 4 } }),
      );
      const second = toolResult(
        await client.callTool({ name: 'audit_catalog', arguments: { topN: 4 } }),
      );
      expect(firstText(second)).toBe(firstText(first));

      const payload = parseJson(first);
      const summary = payload['summary'] as {
        productCount: number;
        findingCount: number;
        severityOrder: { severity: string; count: number }[];
      };
      expect(summary.productCount).toBe(PRODUCTS);
      expect(summary.findingCount).toBeGreaterThan(0);
      expect(summary.severityOrder.map((row) => row.severity)).toEqual([
        'critical',
        'major',
        'minor',
      ]);
      expect((payload['findings'] as unknown[]).length).toBe(4);

      const severities = (payload['findings'] as { severity: string }[]).map(
        (finding) => finding.severity,
      );
      expect(severities[0]).toBe('critical');
    },
    TEST_TIMEOUT,
  );

  it(
    'audit_product kural filtresi uygular',
    async () => {
      const page = parseJson(
        toolResult(await client.callTool({ name: 'list_products', arguments: { limit: 1 } })),
      );
      const id = (page['items'] as { id: string }[])[0]?.id ?? '';
      const result = parseJson(
        toolResult(
          await client.callTool({
            name: 'audit_product',
            arguments: { id, ruleIds: ['TITLE_LENGTH'] },
          }),
        ),
      );
      const findings = result['findings'] as { ruleId: string }[];
      expect(findings.every((finding) => finding.ruleId === 'TITLE_LENGTH')).toBe(true);
    },
    TEST_TIMEOUT,
  );

  it(
    'get_product bilinmeyen kimlikte yapılandırılmış hata verir ve sunucu ayakta kalır',
    async () => {
      const missing = toolResult(
        await client.callTool({ name: 'get_product', arguments: { id: 'snt-prd-9999' } }),
      );
      expect(missing.isError).toBe(true);
      expect(firstText(missing)).toContain('Ürün bulunamadı');

      // Hata sonrası sunucu hâlâ yanıt veriyor (süreç çökmüyor):
      const after = toolResult(
        await client.callTool({ name: 'list_products', arguments: { limit: 1 } }),
      );
      expect(after.isError).not.toBe(true);
      expect(parseJson(after)['total']).toBe(PRODUCTS);
    },
    TEST_TIMEOUT,
  );

  it(
    'compare_channels SKU bazlı fiyat/stok karşılaştırması yapar',
    async () => {
      const page = parseJson(
        toolResult(await client.callTool({ name: 'list_products', arguments: { limit: 1 } })),
      );
      const id = (page['items'] as { id: string }[])[0]?.id ?? '';
      const product = parseJson(
        toolResult(await client.callTool({ name: 'get_product', arguments: { id } })),
      );
      const sku = (product['variants'] as { sku: string | null }[])[0]?.sku ?? '';
      expect(sku).not.toBe('');

      const result = parseJson(
        toolResult(await client.callTool({ name: 'compare_channels', arguments: { sku } })),
      );
      expect(result['comparedSkus']).toBe(1);
      const row = (
        result['rows'] as {
          channels: { channel: string; consistent?: boolean }[];
          consistent: boolean;
        }[]
      )[0];
      expect(row?.channels.length).toBe(3);
      expect(row?.channels.map((channel) => channel.channel)).toEqual([
        'trendyol',
        'hepsiburada',
        'merchant-center',
      ]);
      expect(row?.consistent).toBe(true);
    },
    TEST_TIMEOUT,
  );

  it(
    'export_report hem Markdown hem JSON üretir',
    async () => {
      const markdown = firstText(
        toolResult(
          await client.callTool({
            name: 'export_report',
            arguments: { format: 'markdown', maxFindings: 2 },
          }),
        ),
      );
      expect(markdown).toContain('# Katalog Denetim Raporu');
      expect(markdown).toContain('## Özet');

      const jsonText = firstText(
        toolResult(await client.callTool({ name: 'export_report', arguments: { format: 'json' } })),
      );
      const parsed = JSON.parse(jsonText) as { generatedBy: string; findings: unknown[] };
      expect(parsed.generatedBy).toBe('pazaryeri-denetci-mcp');
      expect(parsed.findings.length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT,
  );

  it(
    'kaynaklar okunur: kural kataloğu 17 kural ve katalog özeti sayaçları içerir',
    async () => {
      const { resources } = await client.listResources();
      const uris = resources.map((resource) => resource.uri);
      expect(uris).toContain('catalog://rules');
      expect(uris).toContain('catalog://summary');

      const rules = await client.readResource({ uri: 'catalog://rules' });
      const ruleBlock = rules.contents[0];
      const ruleText = ruleBlock !== undefined && 'text' in ruleBlock ? ruleBlock.text : '[]';
      const parsedRules = JSON.parse(ruleText) as { id: string; appliesTo: string[] }[];
      expect(parsedRules.length).toBe(17);
      expect(parsedRules[0]?.appliesTo.length).toBe(5);

      const summary = await client.readResource({ uri: 'catalog://summary' });
      const summaryBlock = summary.contents[0];
      const summaryText =
        summaryBlock !== undefined && 'text' in summaryBlock ? summaryBlock.text : '{}';
      const parsedSummary = JSON.parse(summaryText) as {
        products: number;
        findings: number;
      };
      expect(parsedSummary.products).toBe(PRODUCTS);
      expect(parsedSummary.findings).toBeGreaterThan(0);
    },
    TEST_TIMEOUT,
  );

  it(
    'prompt şablonları listelenir ve üretilir',
    async () => {
      const { prompts } = await client.listPrompts();
      const names = prompts.map((prompt) => prompt.name).sort();
      expect(names).toEqual(['katalog-saglik-denetimi', 'tek-urun-iyilestirme']);

      const auditPrompt = await client.getPrompt({ name: 'katalog-saglik-denetimi' });
      expect(auditPrompt.messages.length).toBe(1);

      const page = parseJson(
        toolResult(await client.callTool({ name: 'list_products', arguments: { limit: 1 } })),
      );
      const id = (page['items'] as { id: string }[])[0]?.id ?? '';
      const productPrompt = await client.getPrompt({
        name: 'tek-urun-iyilestirme',
        arguments: { productId: id },
      });
      const text = JSON.stringify(productPrompt.messages);
      expect(text).toContain(id);
    },
    TEST_TIMEOUT,
  );
});

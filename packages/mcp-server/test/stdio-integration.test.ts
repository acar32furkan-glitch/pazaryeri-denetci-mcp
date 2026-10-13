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
    'araç listesi beklenen 7 salt-okunur aracı içerir ve açıklamaları doludur',
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
        'suggest_fix',
      ]);
      for (const tool of tools) {
        expect((tool.description ?? '').length).toBeGreaterThan(20);
        expect(tool.inputSchema).toBeDefined();
      }
      // Araç açıklaması "öneri-only" sözleşmesini açıkça taşımalı (ajan yanlış aracı seçmesin).
      const suggest = tools.find((tool) => tool.name === 'suggest_fix');
      expect(suggest?.description ?? '').toContain(
        'yalnızca öneri döner, hiçbir değişikliği uygulamaz',
      );
      expect(tools.length).toBe(7);
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

/**
 * `suggest_fix` senaryoları ayrı sunucu süreçleriyle koşar: öneri modu **ortam değişkeninden**
 * seçildiği için modu gerçekten süreç sınırında doğrulamak gerekir.
 *
 * Hiçbir senaryoda ağa çıkılmaz: `mock` sahte istemci, `off` devre dışı istemci kullanır.
 */
const SUGGEST_ENV = {
  MOCK_CATALOG_PRODUCTS: String(PRODUCTS),
  MOCK_CATALOG_DEFECTS_PER_KIND: '1',
  MOCK_CATALOG_SEED: '4242',
} as const;

/** Bulgusu olan (başlık/açıklama düzeltmesi isteyen) ürün kimliklerini sırayla döner. */
async function fixableProductIds(client: Client): Promise<string[]> {
  const audit = parseJson(
    toolResult(await client.callTool({ name: 'audit_catalog', arguments: { topN: 100 } })),
  );
  const findings = audit['findings'] as { productId: string; field: string }[];
  const ids = new Set(
    findings
      .filter((finding) => finding.field === 'title' || finding.field === 'descriptionHtml')
      .map((finding) => finding.productId),
  );
  if (ids.size === 0) {
    throw new Error('Test kurgusu: düzeltilebilir bulgusu olan ürün bulunamadı');
  }
  return [...ids];
}

/** Bulgusu olan tek bir ürün kimliği bulur. */
async function firstFixableProductId(client: Client): Promise<string> {
  const ids = await fixableProductIds(client);
  const first = ids[0];
  if (first === undefined) throw new Error('Test kurgusu: düzeltilebilir ürün yok');
  return first;
}

/** Tek ürün denetiminde hiç bulgu üretmeyen bir ürün kimliği bulur (eksiksiz ürün). */
async function firstCleanProductId(client: Client): Promise<string> {
  const page = parseJson(
    toolResult(await client.callTool({ name: 'list_products', arguments: { limit: 200 } })),
  );
  for (const item of page['items'] as { id: string }[]) {
    const audit = parseJson(
      toolResult(await client.callTool({ name: 'audit_product', arguments: { id: item.id } })),
    );
    if (audit['findingCount'] === 0) return item.id;
  }
  throw new Error('Test kurgusu: bulgusuz ürün bulunamadı');
}

describe('MCP sunucusu — suggest_fix (salt-öneri aracı)', () => {
  let mockClient: Client;
  let offClient: Client;
  let quotaClient: Client;

  beforeAll(async () => {
    mockClient = new Client({ name: 'suggest-mock-test', version: '0.0.0' });
    await mockClient.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: ['--import', 'tsx', serverEntry],
        cwd: repoRoot,
        env: {
          ...getDefaultEnvironment(),
          ...SUGGEST_ENV,
          MCP_LLM_MODE: 'mock',
        },
      }),
    );

    offClient = new Client({ name: 'suggest-off-test', version: '0.0.0' });
    await offClient.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: ['--import', 'tsx', serverEntry],
        cwd: repoRoot,
        env: {
          ...getDefaultEnvironment(),
          ...SUGGEST_ENV,
          MCP_LLM_MODE: 'off',
          // Anahtar bilinçli olarak boş: devre dışı yolun tek gerekçesi mod değil, anahtarsızlık da olabilir.
          ANTHROPIC_API_KEY: '',
        },
      }),
    );
    quotaClient = new Client({ name: 'suggest-quota-test', version: '0.0.0' });
    await quotaClient.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: ['--import', 'tsx', serverEntry],
        cwd: repoRoot,
        env: {
          ...getDefaultEnvironment(),
          ...SUGGEST_ENV,
          MCP_LLM_MODE: 'mock',
          // 1 token bütçesi: sahte istemci çağrı başına 800 girdi token'ı harcar → ikinci istek "kota".
          LLM_DAILY_TOKEN_BUDGET: '1',
        },
      }),
    );
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await mockClient.close();
    await offClient.close();
    await quotaClient.close();
  });

  it(
    'suggest_fix araç listesinde görünür (toplam 7 araç)',
    async () => {
      const { tools } = await mockClient.listTools();
      const names = tools.map((tool) => tool.name).sort();
      expect(names).toContain('suggest_fix');
      expect(tools.length).toBe(7);
    },
    TEST_TIMEOUT,
  );

  it(
    'MCP_LLM_MODE=mock: sahte istemci öneri üretir, mod "mock" raporlanır ve uyarı metni bulunur',
    async () => {
      const id = await firstFixableProductId(mockClient);
      const payload = parseJson(
        toolResult(
          await mockClient.callTool({ name: 'suggest_fix', arguments: { id, topFindings: 3 } }),
        ),
      );

      expect(payload['productId']).toBe(id);
      expect(payload['status']).toBe('ok');
      expect(payload['mode']).toBe('mock');
      expect(payload['model']).toBe('mock-demo');
      expect(payload['source']).toBe('llm');
      expect(payload['findingsConsidered']).toBeGreaterThan(0);
      expect(String(payload['message'])).toContain('sahte/demo istemci');
      expect(String(payload['rationale']).length).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(payload['confidence']);
      expect((payload['addressedRuleIds'] as string[]).length).toBeGreaterThan(0);

      // Önerilen alanlar dolu: sahte istemci en az bir alanı yeniden yazar.
      const fields = payload['fields'] as Record<string, string>;
      const filled = Object.values(fields).filter(
        (value) => typeof value === 'string' && value.length > 0,
      );
      expect(filled.length).toBeGreaterThan(0);

      // Aynı girdi ikinci kez sorulduğunda LLM'e tekrar gidilmez (önbellek → maliyet kontrolü).
      const second = parseJson(
        toolResult(
          await mockClient.callTool({ name: 'suggest_fix', arguments: { id, topFindings: 3 } }),
        ),
      );
      expect(second['status']).toBe('ok');
      expect(second['source']).toBe('cache');
    },
    TEST_TIMEOUT,
  );

  it(
    'MCP_LLM_MODE=off: yapılandırılmış "devre-disi" yanıtı verir ve sunucu ayakta kalır',
    async () => {
      const id = await firstFixableProductId(offClient);
      const payload = parseJson(
        toolResult(await offClient.callTool({ name: 'suggest_fix', arguments: { id } })),
      );

      expect(payload['status']).toBe('unavailable');
      expect(payload['reason']).toBe('devre-disi');
      expect(payload['mode']).toBe('devre-disi');
      expect(payload['model']).toBeNull();
      expect(String(payload['message']).length).toBeGreaterThan(20);
      expect(payload['productId']).toBe(id);

      // Çökme yok: sonraki çağrılar ve tools/list çalışmaya devam ediyor.
      const after = toolResult(
        await offClient.callTool({ name: 'audit_catalog', arguments: { topN: 1 } }),
      );
      expect(after.isError).not.toBe(true);
      const { tools } = await offClient.listTools();
      expect(tools.length).toBe(7);
    },
    TEST_TIMEOUT,
  );

  it(
    'olmayan ürün kimliğinde yapılandırılmış hata verir ve süreç çökmez',
    async () => {
      const missing = toolResult(
        await mockClient.callTool({ name: 'suggest_fix', arguments: { id: 'snt-prd-9999' } }),
      );
      expect(missing.isError).toBe(true);
      expect(firstText(missing)).toContain('Ürün bulunamadı');

      // Kimlik de handle de verilmezse açık hata:
      const neither = toolResult(await mockClient.callTool({ name: 'suggest_fix', arguments: {} }));
      expect(neither.isError).toBe(true);
      expect(firstText(neither)).toContain('id');

      // Hata sonrası sunucu hâlâ yanıt veriyor:
      const after = toolResult(
        await mockClient.callTool({ name: 'list_products', arguments: { limit: 1 } }),
      );
      expect(after.isError).not.toBe(true);
      expect(parseJson(after)['total']).toBe(PRODUCTS);
    },
    TEST_TIMEOUT,
  );

  it(
    'bulgusuz üründe öneri istenmez ve açık mesajla döner (hata değildir)',
    async () => {
      const id = await firstCleanProductId(mockClient);
      const result = toolResult(
        await mockClient.callTool({ name: 'suggest_fix', arguments: { id } }),
      );
      expect(result.isError).not.toBe(true);

      const payload = parseJson(result);
      expect(payload['productId']).toBe(id);
      expect(payload['status']).toBe('ok');
      expect(payload['findingsConsidered']).toBe(0);
      expect(String(payload['message'])).toContain('düzeltilecek bulgu yok');
      // Öneri istenmedi: alan/gerekçe döndürülmez.
      expect(payload['fields']).toBeUndefined();
      expect(payload['rationale']).toBeUndefined();
    },
    TEST_TIMEOUT,
  );

  it(
    'LLM_DAILY_TOKEN_BUDGET ortam değişkeni uygulanır: bütçe dolunca "kota" döner',
    async () => {
      const ids = await fixableProductIds(quotaClient);
      const first = ids[0];
      const second = ids[1];
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(second).not.toBe(first);

      const allowed = parseJson(
        toolResult(await quotaClient.callTool({ name: 'suggest_fix', arguments: { id: first } })),
      );
      expect(allowed['status']).toBe('ok');

      // Farklı ürün → önbellek ıskası → bütçe zaten doldu → öneri üretilmez (hata değil, kotadır).
      const blocked = parseJson(
        toolResult(await quotaClient.callTool({ name: 'suggest_fix', arguments: { id: second } })),
      );
      expect(blocked['status']).toBe('unavailable');
      expect(blocked['reason']).toBe('kota');
      expect(String(blocked['message'])).toContain('token bütçesi');
    },
    TEST_TIMEOUT,
  );
});

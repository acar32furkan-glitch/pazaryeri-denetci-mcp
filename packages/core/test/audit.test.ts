import { describe, expect, it } from 'vitest';

import {
  RULE_CATALOG,
  auditCatalog,
  auditProduct,
  groupListingsBySku,
  summarize,
  topFindings,
} from '../src/index.ts';
import type { Severity } from '../src/index.ts';
import { makeCatalog, makeListing, makeProduct } from './factories.ts';

describe('auditCatalog', () => {
  const clean = makeProduct({ id: 'snt-prd-0001' });
  const shortTitle = makeProduct({ id: 'snt-prd-0002', title: 'Kazak' });
  const emptyDescription = makeProduct({ id: 'snt-prd-0003', descriptionHtml: '' });
  const noAlt = makeProduct({
    id: 'snt-prd-0004',
    images: [{ url: 'https://cdn.test/x.jpg', altText: null }],
  });

  it('bulguları şiddet → kural → ürün sırasına göre sıralar (kararlı çıktı)', () => {
    const result = auditCatalog(makeCatalog([noAlt, shortTitle, emptyDescription, clean]));
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      'DESC_MISSING', // kritik
      'TITLE_LENGTH', // orta
      'IMAGE_ALT_MISSING', // düşük
    ]);
    expect(result.findings[0]?.productId).toBe('snt-prd-0003');
  });

  it('aynı girdi için iki koşu birebir aynı sonucu verir', () => {
    const catalog = makeCatalog([noAlt, shortTitle, emptyDescription, clean]);
    const first = auditCatalog(catalog);
    const second = auditCatalog(catalog);
    expect(JSON.stringify(second.findings)).toBe(JSON.stringify(first.findings));
    expect(second.summary).toEqual(first.summary);
  });

  it('özet sayaçları doğru hesaplar', () => {
    const result = auditCatalog(makeCatalog([shortTitle, emptyDescription]));
    expect(result.summary.productCount).toBe(2);
    expect(result.summary.findingCount).toBe(2);
    const bySeverity: Record<Severity, number> = result.summary.bySeverity;
    expect(bySeverity.critical).toBe(1);
    expect(bySeverity.major).toBe(1);
    expect(bySeverity.minor).toBe(0);
    expect(result.summary.byRule).toEqual({ DESC_MISSING: 1, TITLE_LENGTH: 1 });
  });

  it('boş katalogda çökmez', () => {
    const result = auditCatalog(makeCatalog([]));
    expect(result.findings).toEqual([]);
    expect(result.summary.productCount).toBe(0);
  });

  it('ilerleme geri çağrısını her ürün için bir kez çağırır', () => {
    const seen: string[] = [];
    auditCatalog(makeCatalog([clean, shortTitle]), {
      onProgress: (done, total) => seen.push(`${done}/${total}`),
    });
    expect(seen).toEqual(['1/2', '2/2']);
  });

  it('yalnızca verilen kural alt kümesini koşturur', () => {
    const result = auditCatalog(makeCatalog([shortTitle, emptyDescription]), {
      rules: RULE_CATALOG.filter((rule) => rule.id === 'DESC_MISSING'),
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.ruleId).toBe('DESC_MISSING');
  });

  it('kanal beslemelerini SKU üzerinden ürüne bağlar', () => {
    const product = makeProduct({
      variants: [makeProduct().variants[0]!],
    });
    const listings = [
      makeListing({ sku: 'SNT-0001-01', channel: 'trendyol' }),
      makeListing({ sku: 'SNT-0001-01', channel: 'hepsiburada' }),
      makeListing({ sku: 'BASKASININ-SKU', channel: 'n11' }),
    ];
    let received: number | null = null;
    auditCatalog(makeCatalog([product], listings), {
      rules: [
        {
          id: 'TEST_LISTING_COUNT',
          severity: 'minor',
          appliesTo: ['shopify'],
          title: 'test',
          description: 'test kuralı',
          check: ({ listings: contextListings }) => {
            received = contextListings.length;
            return [];
          },
        },
      ],
    });
    expect(received).toBe(2);
  });
});

describe('auditProduct', () => {
  it('tek ürünü tüm kurallarla denetler', () => {
    expect(auditProduct(makeProduct())).toEqual([]);
    expect(auditProduct(makeProduct({ title: 'Kısa' })).length).toBeGreaterThan(0);
  });
});

describe('groupListingsBySku', () => {
  it('SKU boş olan satırları atlar ve kanalları gruplar', () => {
    const groups = groupListingsBySku([
      makeListing({ sku: 'A', channel: 'trendyol' }),
      makeListing({ sku: 'A', channel: 'n11' }),
      makeListing({ sku: '' }),
      makeListing({ sku: null }),
      makeListing({ sku: '  ' }),
    ]);
    expect([...groups.keys()]).toEqual(['A']);
    expect(groups.get('A')).toHaveLength(2);
  });
});

describe('summarize / topFindings', () => {
  it('en kritik N bulguyu döner', () => {
    const result = auditCatalog(makeCatalog([makeProduct({ title: 'Kazak' })]));
    expect(topFindings(result, 1)).toHaveLength(1);
    expect(topFindings(result, 0)).toEqual([]);
    expect(topFindings(result, -5)).toEqual([]);
    expect(topFindings(result, 100)).toHaveLength(result.findings.length);
  });

  it('özet boş listede sıfır sayaç üretir', () => {
    expect(summarize([], 3)).toEqual({
      productCount: 3,
      findingCount: 0,
      bySeverity: { critical: 0, major: 0, minor: 0 },
      byRule: {},
    });
  });
});

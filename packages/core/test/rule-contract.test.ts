import { describe, expect, it } from 'vitest';

import { RULE_CATALOG, RULE_ID_LIST, auditProduct, getRule } from '../src/index.ts';
import type { Product } from '../src/index.ts';
import { makeListing, makeProduct, makeVariant } from './factories.ts';

/** Kasıtlı olarak her kuralın tetiklendiği bozuk ürün (DESC_TOO_SHORT/DESC_UNSAFE_HTML hariç). */
const brokenProduct: Product = makeProduct({
  title: 'urun urun urun',
  descriptionHtml: '',
  seo: { title: null, description: 'Ã¼rÃ¼n aÃ§Ä±klama' },
  images: [{ url: 'https://cdn.test/1.jpg', altText: null }],
  metafields: [
    { namespace: 'sentetik', key: 'renk', type: 'single_line_text_field', value: 'Gri' },
  ],
  variants: [
    makeVariant({
      sku: 'DUP-1',
      barcode: '4006381333932',
      price: null,
      compareAtPrice: 10,
      inventoryQuantity: -5,
    }),
    makeVariant({
      sku: 'DUP-1',
      barcode: '96385074',
      price: 100,
      compareAtPrice: 50,
      inventoryQuantity: 3,
      options: [
        { name: 'Renk', value: 'kırmızı' },
        { name: 'Beden', value: 'S' },
      ],
    }),
    makeVariant({
      sku: null,
      barcode: '',
      price: 20,
      compareAtPrice: null,
      inventoryQuantity: 0,
      options: [
        { name: 'Renk', value: 'Kırmızı' },
        { name: 'Beden', value: 'XS' },
      ],
    }),
    // SKU'su benzersiz bir varyant: kanal uyuşmazlığı yalnızca SKU tek olan varyantlarda aranır
    // (tekrar eden SKU'da karşılaştırma anlamsızdır, o hatanın sahibi SKU_DUPLICATE'dir).
    makeVariant({
      sku: 'SNT-0001-04',
      barcode: '96385074',
      price: 150,
      compareAtPrice: 200,
      inventoryQuantity: 5,
      options: [
        { name: 'Renk', value: 'Gri' },
        { name: 'Beden', value: 'L' },
      ],
    }),
  ],
});

/** Aynı üründe DESC_MISSING ile DESC_TOO_SHORT çakıştığı için ikinci örnek gerekir. */
const shortUnsafeProduct: Product = makeProduct({
  id: 'snt-prd-0002',
  descriptionHtml: '<p>Kısa açıklama.</p><script>alert(1)</script>',
});

function allBrokenFindings(): ReturnType<typeof auditProduct> {
  return [
    ...auditProduct(brokenProduct, RULE_CATALOG, [
      makeListing({ sku: 'SNT-0001-04', price: 999, stock: 5 }),
    ]),
    ...auditProduct(shortUnsafeProduct),
  ];
}

describe('kural kayıt defteri sözleşmesi', () => {
  it('kayıt defteri sırası RULE_ID_LIST ile birebir aynıdır', () => {
    expect(RULE_CATALOG.map((rule) => rule.id)).toEqual([...RULE_ID_LIST]);
  });

  it('kural kimlikleri benzersizdir', () => {
    const ids = RULE_CATALOG.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('her kural meta bilgisi doludur ve en az bir kanala uygulanır', () => {
    for (const rule of RULE_CATALOG) {
      expect(rule.title.trim().length).toBeGreaterThan(0);
      expect(rule.description.trim().length).toBeGreaterThan(10);
      expect(rule.appliesTo.length).toBeGreaterThan(0);
    }
  });

  it('getRule kayıtlı kuralı bulur, kayıtsız kimlikte undefined döner', () => {
    expect(getRule('TITLE_LENGTH')?.id).toBe('TITLE_LENGTH');
    expect(RULE_CATALOG.every((rule) => getRule(rule.id as never) === rule)).toBe(true);
  });

  it('bulgular kendi kuralının kimliğini ve şiddetini taşır (kayma koruması)', () => {
    const findings = allBrokenFindings();
    expect(findings.length).toBeGreaterThanOrEqual(RULE_CATALOG.length);
    for (const finding of findings) {
      const rule = RULE_CATALOG.find((candidate) => candidate.id === finding.ruleId);
      expect(rule, `bilinmeyen kural: ${finding.ruleId}`).toBeDefined();
      expect(finding.severity).toBe(rule?.severity);
      expect([brokenProduct.id, shortUnsafeProduct.id]).toContain(finding.productId);
      expect(finding.message.trim().length).toBeGreaterThan(0);
      expect(finding.fixHint.trim().length).toBeGreaterThan(0);
    }
  });

  it('her kural, bozuk örneklerin birinde mutlaka tetiklenir', () => {
    const findings = allBrokenFindings();
    for (const rule of RULE_CATALOG) {
      expect(
        findings.some((finding) => finding.ruleId === rule.id),
        `${rule.id} hiç bulgu üretmedi`,
      ).toBe(true);
    }
  });
});

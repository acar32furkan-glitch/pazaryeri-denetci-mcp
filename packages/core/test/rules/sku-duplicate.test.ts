import { describe, expect, it } from 'vitest';

import { skuDuplicateRule } from '../../src/index.ts';
import type { CatalogIndex, Variant } from '../../src/index.ts';
import { makeProduct, makeVariant } from '../factories.ts';

function check(variants: Variant[], index?: CatalogIndex) {
  const product = makeProduct({ variants });
  return index === undefined
    ? skuDuplicateRule.check({ product, listings: [] })
    : skuDuplicateRule.check({ product, listings: [], index });
}

describe('SKU_DUPLICATE', () => {
  it('geçen durum: benzersiz SKU değerlerinde bulgu üretmez', () => {
    expect(check([makeVariant({ sku: 'SNT-1' }), makeVariant({ sku: 'SNT-2' })])).toEqual([]);
  });

  it('geçen durum: indekste ilk sahip olan ürün bulgu üretmez', () => {
    const index: CatalogIndex = {
      skuOwners: new Map<string, readonly string[]>([['SNT-1', ['snt-prd-0001', 'snt-prd-0000']]]),
    };
    expect(check([makeVariant({ sku: 'SNT-1' })], index)).toEqual([]);
  });

  it('kalan durum: indeks olmadan ürün içi SKU tekrarı yakalanır', () => {
    const findings = check([makeVariant({ sku: 'SNT-1' }), makeVariant({ sku: 'SNT-1' })]);
    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding?.ruleId).toBe('SKU_DUPLICATE');
    expect(finding?.severity).toBe('major');
    expect(finding?.variantSku).toBe('SNT-1');
    expect(finding?.field).toBe('variants[1].sku');
    expect(finding?.message).toContain('bu ürünün 1. varyantında da var');
  });

  it('kalan durum: SKU başka bir üründe de kullanılıyorsa uyarılır', () => {
    const index: CatalogIndex = {
      skuOwners: new Map<string, readonly string[]>([['SNT-1', ['snt-prd-0000', 'snt-prd-0001']]]),
    };
    const findings = check([makeVariant({ sku: 'SNT-1' })], index);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.field).toBe('variants[0].sku');
    expect(findings[0]?.message).toContain('başka bir üründe (snt-prd-0000)');
  });
});

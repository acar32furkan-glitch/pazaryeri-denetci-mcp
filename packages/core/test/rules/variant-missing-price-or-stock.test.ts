import { describe, expect, it } from 'vitest';

import { variantMissingPriceOrStockRule } from '../../src/index.ts';
import type { Variant } from '../../src/index.ts';
import { makeProduct, makeVariant } from '../factories.ts';

function check(variants: Variant[]) {
  return variantMissingPriceOrStockRule.check({
    product: makeProduct({ variants }),
    listings: [],
  });
}

describe('VARIANT_MISSING_PRICE_OR_STOCK', () => {
  it('geçen durum: geçerli varyantta bulgu üretmez', () => {
    expect(check([makeVariant({ price: 199.9, inventoryQuantity: 12 })])).toEqual([]);
  });

  it('geçen sınır: stok sıfır kabul edilir (satışta yok ama geçerli)', () => {
    expect(check([makeVariant({ price: 199.9, inventoryQuantity: 0 })])).toEqual([]);
  });

  it('kalan durum: price null → bulgu ve variantSku taşınır', () => {
    const findings = check([makeVariant({ sku: 'SNT-1', price: null })]);
    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding?.ruleId).toBe('VARIANT_MISSING_PRICE_OR_STOCK');
    expect(finding?.severity).toBe('critical');
    expect(finding?.variantSku).toBe('SNT-1');
    expect(finding?.field).toBe('variants[0]');
    expect(finding?.message).toContain('fiyat tanımsız');
  });

  it('kalan sınır: price 0 → bulgu', () => {
    const findings = check([makeVariant({ price: 0 })]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('fiyat geçersiz');
  });

  it('kalan durum: inventoryQuantity null → bulgu', () => {
    const findings = check([makeVariant({ inventoryQuantity: null })]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('stok adedi tanımsız');
  });

  it('kalan sınır: inventoryQuantity -1 → bulgu', () => {
    const findings = check([makeVariant({ inventoryQuantity: -1 })]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('stok negatif');
  });

  it('iki bozuk varyant için iki ayrı bulgu üretilir', () => {
    const findings = check([
      makeVariant({ sku: 'SNT-1', price: null }),
      makeVariant({ sku: 'SNT-2', inventoryQuantity: -1 }),
    ]);
    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.variantSku)).toEqual(['SNT-1', 'SNT-2']);
  });
});

import { describe, expect, it } from 'vitest';

import { skuMissingRule } from '../../src/index.ts';
import { makeProduct, makeVariant } from '../factories.ts';

function check(skus: readonly (string | null)[]) {
  return skuMissingRule.check({
    product: makeProduct({
      variants: skus.map((sku) => makeVariant({ sku })),
    }),
    listings: [],
  });
}

describe('SKU_MISSING', () => {
  it('geçen durum: tüm SKU değerleri doluysa bulgu üretmez', () => {
    expect(check(['SNT-0001-01', 'SNT-0001-02'])).toEqual([]);
  });

  it('kalan durum: SKU null', () => {
    const findings = check([null]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('SKU_MISSING');
    expect(findings[0]?.severity).toBe('critical');
    expect(findings[0]?.field).toBe('variants[0].sku');
    expect(findings[0]?.variantSku).toBeNull();
    expect(findings[0]?.message).toContain('1. varyantta');
  });

  it('kalan durum: SKU boş dize', () => {
    expect(check([''])).toHaveLength(1);
  });

  it('kalan durum: SKU yalnızca boşluk', () => {
    expect(check(['  '])).toHaveLength(1);
  });

  it('ikinci varyantın SKU değeri eksikse alan yolu doğru olur', () => {
    const findings = check(['SNT-0001-01', null]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.field).toBe('variants[1].sku');
    expect(findings[0]?.message).toContain('2. varyantta');
  });

  it('iki varyant da eksikse iki bulgu üretir', () => {
    const findings = check([null, null]);
    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.field)).toEqual([
      'variants[0].sku',
      'variants[1].sku',
    ]);
  });
});

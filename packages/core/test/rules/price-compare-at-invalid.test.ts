import { describe, expect, it } from 'vitest';

import { priceCompareAtInvalidRule } from '../../src/index.ts';
import type { Variant } from '../../src/index.ts';
import { makeProduct, makeVariant } from '../factories.ts';

function check(variants: Variant[]) {
  return priceCompareAtInvalidRule.check({ product: makeProduct({ variants }), listings: [] });
}

describe('PRICE_COMPARE_AT_INVALID', () => {
  it('geçen durum: compareAtPrice null ise değerlendirilmez', () => {
    expect(check([makeVariant({ price: 199.9, compareAtPrice: null })])).toEqual([]);
  });

  it('geçen durum: compareAtPrice satış fiyatından büyükse kabul edilir', () => {
    expect(check([makeVariant({ price: 199.9, compareAtPrice: 249.9 })])).toEqual([]);
  });

  it('kalan sınır: compareAtPrice === price → bulgu', () => {
    const findings = check([makeVariant({ sku: 'SNT-1', price: 199.9, compareAtPrice: 199.9 })]);
    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding?.ruleId).toBe('PRICE_COMPARE_AT_INVALID');
    expect(finding?.severity).toBe('major');
    expect(finding?.variantSku).toBe('SNT-1');
    expect(finding?.field).toBe('variants[0].compareAtPrice');
    expect(finding?.message).toContain('büyük değil');
  });

  it('kalan durum: compareAtPrice satış fiyatından düşükse bulgu', () => {
    expect(check([makeVariant({ price: 199.9, compareAtPrice: 99.9 })])).toHaveLength(1);
  });

  it('kalan durum: price null ama compareAtPrice doluysa bulgu', () => {
    const findings = check([makeVariant({ price: null, compareAtPrice: 249.9 })]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('satış fiyatı tanımsız');
  });
});

import { describe, expect, it } from 'vitest';

import { channelMismatchRule } from '../../src/index.ts';
import type { ChannelListing, Variant } from '../../src/index.ts';
import { makeListing, makeProduct, makeVariant } from '../factories.ts';

const SKU = 'SNT-0001-01';

function check(variants: Variant[], listings: ChannelListing[]) {
  return channelMismatchRule.check({ product: makeProduct({ variants }), listings });
}

describe('CHANNEL_MISMATCH', () => {
  it('geçen durum: ürün ve kanal satırı aynı fiyat/stok ise bulgu üretmez', () => {
    const variants = [makeVariant({ sku: SKU, price: 199.9, inventoryQuantity: 12 })];
    const listings = [makeListing({ sku: SKU, price: 199.9, stock: 12 })];
    expect(check(variants, listings)).toEqual([]);
  });

  it('kalan durum: bir kanalda farklı fiyat', () => {
    const variants = [makeVariant({ sku: SKU, price: 199.9, inventoryQuantity: 12 })];
    const listings = [makeListing({ sku: SKU, price: 150, stock: 12 })];
    const findings = check(variants, listings);
    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding?.ruleId).toBe('CHANNEL_MISMATCH');
    expect(finding?.severity).toBe('critical');
    expect(finding?.variantSku).toBe(SKU);
    expect(finding?.field).toBe('variants[0].listings');
    expect(finding?.message).toContain('1 kanalda');
  });

  it('kalan durum: bir kanalda farklı stok', () => {
    const variants = [makeVariant({ sku: SKU, price: 199.9, inventoryQuantity: 12 })];
    const listings = [makeListing({ sku: SKU, price: 199.9, stock: 5 })];
    const findings = check(variants, listings);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('stok 5');
  });

  it('iki kanal bozuksa tek bulguda ikisi de sayılır', () => {
    const variants = [makeVariant({ sku: SKU, price: 199.9, inventoryQuantity: 12 })];
    const listings = [
      makeListing({ channel: 'trendyol', sku: SKU, price: 150, stock: 12 }),
      makeListing({ channel: 'n11', sku: SKU, price: 199.9, stock: 5 }),
    ];
    const findings = check(variants, listings);
    expect(findings).toHaveLength(1);
    const detail = findings[0]?.evidence ?? '';
    expect(detail).toContain('trendyol');
    expect(detail).toContain('n11');
    expect(findings[0]?.message).toContain('2 kanalda');
  });

  it('sınır: 199.9 ile 199.90 farkı yanlış pozitif üretmez', () => {
    const variants = [makeVariant({ sku: SKU, price: 199.9, inventoryQuantity: 12 })];
    const listings = [makeListing({ sku: SKU, price: 199.9, stock: 12 })];
    expect(check(variants, listings)).toEqual([]);
  });

  it('sınır: kayan nokta artığı (0.1 + 0.2 ile 0.3) yanlış pozitif üretmez', () => {
    const variants = [makeVariant({ sku: SKU, price: 0.1 + 0.2, inventoryQuantity: 12 })];
    const listings = [makeListing({ sku: SKU, price: 0.3, stock: 12 })];
    expect(check(variants, listings)).toEqual([]);
  });

  it('kural susar: varyantın fiyatı/stoku null ise sorumluluk diğer kuraldadır', () => {
    const variants = [makeVariant({ sku: SKU, price: null, inventoryQuantity: null })];
    const listings = [makeListing({ sku: SKU, price: 50, stock: 1 })];
    expect(check(variants, listings)).toEqual([]);
  });
});

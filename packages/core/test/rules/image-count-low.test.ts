import { describe, expect, it } from 'vitest';

import { IMAGE_MIN_COUNT, imageCountLowRule } from '../../src/index.ts';
import type { ProductImage } from '../../src/index.ts';
import { makeProduct } from '../factories.ts';

function images(count: number): ProductImage[] {
  return Array.from({ length: count }, (_, index) => ({
    url: `https://cdn.test/${index + 1}.jpg`,
    altText: `görsel ${index + 1}`,
  }));
}

function check(count: number) {
  return imageCountLowRule.check({ product: makeProduct({ images: images(count) }), listings: [] });
}

describe('IMAGE_COUNT_LOW', () => {
  it('geçen durum: tam alt sınır görsel sayısı yeterlidir', () => {
    expect(check(IMAGE_MIN_COUNT)).toEqual([]);
  });

  it('geçen durum: alt sınırın üstündeki görsel sayısı kabul edilir', () => {
    expect(check(5)).toEqual([]);
  });

  it('kalan sınır: alt sınırın bir altı (2 görsel) bulgu üretir', () => {
    const findings = check(IMAGE_MIN_COUNT - 1);
    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding?.ruleId).toBe('IMAGE_COUNT_LOW');
    expect(finding?.severity).toBe('major');
    expect(finding?.field).toBe('images');
    expect(finding?.message).toContain('2 görsel');
    expect(finding?.evidence).toBe('2 görsel');
  });

  it('kalan durum: görsel yoksa kanıt "<görsel yok>" olur', () => {
    const findings = check(0);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('0 görsel');
    expect(findings[0]?.evidence).toBe('<görsel yok>');
  });
});

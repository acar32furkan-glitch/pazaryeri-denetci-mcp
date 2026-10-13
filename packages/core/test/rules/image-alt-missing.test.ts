import { describe, expect, it } from 'vitest';

import { imageAltMissingRule } from '../../src/index.ts';
import { makeProduct } from '../factories.ts';

function check(alts: readonly (string | null)[]) {
  return imageAltMissingRule.check({
    product: makeProduct({
      images: alts.map((altText, index) => ({ url: `https://cdn.test/${index + 1}.jpg`, altText })),
    }),
    listings: [],
  });
}

describe('IMAGE_ALT_MISSING', () => {
  it('geçen durum: tüm alt metinler doluysa bulgu üretmez', () => {
    expect(check(['a', 'b', 'c'])).toEqual([]);
  });

  it('kalan durum: tek görselde alt metin yok', () => {
    const findings = check(['a', null, 'c']);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('minor');
    expect(findings[0]?.field).toBe('images');
    expect(findings[0]?.message).toBe('1/3 görselin alt metni yok.');
    expect(findings[0]?.evidence).toBe('https://cdn.test/2.jpg');
  });

  it('birden çok eksik olsa da ürün başına tek bulgu üretir', () => {
    const findings = check([null, null, 'c']);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toBe('2/3 görselin alt metni yok.');
    expect(findings[0]?.evidence).toBe('https://cdn.test/1.jpg');
  });

  it('boşluktan oluşan alt metin eksik sayılır', () => {
    expect(check(['   ', 'b'])).toHaveLength(1);
  });

  it('görsel listesi boşsa bulgu üretmez (sayım kuralı IMAGE_COUNT_LOW ile ayrı denetlenir)', () => {
    expect(check([])).toEqual([]);
  });
});

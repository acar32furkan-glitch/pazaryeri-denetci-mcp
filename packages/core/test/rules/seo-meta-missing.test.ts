import { describe, expect, it } from 'vitest';

import { seoMetaMissingRule } from '../../src/index.ts';
import { makeProduct } from '../factories.ts';

function check(seoTitle: string | null, seoDescription: string | null) {
  return seoMetaMissingRule.check({
    product: makeProduct({ seo: { title: seoTitle, description: seoDescription } }),
    listings: [],
  });
}

describe('SEO_META_MISSING', () => {
  it('geçen durum: ikisi de doluysa bulgu üretmez', () => {
    expect(check('SEO başlık', 'SEO açıklama')).toEqual([]);
  });

  it('kalan durum: ikisi de yoksa ürün başına TEK bulgu üretir', () => {
    const findings = check(null, null);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('major');
    expect(findings[0]?.field).toBe('seo');
    expect(findings[0]?.message).toContain('SEO başlığı ve SEO açıklaması');
    expect(findings[0]?.evidence).toBe('<ikisi de yok>');
  });

  it('kalan durum: yalnızca başlık yok', () => {
    const findings = check(null, 'SEO açıklama');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('SEO başlığı');
    expect(findings[0]?.message).not.toContain('açıklaması.');
  });

  it('kalan durum: yalnızca açıklama yok', () => {
    const findings = check('SEO başlık', null);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('SEO açıklaması');
  });

  it('boşluktan oluşan değer "yok" sayılır', () => {
    expect(check('   ', 'SEO açıklama')).toHaveLength(1);
    expect(check('SEO başlık', '  ')).toHaveLength(1);
  });
});

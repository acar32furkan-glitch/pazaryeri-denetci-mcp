import { describe, expect, it } from 'vitest';

import { descMissingRule } from '../../src/index.ts';
import { makeProduct } from '../factories.ts';

function check(descriptionHtml: string) {
  return descMissingRule.check({ product: makeProduct({ descriptionHtml }), listings: [] });
}

describe('DESC_MISSING', () => {
  it('geçen durum: dolu açıklamada bulgu üretmez', () => {
    expect(check('<p>Ürün açıklaması burada.</p>')).toEqual([]);
  });

  it('geçen durum: yalnızca metin (HTML yok)', () => {
    expect(check('Düz metin açıklama')).toEqual([]);
  });

  it('kalan durum: tamamen boş açıklama', () => {
    const findings = check('');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('DESC_MISSING');
    expect(findings[0]?.severity).toBe('critical');
    expect(findings[0]?.field).toBe('descriptionHtml');
    expect(findings[0]?.evidence).toBe('<boş>');
  });

  it('kalan durum: "dolu görünen boş" açıklama (&nbsp;)', () => {
    const findings = check('<p>&nbsp;</p>');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.evidence).toContain('&nbsp;');
  });

  it('kalan durum: yalnızca boş etiketler', () => {
    expect(check('<div><span></span></div>')).toHaveLength(1);
  });

  it('kalan durum: yalnızca boşluk karakterleri', () => {
    expect(check('   \n  ')).toHaveLength(1);
  });
});

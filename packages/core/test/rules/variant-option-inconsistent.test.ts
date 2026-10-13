import { describe, expect, it } from 'vitest';

import { SIZE_ORDER, variantOptionInconsistentRule } from '../../src/index.ts';
import type { Variant } from '../../src/index.ts';
import { makeProduct, makeVariant } from '../factories.ts';

function check(variants: Variant[]) {
  return variantOptionInconsistentRule.check({ product: makeProduct({ variants }), listings: [] });
}

describe('VARIANT_OPTION_INCONSISTENT', () => {
  it('geçen durum: kanonik ve sıralı bedenlerde bulgu üretmez', () => {
    const findings = check([
      makeVariant({
        options: [
          { name: 'Beden', value: 'XS' },
          { name: 'Renk', value: 'Gri' },
        ],
      }),
      makeVariant({
        options: [
          { name: 'Beden', value: 'S' },
          { name: 'Renk', value: 'Gri' },
        ],
      }),
    ]);
    expect(findings).toEqual([]);
  });

  it('geçen durum: SIZE_ORDER referansı beklenen sıradadır', () => {
    expect(SIZE_ORDER.indexOf('XS')).toBeLessThan(SIZE_ORDER.indexOf('XXL'));
  });

  it('kalan durum: yalnızca harf/boşluk farkıyla ayrışan değerler', () => {
    const findings = check([
      makeVariant({
        options: [
          { name: 'Renk', value: 'Kırmızı' },
          { name: 'Beden', value: 'M' },
        ],
      }),
      makeVariant({
        options: [
          { name: 'Renk', value: 'kırmızı' },
          { name: 'Beden', value: 'L' },
        ],
      }),
    ]);
    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding?.ruleId).toBe('VARIANT_OPTION_INCONSISTENT');
    expect(finding?.severity).toBe('major');
    expect(finding?.field).toBe('variants[].options');
    expect(finding?.message).toContain('harf/boşluk farkı');
  });

  it('kalan durum: aynı seçenek kombinasyonuna sahip iki varyant', () => {
    const options = [
      { name: 'Renk', value: 'Kırmızı' },
      { name: 'Beden', value: 'M' },
    ];
    const findings = check([makeVariant({ options }), makeVariant({ options })]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('aynı seçenek kombinasyonunda');
  });

  it('kalan durum: bozuk beden sıralaması (M → S)', () => {
    const findings = check([
      makeVariant({ options: [{ name: 'Beden', value: 'M' }] }),
      makeVariant({ options: [{ name: 'Beden', value: 'S' }] }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('beden sıralaması bozuk');
    expect(findings[0]?.message).toContain('M → S');
  });
});

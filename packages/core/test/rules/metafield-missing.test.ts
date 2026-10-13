import { describe, expect, it } from 'vitest';

import { METAFIELD_NAMESPACE, REQUIRED_METAFIELDS, metafieldMissingRule } from '../../src/index.ts';
import type { Metafield, Product } from '../../src/index.ts';
import { makeProduct } from '../factories.ts';

function makeMetafields(
  values: Readonly<Partial<Record<string, string>>>,
  namespace: string = METAFIELD_NAMESPACE,
): Metafield[] {
  return REQUIRED_METAFIELDS.flatMap((required) => {
    const value = values[required.key];
    if (value === undefined) return [];
    return [{ namespace, key: required.key, type: 'single_line_text_field', value }];
  });
}

const VALID_VALUES: Readonly<Record<string, string>> = {
  yas_grubu: 'Yetişkin',
  materyal: 'Yün',
  renk: 'Gri',
};

function check(overrides: Partial<Product>) {
  return metafieldMissingRule.check({ product: makeProduct(overrides), listings: [] });
}

describe('METAFIELD_MISSING', () => {
  it('geçen durum: üç zorunlu alan izin verilen değerlerde', () => {
    expect(check({ metafields: makeMetafields(VALID_VALUES) })).toEqual([]);
  });

  it('kalan durum: renk metafield eksikse bulgu üretir', () => {
    const findings = check({
      metafields: makeMetafields({ yas_grubu: 'Yetişkin', materyal: 'Yün' }),
    });
    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding?.ruleId).toBe('METAFIELD_MISSING');
    expect(finding?.severity).toBe('major');
    expect(finding?.field).toBe(`metafields[${METAFIELD_NAMESPACE}]`);
    expect(finding?.message).toContain('renk eksik');
  });

  it('kalan durum: izin verilmeyen değer bulgu üretir', () => {
    const findings = check({
      metafields: makeMetafields({ ...VALID_VALUES, yas_grubu: 'Bilinmeyen' }),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('izin verilmeyen değerde ("Bilinmeyen")');
  });

  it('kalan durum: boş değer eksik sayılır', () => {
    const findings = check({ metafields: makeMetafields({ ...VALID_VALUES, renk: '' }) });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('renk eksik');
  });

  it('kalan durum: yanlış namespace eksik sayılır', () => {
    const findings = check({ metafields: makeMetafields(VALID_VALUES, 'baska-namespace') });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('yaş grubu eksik');
    expect(findings[0]?.message).toContain('materyal eksik');
    expect(findings[0]?.message).toContain('renk eksik');
  });
});

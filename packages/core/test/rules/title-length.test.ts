import { describe, expect, it } from 'vitest';

import { TITLE_MAX_LENGTH, TITLE_MIN_LENGTH, titleLengthRule } from '../../src/index.ts';
import { makeProduct } from '../factories.ts';

function check(title: string) {
  return titleLengthRule.check({ product: makeProduct({ title }), listings: [] });
}

describe('TITLE_LENGTH', () => {
  it('geçen durum: normal uzunluktaki başlıkta bulgu üretmez', () => {
    expect(check('Antrasit Yün Kazak Kadın Giyim')).toEqual([]);
  });

  it('geçen sınır: tam alt sınır uzunluğu kabul edilir', () => {
    expect(check('a'.repeat(TITLE_MIN_LENGTH))).toEqual([]);
  });

  it('geçen sınır: tam üst sınır uzunluğu kabul edilir', () => {
    expect(check('a'.repeat(TITLE_MAX_LENGTH))).toEqual([]);
  });

  it('kalan durum: çok kısa başlık', () => {
    const findings = check('Kazak');
    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding?.ruleId).toBe('TITLE_LENGTH');
    expect(finding?.severity).toBe('major');
    expect(finding?.field).toBe('title');
    expect(finding?.variantSku).toBeNull();
    expect(finding?.message).toContain('çok kısa');
    expect(finding?.message).toContain('5 karakter');
  });

  it('kalan sınır: alt sınırın bir karakter altı', () => {
    const findings = check('a'.repeat(TITLE_MIN_LENGTH - 1));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('çok kısa');
  });

  it('kalan sınır: üst sınırın bir karakter üstü', () => {
    const findings = check('a'.repeat(TITLE_MAX_LENGTH + 1));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('çok uzun');
  });

  it('başlık yalnızca boşluktan oluşuyorsa eksik sayılır', () => {
    const findings = check('   ');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.evidence).toBe('<boş>');
  });

  it('kanıt metnini 120 karaktere kısaltır (log/rapor şişmesin)', () => {
    const findings = check('x'.repeat(300));
    const evidence = findings[0]?.evidence ?? '';
    expect(evidence.length).toBeLessThanOrEqual(120);
  });

  it('kural meta bilgisi tutarlıdır', () => {
    expect(titleLengthRule.id).toBe('TITLE_LENGTH');
    expect(titleLengthRule.appliesTo).toContain('merchant-center');
    expect(titleLengthRule.title.length).toBeGreaterThan(0);
  });
});

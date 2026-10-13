import { describe, expect, it } from 'vitest';

import { DESC_MIN_LENGTH, descTooShortRule } from '../../src/index.ts';
import { makeProduct } from '../factories.ts';

function check(descriptionHtml: string) {
  return descTooShortRule.check({ product: makeProduct({ descriptionHtml }), listings: [] });
}

describe('DESC_TOO_SHORT', () => {
  it('geçen durum: yeterince uzun açıklamada bulgu üretmez', () => {
    expect(check(`<p>${'a'.repeat(200)}</p>`)).toEqual([]);
  });

  it('geçen sınır: tam DESC_MIN_LENGTH karakterlik düz metin kabul edilir', () => {
    expect(check('a'.repeat(DESC_MIN_LENGTH))).toEqual([]);
  });

  it('geçen sınır: HTML etiketleri uzunluğa sayılmaz', () => {
    expect(check(`<p>${'a'.repeat(DESC_MIN_LENGTH)}</p>`)).toEqual([]);
  });

  it('kalan sınır: bir karakter altı bulgu üretir', () => {
    const findings = check('a'.repeat(DESC_MIN_LENGTH - 1));
    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding?.ruleId).toBe('DESC_TOO_SHORT');
    expect(finding?.severity).toBe('major');
    expect(finding?.field).toBe('descriptionHtml');
    expect(finding?.message).toContain('çok kısa');
    expect(finding?.message).toContain(`${DESC_MIN_LENGTH - 1} karakter`);
  });

  it('kalan sınır: HTML etiketli metin sınırın altındaysa bulgu üretir', () => {
    const findings = check(`<p>${'a'.repeat(DESC_MIN_LENGTH - 1)}</p>`);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('çok kısa');
  });

  it('boş açıklama bu kuralın konusu değildir (sahibi: DESC_MISSING)', () => {
    expect(check('')).toEqual([]);
  });
});

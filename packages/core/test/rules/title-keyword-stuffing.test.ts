import { describe, expect, it } from 'vitest';

import {
  TITLE_MAX_SEPARATORS,
  TITLE_MAX_WORDS,
  titleKeywordStuffingRule,
} from '../../src/index.ts';
import { makeProduct } from '../factories.ts';

function check(title: string) {
  return titleKeywordStuffingRule.check({ product: makeProduct({ title }), listings: [] });
}

describe('TITLE_KEYWORD_STUFFING', () => {
  it('geçen durum: normal başlıkta bulgu üretmez', () => {
    expect(check('Antrasit Yün Kazak Kadın Giyim')).toEqual([]);
  });

  it('kalan durum: aynı kelimenin sürekli tekrarı', () => {
    const findings = check('kazak kazak kazak');
    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding?.ruleId).toBe('TITLE_KEYWORD_STUFFING');
    expect(finding?.severity).toBe('major');
    expect(finding?.field).toBe('title');
    expect(finding?.variantSku).toBeNull();
    expect(finding?.message).toContain('tekrar eden kelime');
    expect(finding?.message).toContain('kazak×3');
  });

  it('geçen sınır: tekrar eşiğinin bir altında bulgu üretmez', () => {
    expect(check('kazak kazak yün hırka')).toEqual([]);
  });

  it('kalan sınır: kelime sayısı üst sınırı bir kelime aşınca bulgu üretir', () => {
    const words = Array.from({ length: TITLE_MAX_WORDS + 1 }, (_, index) => `urun${index}`);
    const findings = check(words.join(' '));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain(`${TITLE_MAX_WORDS + 1} kelime`);
  });

  it('geçen sınır: tam üst sınır kelime sayısı kabul edilir', () => {
    const words = Array.from({ length: TITLE_MAX_WORDS }, (_, index) => `urun${index}`);
    expect(check(words.join(' '))).toEqual([]);
  });

  it('geçen sınır: ayraç sayısı üst sınırın bir altındaysa bulgu üretmez', () => {
    const words = ['Kazak', 'Giyim', 'Kadın', 'Yün', 'Antrasit'].slice(0, TITLE_MAX_SEPARATORS);
    expect(check(words.join(' | '))).toEqual([]);
  });

  it('kalan sınır: ayraç yığını üst sınıra ulaşınca bulgu üretir', () => {
    const words = ['Kazak', 'Giyim', 'Kadın', 'Yün', 'Antrasit'].slice(0, TITLE_MAX_SEPARATORS + 1);
    const findings = check(words.join(' | '));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('ayraç');
  });
});

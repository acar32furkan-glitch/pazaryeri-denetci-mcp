import { describe, expect, it } from 'vitest';

import {
  COMBINING_DOT,
  findMojibake,
  localeSensitiveWords,
  trTextQualityRule,
} from '../../src/index.ts';
import type { Product } from '../../src/index.ts';
import { makeProduct } from '../factories.ts';

function check(overrides: Partial<Product>) {
  return trTextQualityRule.check({ product: makeProduct(overrides), listings: [] });
}

describe('TR_TEXT_QUALITY', () => {
  it('geçen durum: temiz Türkçe metinde bulgu üretmez', () => {
    expect(
      check({
        title: 'Antrasit Yün Kazak Kadın Giyim',
        descriptionHtml: '<p>Yumuşak yün kazak; günlük kullanım için uygundur.</p>',
      }),
    ).toEqual([]);
  });

  it('kalan durum: açıklamada kodlama bozulması', () => {
    const findings = check({ descriptionHtml: '<p>Ã¼rÃ¼n açıklaması</p>' });
    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding?.ruleId).toBe('TR_TEXT_QUALITY');
    expect(finding?.severity).toBe('major');
    expect(finding?.field).toBe('descriptionHtml');
    expect(finding?.message).toContain('kodlama bozulması');
  });

  it('kalan durum: handle içinde birleşik nokta (U+0307)', () => {
    const findings = check({ handle: `urun-adi${COMBINING_DOT}-indirim` });
    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding?.field).toBe('handle');
    expect(finding?.message).toContain('birleşik nokta (U+0307)');
  });

  it('localeSensitiveWords: varsayılan yerelde bozulan kelimeyi bulur', () => {
    const words = localeSensitiveWords('İNDİRİMLİ');
    expect(words.length).toBeGreaterThan(0);
    expect(words).toContain('İNDİRİMLİ');
  });

  it('findMojibake: temiz metinde null döner', () => {
    expect(findMojibake('temiz metin')).toBeNull();
  });

  it('findMojibake: bozuk metinde bağlam dilimini döner', () => {
    expect(findMojibake('Ã¼rÃ¼n')).not.toBeNull();
  });
});

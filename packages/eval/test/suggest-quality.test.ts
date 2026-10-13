import { describe, expect, it } from 'vitest';

import { auditCatalog } from '@pazaryeri-denetci/core';
import { generateCleanCatalog } from '@pazaryeri-denetci/mock-data';
import { createMockClient, createSuggester } from '@pazaryeri-denetci/suggest';

import { DEFAULT_EVAL_CONFIG } from '../src/harness.ts';
import { DEFAULT_THRESHOLDS, checkSuggestThreshold } from '../src/thresholds.ts';
import { runSuggestQuality } from '../src/suggest-quality.ts';

import type { LlmCompletionInput } from '@pazaryeri-denetci/suggest';
import type { SuggestQualityReport } from '../src/suggest-quality.ts';

/**
 * Bilinen/hazırlanmış küçük hata seti: 3 ürün, her birine tek düzeltilebilir hata yazılır ve
 * sahte istemci kasten bir alanda kuralı geçmeyen öneri döner. Beklenen oran buradan gelir.
 */
async function preparedSet(): Promise<SuggestQualityReport> {
  const catalog = generateCleanCatalog({ seed: 1, productCount: 3 });
  const [first, second, third] = catalog.products;
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error('Hazırlık: 3 ürün bekleniyordu.');
  }
  first.title = 'Kazak'; // TITLE_LENGTH (çok kısa)
  second.descriptionHtml = ''; // DESC_MISSING
  third.seo = { title: null, description: null }; // SEO_META_MISSING
  const findings = auditCatalog(catalog).findings;

  // İstemci ürün kimliğine göre yanıt verir: title → geçen, description → KISA (kalan), seo → geçen.
  const respond = (input: LlmCompletionInput): string => {
    const id = /"id":"([^"]+)"/u.exec(input.user)?.[1] ?? '';
    if (id === 'snt-prd-0001') {
      return JSON.stringify({
        title: 'Kırmızı Pamuk Kazak Kadın Giyim',
        rationale: 'başlık uzatıldı',
        confidence: 'high',
      });
    }
    if (id === 'snt-prd-0002') {
      return JSON.stringify({
        descriptionHtml: '<p>Kısa.</p>',
        rationale: 'kısa kaldı',
        confidence: 'low',
      });
    }
    return JSON.stringify({
      seoTitle: 'Kırmızı Pamuk Kazak Kadın Giyim',
      seoDescription: 'Kırmızı pamuk kazak, günlük kullanım için uygun sentetik ürün.',
      rationale: 'SEO alanları dolduruldu',
      confidence: 'medium',
    });
  };

  return runSuggestQuality(DEFAULT_EVAL_CONFIG, {
    catalog,
    findings,
    model: 'mock-test',
    suggester: createSuggester({ client: createMockClient({ model: 'mock-test', respond }) }),
  });
}

describe('öneri kalite kontrolü (mock istemci — harness doğrulaması)', () => {
  it('hazırlanmış küçük hata setinde beklenen alan/geçme oranını üretir', async () => {
    const quality = await preparedSet();

    expect(quality.mode).toBe('mock');
    expect(quality.consideredProducts).toBe(3);
    expect(quality.requests).toBe(3);
    expect(quality.suggestions).toBe(3);
    expect(quality.unavailable).toBe(0);

    const byField = new Map(quality.fields.map((entry) => [entry.field, entry]));
    expect(byField.get('title')).toMatchObject({
      expected: 1,
      produced: 1,
      passed: 1,
      passRate: 1,
    });
    expect(byField.get('descriptionHtml')).toMatchObject({
      expected: 1,
      produced: 1,
      passed: 0,
      passRate: 0,
    });
    expect(byField.get('seoTitle')).toMatchObject({ expected: 1, produced: 1, passed: 1 });
    expect(byField.get('seoDescription')).toMatchObject({ expected: 1, produced: 1, passed: 1 });

    expect(quality.expected).toBe(4);
    expect(quality.produced).toBe(4);
    expect(quality.passed).toBe(3);
    expect(quality.passRate).toBeCloseTo(0.75, 10);

    expect(quality.failures).toHaveLength(1);
    expect(quality.failures[0]).toMatchObject({
      productId: 'snt-prd-0002',
      field: 'descriptionHtml',
      produced: true,
    });
    expect(quality.failures[0]?.remainingRuleIds).toContain('DESC_TOO_SHORT');

    // Önbellek açık: aynı istek ikinci kez LLM'e gitmez.
    expect(quality.cacheHitOnRepeat).toBe(true);
    expect(quality.cacheHits).toBeGreaterThanOrEqual(1);
  });

  it('demo mock istemcisiyle tam katalogda taban çizgiyi üretir (canlı model değil)', async () => {
    const quality = await runSuggestQuality(DEFAULT_EVAL_CONFIG);

    expect(quality.model).toBe('mock-demo');
    expect(quality.consideredProducts).toBe(140);
    expect(quality.requests).toBe(140);
    expect(quality.suggestions).toBe(140);
    expect(quality.unavailable).toBe(0);
    expect(quality.expected).toBe(160);
    expect(quality.produced).toBe(160);
    expect(quality.passed).toBe(160);
    expect(quality.passRate).toBeCloseTo(1, 10);

    const byField = new Map(quality.fields.map((entry) => [entry.field, entry]));
    expect(byField.get('title')).toMatchObject({ expected: 60, produced: 60, passed: 60 });
    expect(byField.get('descriptionHtml')).toMatchObject({
      expected: 60,
      produced: 60,
      passed: 60,
    });
    expect(byField.get('seoTitle')).toMatchObject({ expected: 20, produced: 20, passed: 20 });
    expect(byField.get('seoDescription')).toMatchObject({ expected: 20, produced: 20, passed: 20 });

    // Demo mock istemci kurallara uyan metin üretmek zorunda: kalan bulgu yok.
    expect(quality.failures).toHaveLength(0);
  });

  it('eşik: taban çizgide geçer, oranın altına düşünce ihlal üretir', async () => {
    const quality = await runSuggestQuality(DEFAULT_EVAL_CONFIG);

    expect(checkSuggestThreshold(quality, DEFAULT_THRESHOLDS)).toHaveLength(0);

    // Gerçek koşuda %100; ihlal yolunu sınamak için oran düşürülmüş bir kopya kullanılır.
    const strict = checkSuggestThreshold(
      { ...quality, passRate: 0.9 },
      { ...DEFAULT_THRESHOLDS, minSuggestPassRate: 1 },
    );
    expect(strict).toHaveLength(1);
    expect(strict[0]).toContain('ÖNERİ KALİTESİ');
  });
});

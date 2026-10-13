import type { Rule } from '../rule.ts';

/**
 * IMAGE_COUNT_LOW — ürün görseli sayısı yetersiz.
 *
 * Alt metin kontrolü ayrı kuraldır (IMAGE_ALT_MISSING); bu kural yalnızca **sayıya** bakar.
 */
export const IMAGE_MIN_COUNT = 3;

export const imageCountLowRule: Rule = {
  id: 'IMAGE_COUNT_LOW',
  severity: 'major',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'Görsel sayısı yetersiz',
  description: `Ürünün en az ${IMAGE_MIN_COUNT} görseli olmalı.`,
  check({ product }) {
    const count = product.images.length;
    if (count >= IMAGE_MIN_COUNT) return [];

    return [
      {
        ruleId: 'IMAGE_COUNT_LOW',
        severity: 'major',
        productId: product.id,
        variantSku: null,
        field: 'images',
        message: `Yalnızca ${count} görsel var (en az ${IMAGE_MIN_COUNT} olmalı).`,
        fixHint:
          'Önden, arkadan, detay ve ölçek görsellerini ekleyin; pazaryerleri eksik görselli listeleri sıralamada geriye atar.',
        evidence: count === 0 ? '<görsel yok>' : `${count} görsel`,
      },
    ];
  },
};

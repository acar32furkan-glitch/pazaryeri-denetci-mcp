import type { Rule } from '../rule.ts';

/**
 * IMAGE_ALT_MISSING — görsellerde alt metin yok.
 *
 * Ürün başına tek bulgu: kaç görselin alt metni eksik olduğunu sayar.
 */
export const imageAltMissingRule: Rule = {
  id: 'IMAGE_ALT_MISSING',
  severity: 'minor',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'Görsel alt metni eksik',
  description: 'Bir veya daha fazla ürün görselinin alt metni (altText) tanımlı değil.',
  check({ product }) {
    const missingAlt = product.images.filter(
      (image) => image.altText === null || image.altText.trim() === '',
    );
    if (missingAlt.length === 0) return [];

    const firstMissing = missingAlt[0];
    return [
      {
        ruleId: 'IMAGE_ALT_MISSING',
        severity: 'minor',
        productId: product.id,
        variantSku: null,
        field: 'images',
        message: `${missingAlt.length}/${product.images.length} görselin alt metni yok.`,
        fixHint:
          'Her görsele ürün adını ve görselin ne gösterdiğini anlatan kısa bir alt metin yazın.',
        evidence: firstMissing === undefined ? null : firstMissing.url,
      },
    ];
  },
};

import { plainTextLength } from '../html.ts';
import { truncateEvidence } from '../rule.ts';
import type { Rule } from '../rule.ts';

/**
 * DESC_TOO_SHORT — açıklama var ama anlamlı içerik için çok kısa.
 *
 * DESC_MISSING ile çakışmaz: bu kural yalnızca **dolu ama kısa** metni işaretler, böylece aynı
 * ürün için iki kural birden bağırmaz.
 */
export const DESC_MIN_LENGTH = 120;

export const descTooShortRule: Rule = {
  id: 'DESC_TOO_SHORT',
  severity: 'major',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'Açıklama çok kısa',
  description: `Ürün açıklaması ${DESC_MIN_LENGTH} karakterden kısa (boş değil).`,
  check({ product }) {
    const length = plainTextLength(product.descriptionHtml);
    if (length === 0 || length >= DESC_MIN_LENGTH) return [];

    return [
      {
        ruleId: 'DESC_TOO_SHORT',
        severity: 'major',
        productId: product.id,
        variantSku: null,
        field: 'descriptionHtml',
        message: `Açıklama çok kısa: ${length} karakter (en az ${DESC_MIN_LENGTH} önerilir).`,
        fixHint:
          'Materyal, ölçü, bakım ve kullanım bilgisi ekleyerek açıklamayı en az 2 paragrafa çıkarın.',
        evidence: truncateEvidence(product.descriptionHtml),
      },
    ];
  },
};

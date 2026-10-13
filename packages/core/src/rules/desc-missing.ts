import { plainTextLength } from '../html.ts';
import { truncateEvidence } from '../rule.ts';
import type { Rule } from '../rule.ts';

/**
 * DESC_MISSING — açıklama yok veya yalnızca boş biçimlendirme etiketlerinden oluşuyor.
 *
 * `<p>&nbsp;</p>` gibi "dolu görünen boş" açıklamalar da bu kurala girer.
 */
export const descMissingRule: Rule = {
  id: 'DESC_MISSING',
  severity: 'critical',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'Açıklama eksik',
  description: 'Ürün açıklaması boş veya yalnızca boşluk/etiket içeriyor; metin çıkmıyor.',
  check({ product }) {
    if (plainTextLength(product.descriptionHtml) > 0) return [];

    return [
      {
        ruleId: 'DESC_MISSING',
        severity: 'critical',
        productId: product.id,
        variantSku: null,
        field: 'descriptionHtml',
        message: 'Ürün açıklaması boş; pazaryeri ve Merchant Center bu ürünü reddedebilir.',
        fixHint:
          'En az 2 paragraf açıklama yazın: ürünün ne olduğu, materyali, ölçüleri ve bakım bilgisi.',
        evidence:
          product.descriptionHtml.length === 0
            ? '<boş>'
            : truncateEvidence(`ham HTML: ${product.descriptionHtml}`),
      },
    ];
  },
};

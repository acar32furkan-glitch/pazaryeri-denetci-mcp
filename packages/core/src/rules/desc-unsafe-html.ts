import { truncateEvidence } from '../rule.ts';
import { containsUnsafeHtml } from '../sanitize.ts';
import type { Rule } from '../rule.ts';

/**
 * DESC_UNSAFE_HTML — açıklamada çalıştırılabilir içerik var.
 *
 * Vitrin, pazaryeri iframe'i veya e-posta şablonu bu içeriği render ederse XSS'e dönüşür.
 * Kural yalnızca **tespit eder**; temizleme işini `sanitizeHtml` yapar (salt-okunur ilkesi).
 */
export const descUnsafeHtmlRule: Rule = {
  id: 'DESC_UNSAFE_HTML',
  severity: 'critical',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'Açıklamada tehlikeli HTML',
  description:
    'Açıklama <script> benzeri tehlikeli etiket, satır içi olay işleyicisi (onclick vb.) veya javascript: bağlantısı içeriyor.',
  check({ product }) {
    const fields: readonly [string, string][] = [
      ['descriptionHtml', product.descriptionHtml],
      ['seo.title', product.seo.title ?? ''],
      ['seo.description', product.seo.description ?? ''],
      ['title', product.title],
    ];
    for (const [field, value] of fields) {
      if (!containsUnsafeHtml(value)) continue;
      return [
        {
          ruleId: 'DESC_UNSAFE_HTML',
          severity: 'critical',
          productId: product.id,
          variantSku: null,
          field,
          message: `${field} alanında çalıştırılabilir içerik var; vitrinde XSS riski oluşturur.`,
          fixHint:
            'Etiketi ve olay işleyicisini kaldırın; yalnızca <p>, <ul>, <li>, <strong>, <em> gibi biçimlendirme etiketleri kalsın.',
          evidence: truncateEvidence(value),
        },
      ];
    }
    return [];
  },
};

import type { Rule } from '../rule.ts';

function missing(value: string | null): boolean {
  return value === null || value.trim() === '';
}

/**
 * SEO_META_MISSING — arama motoru başlığı/açıklaması yok.
 *
 * Ürün başına **tek** bulgu üretir (hangi alanların eksik olduğunu mesajda sayar): aynı ürün için
 * birden çok satır üretmek raporu şişirir ve eval'de yapay yanlış pozitif yaratır.
 */
export const seoMetaMissingRule: Rule = {
  id: 'SEO_META_MISSING',
  severity: 'major',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'SEO meta eksik',
  description: 'Ürünün SEO başlığı ve/veya SEO açıklaması tanımlı değil.',
  check({ product }) {
    const titleMissing = missing(product.seo.title);
    const descriptionMissing = missing(product.seo.description);
    if (!titleMissing && !descriptionMissing) return [];

    const missingParts: string[] = [];
    if (titleMissing) missingParts.push('SEO başlığı');
    if (descriptionMissing) missingParts.push('SEO açıklaması');
    const foundParts: string[] = [];
    if (!titleMissing) foundParts.push('başlık var, açıklama yok');
    if (!descriptionMissing) foundParts.push('açıklama var, başlık yok');

    return [
      {
        ruleId: 'SEO_META_MISSING',
        severity: 'major',
        productId: product.id,
        variantSku: null,
        field: 'seo',
        message: `Eksik: ${missingParts.join(' ve ')}.`,
        fixHint:
          'SEO başlığını 50-60, SEO açıklamasını 140-160 karakter olacak şekilde ürün başlığından türetin.',
        evidence: foundParts.length > 0 ? foundParts.join('; ') : '<ikisi de yok>',
      },
    ];
  },
};

import type { Rule } from '../rule.ts';
import type { Finding } from '../types.ts';

/**
 * SKU_MISSING — varyantta SKU yok.
 *
 * Varyant başına bir bulgu üretir; `variantSku` alanı eksik olduğu için `null` kalır ve hangi
 * varyantın sorunlu olduğu `field` (ör. `variants[1].sku`) ile belirtilir.
 */
export const skuMissingRule: Rule = {
  id: 'SKU_MISSING',
  severity: 'critical',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'SKU eksik',
  description: 'Varyantın SKU değeri boş; kanallar arası eşleştirme ve stok takibi yapılamaz.',
  check({ product }) {
    const findings: Finding[] = [];
    for (const [index, variant] of product.variants.entries()) {
      if (variant.sku !== null && variant.sku.trim() !== '') continue;
      findings.push({
        ruleId: 'SKU_MISSING',
        severity: 'critical',
        productId: product.id,
        variantSku: null,
        field: `variants[${index}].sku`,
        message: `${index + 1}. varyantta SKU yok.`,
        fixHint: 'Her varyanta marka-içi benzersiz, boşluksuz bir SKU verin (ör. SNT-1001-M).',
        evidence: '<boş>',
      });
    }
    return findings;
  },
};

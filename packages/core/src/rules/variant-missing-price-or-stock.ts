import type { Finding } from '../types.ts';
import type { Rule } from '../rule.ts';

/**
 * VARIANT_MISSING_PRICE_OR_STOCK — varyantta fiyat veya stok yok/geçersiz.
 *
 * Varyant başına bir bulgu üretir: eksik fiyat, pazaryerine 0 TL olarak gider ve ürün
 * satılamaz hâle gelir.
 */
export const variantMissingPriceOrStockRule: Rule = {
  id: 'VARIANT_MISSING_PRICE_OR_STOCK',
  severity: 'critical',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'Varyantta fiyat/stok eksik',
  description: 'Varyantın fiyatı yok ya da pozitif değil, veya stok adedi yok ya da negatif.',
  check({ product }) {
    const findings: Finding[] = [];
    for (const [index, variant] of product.variants.entries()) {
      const problems: string[] = [];
      if (variant.price === null) {
        problems.push('fiyat tanımsız');
      } else if (variant.price <= 0) {
        problems.push(`fiyat geçersiz (${String(variant.price)})`);
      }
      if (variant.inventoryQuantity === null) {
        problems.push('stok adedi tanımsız');
      } else if (variant.inventoryQuantity < 0) {
        problems.push(`stok negatif (${String(variant.inventoryQuantity)})`);
      }
      if (problems.length === 0) continue;

      findings.push({
        ruleId: 'VARIANT_MISSING_PRICE_OR_STOCK',
        severity: 'critical',
        productId: product.id,
        variantSku: variant.sku,
        field: `variants[${index}]`,
        message: `${index + 1}. varyantta sorun: ${problems.join(', ')}.`,
        fixHint:
          'Her varyanta pozitif bir fiyat ve sıfır ya da pozitif stok adedi girin; stok bilinmiyorsa 0 yazıp "stokta yok" durumuna alın.',
        evidence: problems.join(', '),
      });
    }
    return findings;
  },
};

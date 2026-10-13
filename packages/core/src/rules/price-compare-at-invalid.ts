import type { Finding } from '../types.ts';
import type { Rule } from '../rule.ts';

/**
 * PRICE_COMPARE_AT_INVALID — karşılaştırma ("eski") fiyatı satış fiyatından düşük/eşit.
 *
 * Pazaryerleri bu durumda indirim oranını negatif hesaplar; vitrinde "0% indirim" ya da
 * yanıltıcı üstü çizili fiyat görünür.
 */
export const priceCompareAtInvalidRule: Rule = {
  id: 'PRICE_COMPARE_AT_INVALID',
  severity: 'major',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'Karşılaştırma fiyatı geçersiz',
  description: 'compareAtPrice tanımlı ama satış fiyatından küçük veya ona eşit.',
  check({ product }) {
    const findings: Finding[] = [];
    for (const [index, variant] of product.variants.entries()) {
      if (variant.compareAtPrice === null) continue;
      const price = variant.price;
      if (price !== null && variant.compareAtPrice > price) continue;

      findings.push({
        ruleId: 'PRICE_COMPARE_AT_INVALID',
        severity: 'major',
        productId: product.id,
        variantSku: variant.sku,
        field: `variants[${index}].compareAtPrice`,
        message:
          price === null
            ? `Karşılaştırma fiyatı (${String(variant.compareAtPrice)}) var ama satış fiyatı tanımsız.`
            : `Karşılaştırma fiyatı (${String(variant.compareAtPrice)}) satış fiyatından (${String(price)}) büyük değil.`,
        fixHint:
          'Karşılaştırma fiyatını satış fiyatının üzerine çıkarın ya da indirim yoksa alanı tamamen boş bırakın.',
        evidence: `compareAtPrice=${String(variant.compareAtPrice)} price=${String(price)}`,
      });
    }
    return findings;
  },
};

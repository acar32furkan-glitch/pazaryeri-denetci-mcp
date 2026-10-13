import type { Finding } from '../types.ts';
import type { Rule } from '../rule.ts';

/**
 * SKU_DUPLICATE — aynı SKU birden fazla varyantta veya üründe kullanılmış.
 *
 * Yalnızca **ilk sahibinden sonraki** kullanımlar işaretlenir: aksi hâlde tek bir çakışma iki
 * bulgu üretir, rapor şişer ve eval'de yapay yanlış pozitif oluşur. İlk sahip katalog sırasına
 * göre belirlenir (ürün içi tekrarda ilk varyant).
 */
export const skuDuplicateRule: Rule = {
  id: 'SKU_DUPLICATE',
  severity: 'major',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'SKU tekrarı',
  description: 'Aynı SKU değeri birden fazla varyantta ya da üründe geçiyor.',
  check({ product, index }) {
    const findings: Finding[] = [];
    const seenInProduct = new Map<string, number>();
    const skuOwners = index?.skuOwners;

    for (const [variantIndex, variant] of product.variants.entries()) {
      const sku = variant.sku?.trim() ?? '';
      if (sku === '') continue;

      const owners = skuOwners?.get(sku) ?? [];
      const firstOwner = owners[0];
      const repeatedInProduct = seenInProduct.has(sku);
      const ownedByAnotherProductFirst = firstOwner !== undefined && firstOwner !== product.id;

      if (repeatedInProduct || ownedByAnotherProductFirst) {
        const firstIndex = seenInProduct.get(sku);
        const where =
          firstIndex === undefined
            ? `"${sku}" SKU'su başka bir üründe (${String(firstOwner)}) de kullanılıyor`
            : `"${sku}" SKU'su bu ürünün ${String(firstIndex + 1)}. varyantında da var`;
        findings.push({
          ruleId: 'SKU_DUPLICATE',
          severity: 'major',
          productId: product.id,
          variantSku: sku,
          field: `variants[${variantIndex}].sku`,
          message: `${where}.`,
          fixHint:
            'SKU değerlerini marka-içi benzersiz tutun (ör. SNT-0104-M); aynı SKU iki kanalda farklı ürünü gösteriyorsa stok ve fiyat eşleşmesi bozulur.',
          evidence: sku,
        });
      }
      if (!seenInProduct.has(sku)) seenInProduct.set(sku, variantIndex);
    }

    return findings;
  },
};

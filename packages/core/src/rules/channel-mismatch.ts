import { truncateEvidence } from '../rule.ts';
import type { Finding } from '../types.ts';
import type { Rule, RuleContext } from '../rule.ts';

/**
 * CHANNEL_MISMATCH — aynı SKU'nun Shopify verisi ile kanal beslemesi uyuşmuyor.
 *
 * Fiyat karşılaştırması **kuruşa yuvarlanarak** yapılır: kayan nokta artıkları (199.90000000000003)
 * yanlış pozitif üretmesin.
 *
 * Kapsam sınırı: fiyatı/stoku tanımsız varyantlar burada değerlendirilmez — onların sahibi
 * VARIANT_MISSING_PRICE_OR_STOCK kuralıdır (aynı ürün için iki kural bağırmasın). Aynı şekilde
 * SKU'su tekrar eden varyantlar da atlanır: SKU tek bir varyantı işaret etmiyorsa "kanal verisi
 * şu varyantla uyuşmuyor" demek anlamsızdır ve o hatanın sahibi SKU_DUPLICATE kuralıdır.
 */
function toCents(value: number): number {
  return Math.round(value * 100);
}

/** Ürün içinde ya da katalogda birden çok kez geçen SKU'lar. */
function duplicatedSkus(
  product: RuleContext['product'],
  index: RuleContext['index'],
): ReadonlySet<string> {
  const duplicated = new Set<string>();
  const seen = new Set<string>();
  for (const variant of product.variants) {
    const sku = variant.sku?.trim() ?? '';
    if (sku === '') continue;
    if (seen.has(sku)) duplicated.add(sku);
    seen.add(sku);
  }
  const skuOwners = index?.skuOwners;
  if (skuOwners !== undefined) {
    for (const sku of seen) {
      if ((skuOwners.get(sku)?.length ?? 0) > 1) duplicated.add(sku);
    }
  }
  return duplicated;
}

export const channelMismatchRule: Rule = {
  id: 'CHANNEL_MISMATCH',
  severity: 'critical',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'Kanal uyuşmazlığı',
  description: 'Aynı SKU için kanal beslemesindeki fiyat veya stok, ürün verisiyle aynı değil.',
  check({ product, listings, index }) {
    const findings: Finding[] = [];
    const duplicated = duplicatedSkus(product, index);

    for (const [index0, variant] of product.variants.entries()) {
      const sku = variant.sku?.trim() ?? '';
      const price = variant.price;
      const stock = variant.inventoryQuantity;
      if (sku === '' || price === null || price <= 0 || stock === null || stock < 0) continue;
      if (duplicated.has(sku)) continue;

      const mismatches = listings
        .filter((listing) => (listing.sku?.trim() ?? '') === sku)
        .filter((listing) => {
          const priceDiffers = listing.price !== null && toCents(listing.price) !== toCents(price);
          const stockDiffers = listing.stock !== null && listing.stock !== stock;
          return priceDiffers || stockDiffers;
        });
      if (mismatches.length === 0) continue;

      const detail = mismatches
        .map(
          (listing) =>
            `${listing.channel}: fiyat ${String(listing.price ?? '—')} / stok ${String(listing.stock ?? '—')}`,
        )
        .join('; ');
      findings.push({
        ruleId: 'CHANNEL_MISMATCH',
        severity: 'critical',
        productId: product.id,
        variantSku: sku,
        field: `variants[${index0}].listings`,
        message: `${mismatches.length} kanalda uyuşmazlık (ürün: fiyat ${String(price)} / stok ${String(stock)}) → ${detail}.`,
        fixHint:
          'Beslemeyi tek kaynaktan üretin: fiyat ve stok ürün verisinden türetilsin; elle düzeltilen kanal verisi bir sonraki senkronda ezilir.',
        evidence: truncateEvidence(detail),
      });
    }

    return findings;
  },
};

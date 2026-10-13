import { checkGtin } from '../gtin.ts';
import type { Rule } from '../rule.ts';
import type { Finding } from '../types.ts';

/**
 * BARCODE_INVALID — GTIN/EAN barkodu yok, biçimi bozuk veya sağlama toplamı hatalı.
 *
 * Sağlama toplamı tek başına yetmez: 13 haneli ama son hanesi yanlış bir barkod, pazaryeri
 * tarafından sessizce reddedilir ve "ürün neden eşleşmiyor" sorusunun en sık nedenidir.
 */
export const barcodeInvalidRule: Rule = {
  id: 'BARCODE_INVALID',
  severity: 'critical',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'Barkod geçersiz',
  description:
    'Varyantın GTIN/EAN barkodu boş, rakam dışı karakter içeriyor veya sağlama toplamı hatalı.',
  check({ product }) {
    const findings: Finding[] = [];
    for (const [index, variant] of product.variants.entries()) {
      const result = checkGtin(variant.barcode);
      if (result.valid) continue;
      findings.push({
        ruleId: 'BARCODE_INVALID',
        severity: 'critical',
        productId: product.id,
        variantSku: variant.sku,
        field: `variants[${index}].barcode`,
        message: `Barkod geçersiz: ${result.reason ?? 'bilinmeyen neden'}.`,
        fixHint:
          'Ürünün gerçek GTIN barkodunu girin (8/12/13/14 hane, son hane sağlama basamağı) veya barkodu boş bırakıp "barkodsuz" olarak işaretleyin.',
        evidence: variant.barcode === null || variant.barcode === '' ? '<boş>' : variant.barcode,
      });
    }
    return findings;
  },
};

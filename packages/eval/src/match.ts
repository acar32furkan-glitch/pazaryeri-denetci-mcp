import type { Finding } from '@pazaryeri-denetci/core';
import type { InjectedDefect } from '@pazaryeri-denetci/mock-data';

/**
 * Eşleşme anahtarı: (beklenen kural, ürün, varyant SKU).
 *
 * Alan (`field`) bilinçli olarak anahtara dâhil edilmez: aynı kural aynı varyantta farklı
 * alanları işaret edebilir ve bu, kuralın hatayı bulup bulmadığını değiştirmez. Alan bilgisi
 * raporun "nerede" sütununda yaşar.
 */
const SEPARATOR = '\u0000';

export function defectKey(defect: InjectedDefect): string {
  return [defect.expectedRuleId, defect.productId, defect.variantSku ?? ''].join(SEPARATOR);
}

export function findingKey(finding: Finding): string {
  return [finding.ruleId, finding.productId, finding.variantSku ?? ''].join(SEPARATOR);
}

export function keyOf(ruleId: string, productId: string, variantSku: string | null): string {
  return [ruleId, productId, variantSku ?? ''].join(SEPARATOR);
}

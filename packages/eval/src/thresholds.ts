import { formatPercent } from './metrics.ts';

import type { EvalReport } from './metrics.ts';
import type { SuggestQualityReport } from './suggest-quality.ts';

/**
 * Eval eşikleri — CI kapısı.
 *
 * Şimdilik tam doğruluk isteniyor: sentetik veride etiketler bire bir eşleştiği için bu
 * ulaşılabilir bir hedeftir ve regresyonu en erken yakalayan ayardır. Eşik düşürülecekse
 * gerekçesi docs/DECISIONS.md'ye yazılmalıdır.
 *
 * `minSuggestPassRate` yalnızca **mock istemci** ile ölçülen öneri kalite kontrolü içindir
 * (bkz. `suggest-quality.ts`): canlı model ölçümü değildir. Değer, demo mock istemcisinin
 * ulaştığı taban çizgisidir; amaç bu çizginin altına düşen değişiklikleri (kural, prompt, şema,
 * alan eşlemesi) yakalamaktır. Mock istemci `fixTitle` tek kelimelik kısa başlıkları 15 karaktere
 * çıkaramadığı için başlık alanı %100 değildir; bu yüzden eşik %100 değildir.
 */
export interface Thresholds {
  readonly minPrecision: number;
  readonly minRecall: number;
  /** Mock istemciyle ölçülen öneri kalite kontrolünde genel geçme oranı alt sınırı. */
  readonly minSuggestPassRate: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  minPrecision: 1,
  minRecall: 1,
  // Demo mock istemci kurallara uyan metin üretmek zorunda; ölçülen değer %100 (160/160).
  // Eşik taban çizgiye sabit: hangi taraf bozulursa (kural ya da mock) CI kırılır — regresyon yakalama.
  minSuggestPassRate: 1,
};

export function checkThresholds(
  report: EvalReport,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): string[] {
  const violations: string[] = [];
  if (report.totals.precision < thresholds.minPrecision) {
    violations.push(
      `GENEL precision ${formatPercent(report.totals.precision)} < ${formatPercent(thresholds.minPrecision)}`,
    );
  }
  if (report.totals.recall < thresholds.minRecall) {
    violations.push(
      `GENEL recall ${formatPercent(report.totals.recall)} < ${formatPercent(thresholds.minRecall)}`,
    );
  }
  for (const rule of report.rules) {
    if (rule.precision < thresholds.minPrecision) {
      violations.push(
        `${rule.ruleId}: precision ${formatPercent(rule.precision)} < ${formatPercent(thresholds.minPrecision)}`,
      );
    }
    if (rule.recall < thresholds.minRecall) {
      violations.push(
        `${rule.ruleId}: recall ${formatPercent(rule.recall)} < ${formatPercent(thresholds.minRecall)}`,
      );
    }
  }
  return violations;
}

/**
 * Öneri kalite kontrolü eşiği (mock istemci). Genel geçme oranı alt sınıra düşerse ihlal üretir;
 * böylece `eval:check` CI'da regresyonu yakalar. Rapor, ölçülenin model kalitesi değil hat
 * doğrulaması olduğunu açıkça yazar.
 */
export function checkSuggestThreshold(
  quality: SuggestQualityReport,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): string[] {
  const violations: string[] = [];
  if (quality.passRate < thresholds.minSuggestPassRate) {
    violations.push(
      `ÖNERİ KALİTESİ (mock): genel geçme oranı ${formatPercent(quality.passRate)} < ${formatPercent(thresholds.minSuggestPassRate)}`,
    );
  }
  return violations;
}

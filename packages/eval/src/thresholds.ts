import { formatPercent } from './metrics.ts';

import type { EvalReport } from './metrics.ts';

/**
 * Eval eşikleri — CI kapısı.
 *
 * Şimdilik tam doğruluk isteniyor: sentetik veride etiketler bire bir eşleştiği için bu
 * ulaşılabilir bir hedeftir ve regresyonu en erken yakalayan ayardır. Eşik düşürülecekse
 * gerekçesi docs/DECISIONS.md'ye yazılmalıdır.
 */
export interface Thresholds {
  readonly minPrecision: number;
  readonly minRecall: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { minPrecision: 1, minRecall: 1 };

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

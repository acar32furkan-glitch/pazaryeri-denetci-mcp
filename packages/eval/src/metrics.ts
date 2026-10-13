import { defectKey, findingKey } from './match.ts';

import type { Finding } from '@pazaryeri-denetci/core';
import type { InjectedDefect } from '@pazaryeri-denetci/mock-data';

export interface RuleMetrics {
  readonly ruleId: string;
  /** Etiketli (enjekte edilmiş) hata sayısı. */
  readonly expected: number;
  /** Kuralın ürettiği bulgu sayısı. */
  readonly detected: number;
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
}

export interface EvalTotals {
  readonly productCount: number;
  readonly injectedDefects: number;
  readonly findings: number;
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
}

export interface EvalReport {
  readonly totals: EvalTotals;
  readonly rules: readonly RuleMetrics[];
  /** Etiketli olduğu hâlde hiçbir bulguyla eşleşmeyen hatalar (kaçırılanlar). */
  readonly missedDefects: readonly InjectedDefect[];
  /** Hiçbir etikete karşılık gelmeyen bulgular (yanlış pozitifler). */
  readonly falsePositiveFindings: readonly Finding[];
}

export interface EvalInput {
  readonly productCount: number;
  readonly defects: readonly InjectedDefect[];
  readonly findings: readonly Finding[];
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator;
}

/**
 * Bölme tanımı: payda 0 ise oran 1 kabul edilir (kural ne hata bekliyor ne de bulgu üretiyor).
 * Kural tamamen yoksa satır hiç oluşturulmaz — bkz. `evaluate`.
 */
function f1Of(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

export function evaluate(input: EvalInput): EvalReport {
  const defectKeys = new Set(input.defects.map((defect) => defectKey(defect)));
  const findingKeys = new Set(input.findings.map((finding) => findingKey(finding)));

  const missedDefects = input.defects.filter((defect) => !findingKeys.has(defectKey(defect)));
  const falsePositiveFindings = input.findings.filter(
    (finding) => !defectKeys.has(findingKey(finding)),
  );

  const expectedByRule = new Map<string, number>();
  for (const defect of input.defects) {
    expectedByRule.set(defect.expectedRuleId, (expectedByRule.get(defect.expectedRuleId) ?? 0) + 1);
  }
  const detectedByRule = new Map<string, number>();
  for (const finding of input.findings) {
    detectedByRule.set(finding.ruleId, (detectedByRule.get(finding.ruleId) ?? 0) + 1);
  }

  const ruleIds = [...new Set([...expectedByRule.keys(), ...detectedByRule.keys()])].sort();
  const rules: RuleMetrics[] = ruleIds.map((ruleId) => {
    const expected = expectedByRule.get(ruleId) ?? 0;
    const detected = detectedByRule.get(ruleId) ?? 0;
    const matchedDefects = input.defects.filter((defect) => defect.expectedRuleId === ruleId);
    const truePositives = matchedDefects.filter((defect) =>
      findingKeys.has(defectKey(defect)),
    ).length;
    const matchedFindings = input.findings.filter((finding) => finding.ruleId === ruleId);
    const falsePositives = matchedFindings.filter(
      (finding) => !defectKeys.has(findingKey(finding)),
    ).length;
    const falseNegatives = expected - truePositives;
    const precision = safeRatio(truePositives, truePositives + falsePositives);
    const recall = safeRatio(truePositives, truePositives + falseNegatives);
    return {
      ruleId,
      expected,
      detected,
      truePositives,
      falsePositives,
      falseNegatives,
      precision,
      recall,
      f1: f1Of(precision, recall),
    };
  });

  const truePositives = input.defects.length - missedDefects.length;
  const precision = safeRatio(truePositives, truePositives + falsePositiveFindings.length);
  const recall = safeRatio(truePositives, input.defects.length);

  return {
    totals: {
      productCount: input.productCount,
      injectedDefects: input.defects.length,
      findings: input.findings.length,
      truePositives,
      falsePositives: falsePositiveFindings.length,
      falseNegatives: missedDefects.length,
      precision,
      recall,
      f1: f1Of(precision, recall),
    },
    rules,
    missedDefects,
    falsePositiveFindings,
  };
}

/** Yüzde gösterimi (rapor ve eşik mesajları için tek biçim). */
export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

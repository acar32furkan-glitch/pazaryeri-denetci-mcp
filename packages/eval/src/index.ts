/**
 * Eval harness'ı: enjekte edilen hata etiketleri ile denetim bulgularını eşleştirir,
 * kural bazında precision/recall/F1 ve yanlış pozitif listesi üretir; ayrıca mock istemciyle
 * öneri hattının uçtan uca çalıştığını doğrular (canlı model ölçümü DEĞİL).
 */
export const PACKAGE_NAME = '@pazaryeri-denetci/eval';

export { DEFAULT_EVAL_CONFIG, runEval, runEvalFull } from './harness.ts';
export type { EvalConfig, EvalRun, EvalRunOptions, FullEvalRun } from './harness.ts';

export { defectKey, findingKey, keyOf } from './match.ts';

export { evaluate, formatPercent } from './metrics.ts';
export type { EvalInput, EvalReport, EvalTotals, RuleMetrics } from './metrics.ts';

export { renderMarkdown } from './report.ts';
export type { MarkdownMeta } from './report.ts';

export { SUGGEST_QUALITY_FIELDS, runSuggestQuality } from './suggest-quality.ts';
export type {
  SuggestFailure,
  SuggestFieldQuality,
  SuggestQualityOptions,
  SuggestQualityReport,
} from './suggest-quality.ts';

export { DEFAULT_THRESHOLDS, checkSuggestThreshold, checkThresholds } from './thresholds.ts';
export type { Thresholds } from './thresholds.ts';

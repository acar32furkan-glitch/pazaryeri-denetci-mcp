/**
 * Eval harness'ı: enjekte edilen hata etiketleri ile denetim bulgularını eşleştirir,
 * kural bazında precision/recall/F1 ve yanlış pozitif listesi üretir.
 */
export const PACKAGE_NAME = '@pazaryeri-denetci/eval';

export { DEFAULT_EVAL_CONFIG, runEval } from './harness.ts';
export type { EvalConfig, EvalRun, EvalRunOptions } from './harness.ts';

export { defectKey, findingKey, keyOf } from './match.ts';

export { evaluate, formatPercent } from './metrics.ts';
export type { EvalInput, EvalReport, EvalTotals, RuleMetrics } from './metrics.ts';

export { renderMarkdown } from './report.ts';
export type { MarkdownMeta } from './report.ts';

export { DEFAULT_THRESHOLDS, checkThresholds } from './thresholds.ts';
export type { Thresholds } from './thresholds.ts';

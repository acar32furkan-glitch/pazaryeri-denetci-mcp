import { RULE_CATALOG, auditCatalog } from '@pazaryeri-denetci/core';
import { generateCatalog } from '@pazaryeri-denetci/mock-data';

import { evaluate } from './metrics.ts';
import { renderMarkdown } from './report.ts';
import { DEFAULT_THRESHOLDS, checkThresholds } from './thresholds.ts';

import type { EvalReport } from './metrics.ts';
import type { Thresholds } from './thresholds.ts';
import type { Rule } from '@pazaryeri-denetci/core';
import type { GeneratedCatalog } from '@pazaryeri-denetci/mock-data';

export interface EvalConfig {
  readonly seed: number;
  readonly productCount: number;
  readonly defectsPerKind: number;
}

/** Varsayılan koşu: 500 ürün, tür başına 20 hata (7 tür → 140 etiketli hata). */
export const DEFAULT_EVAL_CONFIG: EvalConfig = {
  seed: 20261013,
  productCount: 500,
  defectsPerKind: 20,
};

export interface EvalRun {
  readonly config: EvalConfig;
  /** Üreticinin meta bilgisi (etiket sayaçları dâhil). */
  readonly generation: GeneratedCatalog['meta'];
  readonly report: EvalReport;
  readonly markdown: string;
  /** Boş değilse CI kapısı kırılmalıdır. */
  readonly violations: readonly string[];
}

export interface EvalRunOptions {
  readonly rules?: readonly Rule[];
  readonly thresholds?: Thresholds;
}

/** Sentetik katalog → denetim → metrikler → Markdown raporu. Tek geçişte, yan etkisiz. */
export function runEval(
  config: EvalConfig = DEFAULT_EVAL_CONFIG,
  options: EvalRunOptions = {},
): EvalRun {
  const rules = options.rules ?? RULE_CATALOG;
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;

  const generated = generateCatalog({
    seed: config.seed,
    productCount: config.productCount,
    defectsPerKind: config.defectsPerKind,
  });
  const audit = auditCatalog(generated.catalog, { rules });
  const report = evaluate({
    productCount: config.productCount,
    defects: generated.defects,
    findings: audit.findings,
  });
  const violations = checkThresholds(report, thresholds);
  const markdown = renderMarkdown(report, {
    config,
    meta: generated.meta,
    rules,
    violations,
  });

  return { config, generation: generated.meta, report, markdown, violations };
}

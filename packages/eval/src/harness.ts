import { RULE_CATALOG, auditCatalog } from '@pazaryeri-denetci/core';
import { generateCatalog } from '@pazaryeri-denetci/mock-data';

import { evaluate } from './metrics.ts';
import { renderMarkdown } from './report.ts';
import { runSuggestQuality } from './suggest-quality.ts';
import { DEFAULT_THRESHOLDS, checkSuggestThreshold, checkThresholds } from './thresholds.ts';

import type { EvalReport } from './metrics.ts';
import type { SuggestQualityOptions, SuggestQualityReport } from './suggest-quality.ts';
import type { Thresholds } from './thresholds.ts';
import type { Rule } from '@pazaryeri-denetci/core';
import type { GeneratedCatalog } from '@pazaryeri-denetci/mock-data';

export interface EvalConfig {
  readonly seed: number;
  readonly productCount: number;
  readonly defectsPerKind: number;
}

/** Varsayılan koşu: 1000 ürün, tür başına 20 hata (21 tür → 420 etiketli hata). */
export const DEFAULT_EVAL_CONFIG: EvalConfig = {
  seed: 20261013,
  productCount: 1000,
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
  /** Öneri kalite ölçümü için test enjeksiyonu (bkz. `suggest-quality.ts`). */
  readonly suggest?: SuggestQualityOptions;
}

/**
 * Sentetik katalog → denetim → metrikler → Markdown raporu. Tek geçişte, yan etkisiz.
 *
 * NOT: Bu fonksiyon öneri kalite bölümünü İÇERMEZ (ölçüm asenkron). Dokümanı üreten akış
 * `runEvalFull`'dur; `runEval` kural bazlı çekirdek koşu olarak korunur.
 */
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
    suggest: null,
    suggestThresholdEnforced: false,
  });

  return { config, generation: generated.meta, report, markdown, violations };
}

export interface FullEvalRun extends EvalRun {
  /** Mock istemciyle ölçülen öneri kalite kontrolü (canlı model DEĞİL). */
  readonly suggest: SuggestQualityReport;
  /** Yalnızca öneri kalite eşiğinden gelen ihlaller. */
  readonly suggestViolations: readonly string[];
}

/**
 * `pnpm run eval` akışı: kural bazlı koşu + mock istemciyle öneri kalite kontrolü.
 * Dokümanı bu fonksiyon üretir; `eval:check` bu metni birebir karşılaştırır.
 */
export async function runEvalFull(
  config: EvalConfig = DEFAULT_EVAL_CONFIG,
  options: EvalRunOptions = {},
): Promise<FullEvalRun> {
  const rules = options.rules ?? RULE_CATALOG;
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;

  const base = runEval(config, options);
  const suggest = await runSuggestQuality(config, options.suggest);
  // Öneri kalite eşiği varsayılan koşuya kalibre edilmiştir: farklı ürün/hata sayısıyla koşulunca
  // geçme oranı örneklem değişimi yüzünden oynar ve yanlış alarm üretir. Bu yüzden yalnızca
  // varsayılan parametrelerde denetlenir (rapor bunu açıkça yazar).
  const enforceSuggest = isDefaultEvalConfig(config);
  const suggestViolations = enforceSuggest ? checkSuggestThreshold(suggest, thresholds) : [];
  const violations = [...base.violations, ...suggestViolations];
  const markdown = renderMarkdown(base.report, {
    config,
    meta: base.generation,
    rules,
    violations,
    suggest,
    suggestThresholdEnforced: enforceSuggest,
  });

  return { ...base, suggest, suggestViolations, violations, markdown };
}

/** Koşu, eşiklerin kalibre edildiği varsayılan parametrelerle mi yapıldı. */
function isDefaultEvalConfig(config: EvalConfig): boolean {
  return (
    config.seed === DEFAULT_EVAL_CONFIG.seed &&
    config.productCount === DEFAULT_EVAL_CONFIG.productCount &&
    config.defectsPerKind === DEFAULT_EVAL_CONFIG.defectsPerKind
  );
}

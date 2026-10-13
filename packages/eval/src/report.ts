import { formatPercent } from './metrics.ts';

import type { EvalReport } from './metrics.ts';
import type { EvalConfig } from './harness.ts';
import type { Rule } from '@pazaryeri-denetci/core';
import type { DefectKind, GeneratedCatalog } from '@pazaryeri-denetci/mock-data';
import { DEFECT_LABELS_TR } from '@pazaryeri-denetci/mock-data';

export interface MarkdownMeta {
  readonly config: EvalConfig;
  readonly meta: GeneratedCatalog['meta'];
  readonly rules: readonly Rule[];
  readonly violations: readonly string[];
}

const MAX_LISTED = 10;

function severityLabel(ruleId: string, rules: readonly Rule[]): string {
  const rule = rules.find((candidate) => candidate.id === ruleId);
  return rule?.severity ?? '—';
}

function renderMissed(report: EvalReport): string[] {
  if (report.missedDefects.length === 0) {
    return ['- Yok.'];
  }
  return report.missedDefects
    .slice(0, MAX_LISTED)
    .map((defect) => `- \`${defect.expectedRuleId}\` · ${defect.productId} · \`${defect.detail}\``)
    .concat(
      report.missedDefects.length > MAX_LISTED
        ? [`- … ve ${report.missedDefects.length - MAX_LISTED} tane daha.`]
        : [],
    );
}

function renderFalsePositives(report: EvalReport): string[] {
  if (report.falsePositiveFindings.length === 0) {
    return ['- Yok.'];
  }
  return report.falsePositiveFindings
    .slice(0, MAX_LISTED)
    .map(
      (finding) =>
        `- \`${finding.ruleId}\` · ${finding.productId} · \`${finding.field}\` · ${finding.message}`,
    )
    .concat(
      report.falsePositiveFindings.length > MAX_LISTED
        ? [`- … ve ${report.falsePositiveFindings.length - MAX_LISTED} tane daha.`]
        : [],
    );
}

/** docs/EVAL.md içeriğini üretir. Rakamlar yalnızca gerçek koşudan gelir; burada hesap yok. */
export function renderMarkdown(report: EvalReport, input: MarkdownMeta): string {
  const kindRows = Object.entries(input.meta.byKind)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => {
      const label = DEFECT_LABELS_TR[kind as DefectKind];
      return `| \`${kind}\` | ${label} | ${count} |`;
    });

  const ruleRows = report.rules.map((rule) => {
    const severity = severityLabel(rule.ruleId, input.rules);
    return `| \`${rule.ruleId}\` | ${severity} | ${rule.expected} | ${rule.detected} | ${rule.truePositives} | ${rule.falsePositives} | ${rule.falseNegatives} | ${formatPercent(rule.precision)} | ${formatPercent(rule.recall)} | ${formatPercent(rule.f1)} |`;
  });

  const totals = report.totals;
  const lines: string[] = [
    '# Değerlendirme (EVAL)',
    '',
    'Bu dosya `pnpm run eval` komutuyla **üretilir**; tablodaki bütün sayılar gerçek bir koşudan',
    'gelir (uydurma/elle girilmiş rakam yoktur). Kaynak: sentetik üretici hata enjekte ederken her',
    'hatayı etiketler; harness etiketleri bulgularla `(kural, ürün, varyant SKU)` anahtarı üzerinden',
    'eşleştirir.',
    '',
    '## Koşu parametreleri',
    '',
    `- Seed: \`${input.config.seed}\``,
    `- Ürün sayısı: **${input.meta.productCount}**`,
    `- Etiketli hata: **${input.meta.injectedCount}** (tür başına ${input.config.defectsPerKind})`,
    `- Kural sayısı: ${input.rules.length}`,
    '',
    '## Etiketli hata türleri',
    '',
    '| Tür | Açıklama | Adet |',
    '| --- | --- | --- |',
    ...kindRows,
    '',
    '## Kural bazlı doğruluk',
    '',
    '| Kural | Şiddet | Beklenen | Bulunan | TP | FP | FN | Precision | Recall | F1 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...ruleRows,
    `| **GENEL** | — | ${totals.injectedDefects} | ${totals.findings} | ${totals.truePositives} | ${totals.falsePositives} | ${totals.falseNegatives} | ${formatPercent(totals.precision)} | ${formatPercent(totals.recall)} | ${formatPercent(totals.f1)} |`,
    '',
    '## Kaçırılan etiketli hatalar (recall kaybı)',
    '',
    ...renderMissed(report),
    '',
    '## Yanlış pozitif bulgular (precision kaybı)',
    '',
    ...renderFalsePositives(report),
    '',
    '## CI eşiği',
    '',
    input.violations.length === 0
      ? '- Eşik ihlali yok: tüm kurallar precision %100 ve recall %100.'
      : input.violations.map((violation) => `- İHLAL: ${violation}`).join('\n'),
    '',
  ];
  return lines.join('\n');
}

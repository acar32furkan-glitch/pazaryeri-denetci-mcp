import { formatPercent } from './metrics.ts';

import type { EvalReport } from './metrics.ts';
import type { EvalConfig } from './harness.ts';
import type { SuggestQualityReport } from './suggest-quality.ts';
import type { Rule } from '@pazaryeri-denetci/core';
import type { DefectKind, GeneratedCatalog } from '@pazaryeri-denetci/mock-data';
import { DEFECT_LABELS_TR } from '@pazaryeri-denetci/mock-data';

export interface MarkdownMeta {
  readonly config: EvalConfig;
  readonly meta: GeneratedCatalog['meta'];
  readonly rules: readonly Rule[];
  readonly violations: readonly string[];
  /** Mock istemciyle ölçülen öneri kalite kontrolü; yoksa bölüm hiç yazılmaz. */
  readonly suggest: SuggestQualityReport | null;
  /** Öneri kalite eşiği bu koşuda denetlendi mi (yalnızca varsayılan koşuda evet). */
  readonly suggestThresholdEnforced: boolean;
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

/** Öneri kalite kontrolü bölümü — mock istemci; model kalitesi DEĞİL, hat doğrulaması. */
function renderSuggestQuality(quality: SuggestQualityReport, thresholdEnforced: boolean): string[] {
  const fieldRows = quality.fields.map((entry) => {
    const rules = entry.rules.map((ruleId) => `\`${ruleId}\``).join(', ');
    return `| \`${entry.field}\` | ${rules} | ${entry.expected} | ${entry.produced} | ${entry.passed} | ${formatPercent(entry.passRate)} |`;
  });

  const failureLines =
    quality.failures.length === 0
      ? ['- Yok.']
      : quality.failures
          .slice(0, MAX_LISTED)
          .map((failure) => {
            const produced = failure.produced ? '' : ' (öneride alan yok)';
            const remaining =
              failure.remainingRuleIds.length > 0
                ? failure.remainingRuleIds.map((ruleId) => `\`${ruleId}\``).join(', ')
                : '—';
            return `- \`${failure.productId}\` · \`${failure.field}\`${produced} · kalan kural: ${remaining}`;
          })
          .concat(
            quality.failures.length > MAX_LISTED
              ? [`- … ve ${quality.failures.length - MAX_LISTED} tane daha.`]
              : [],
          );

  return [
    '## LLM öneri kalite kontrolü (mock istemci — harness doğrulaması)',
    '',
    '> **UYARI / DÜRÜSTLÜK:** Bu bölüm **mock LLM (sahte istemci) ile yapılan HARNESS',
    '> doğrulamasıdır; canlı model ölçümü YAPILMADI.** Buradaki sayılar bir modelin öneri kalitesini',
    '> **ölçmez**; öneri hattının (prompt → şema doğrulaması → öneri → öneriyi uygula → ilgili',
    '> deterministik kuralları yeniden çalıştır) uçtan uca çalıştığını doğrular. Gerçek model kalitesi',
    '> için `anthropic` istemcisiyle ayrı bir koşu gerekir; aşağıdaki oranlar o ölçümün yerine geçmez.',
    '',
    `- İstemci: \`${quality.model}\` (deterministik sahte istemci, önbellek açık)`,
    `- Düzeltilebilir bulgusu olan ürün: **${quality.consideredProducts}**`,
    `- Öneri isteği: **${quality.requests}** · üretilen öneri: **${quality.suggestions}** · alınamayan: ${quality.unavailable}`,
    `- Önbellek: ${quality.cacheHits} isabet · aynı istek tekrarında önbellekten geldi mi: ${quality.cacheHitOnRepeat ? 'evet' : 'hayır'}`,
    thresholdEnforced
      ? '- Eşik denetimi: uygulandı (varsayılan koşu).'
      : '- Eşik denetimi: uygulanmadı — öneri kalite eşiği yalnızca varsayılan koşu için kalibre edilmiştir.',
    '',
    '| Öneri alanı | Yeniden denetlenen kurallar | Beklenen | Üretilen | Geçen | Geçme oranı |',
    '| --- | --- | --- | --- | --- | --- |',
    ...fieldRows,
    `| **GENEL** | — | ${quality.expected} | ${quality.produced} | ${quality.passed} | ${formatPercent(quality.passRate)} |`,
    '',
    '### İlgili kuralları geçmeyen öneriler',
    '',
    ...failureLines,
    '',
  ];
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
    ...(input.suggest === null
      ? []
      : renderSuggestQuality(input.suggest, input.suggestThresholdEnforced)),
    '## CI eşiği',
    '',
    ...renderViolations(input.violations, input.suggest !== null, input.suggestThresholdEnforced),
    '',
  ];
  return lines.join('\n');
}

/** CI eşiği bölümü: ihlal varsa listeler, yoksa sağlanan eşikleri özetler. */
function renderViolations(
  violations: readonly string[],
  hasSuggest: boolean,
  suggestThresholdEnforced: boolean,
): string[] {
  if (violations.length > 0) {
    return violations.map((violation) => `- İHLAL: ${violation}`);
  }
  if (!hasSuggest) {
    return ['- Eşik ihlali yok: tüm kurallar precision %100 ve recall %100.'];
  }
  return [
    suggestThresholdEnforced
      ? '- Eşik ihlali yok: tüm kurallar precision %100 ve recall %100; mock öneri kalite kontrolü eşiği sağlanıyor.'
      : '- Eşik ihlali yok: tüm kurallar precision %100 ve recall %100; mock öneri kalite eşiği bu koşuda denetlenmedi (yalnızca varsayılan koşu).',
  ];
}

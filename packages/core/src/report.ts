/**
 * Denetim sonuçlarını dışa aktarılabilir biçimlere çeviren saf fonksiyonlar.
 *
 * İki çıktı vardır:
 * - {@link renderFindingsJson} — makine tarafından okunan, **deterministik** JSON.
 * - {@link renderFindingsMarkdown} — insan tarafından okunan Türkçe Markdown raporu.
 *
 * Kurallar: dosya sistemi, ağ, saat ve rastgelelik yok. Aynı girdi her zaman birebir
 * aynı çıktıyı üretir (anahtar sırası ve liste sırası sabittir).
 */

import { truncateEvidence } from './rule.ts';
import { SEVERITY_ORDER, severityLabelTr } from './severity.ts';

import type { AuditResult } from './audit.ts';
import type { Rule } from './rule.ts';
import type { Finding, Severity } from './types.ts';

/** JSON çıktısındaki `generatedBy` imzası — raporların kaynağını gösterir. */
export const REPORT_GENERATOR = 'pazaryeri-denetci-mcp';

/** Markdown raporunun varsayılan başlığı. */
export const DEFAULT_REPORT_TITLE = 'Katalog Denetim Raporu';

/** Markdown raporunda varsayılan olarak listelenen en fazla bulgu sayısı. */
export const DEFAULT_MAX_FINDINGS = 50;

/** Markdown `kanıt:` satırında gösterilen en fazla karakter sayısı. */
export const EVIDENCE_MAX_LENGTH = 120;

export interface ReportOptions {
  /** Markdown başlığı; boş/verilmezse {@link DEFAULT_REPORT_TITLE}. */
  readonly title?: string;
  /** Markdown'da listelenecek en fazla bulgu; varsayılan {@link DEFAULT_MAX_FINDINGS}. */
  readonly maxFindings?: number;
  /** Kural kayıt defteri — kural dağılımı tablosunda Türkçe başlık göstermek için. */
  readonly rules?: readonly Rule[];
}

/** JSON'a yazılan bulgu — alan sırası sözleşmedir (deterministik çıktı). */
interface JsonFinding {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly productId: string;
  readonly variantSku: string | null;
  readonly field: string;
  readonly message: string;
  readonly fixHint: string;
  readonly evidence: string | null;
}

const REPORT_NOTE =
  '_Bu rapor `pazaryeri-denetci-mcp` tarafından üretilmiştir. Buradaki kurallar örnek ve ' +
  'yapılandırılabilir olup resmî pazaryeri dokümantasyonundan doğrulanmalıdır._';

function resolveTitle(options: ReportOptions): string {
  const title = options.title?.trim();
  return title === undefined || title === '' ? DEFAULT_REPORT_TITLE : title;
}

function resolveMaxFindings(options: ReportOptions): number {
  return options.maxFindings ?? DEFAULT_MAX_FINDINGS;
}

/** `byRule` sayaçlarını kural kimliğine göre alfabetik (yerel ayardan bağımsız) sıralar. */
function sortedRuleEntries(
  byRule: Readonly<Record<string, number>>,
): readonly (readonly [string, number])[] {
  return Object.entries(byRule).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

/** `rules` verilmişse kural kimliğinden Türkçe başlığa bir harita kurar (ilk tanım kazanır). */
function buildRuleTitleMap(rules: readonly Rule[] | undefined): ReadonlyMap<string, string> {
  const titles = new Map<string, string>();
  if (rules === undefined) return titles;
  for (const rule of rules) {
    if (!titles.has(rule.id)) {
      titles.set(rule.id, rule.title);
    }
  }
  return titles;
}

function toJsonFinding(finding: Finding): JsonFinding {
  return {
    ruleId: finding.ruleId,
    severity: finding.severity,
    productId: finding.productId,
    variantSku: finding.variantSku,
    field: finding.field,
    message: finding.message,
    fixHint: finding.fixHint,
    evidence: finding.evidence,
  };
}

/**
 * Bulguları deterministik JSON olarak döner: iki boşluk girinti, sabit anahtar sırası ve
 * sonda tek bir `\n`. `findings` girdi sırasını korur; alanlar olduğu gibi aktarılır.
 *
 * Not: `options` yalnızca imza simetrisi için alınır — JSON **tüm** bulguları içerir
 * (`maxFindings` yalnızca Markdown raporunu kısaltır).
 */
export function renderFindingsJson(result: AuditResult, _options: ReportOptions = {}): string {
  const payload = {
    generatedBy: REPORT_GENERATOR,
    summary: {
      productCount: result.summary.productCount,
      findingCount: result.summary.findingCount,
      bySeverity: {
        critical: result.summary.bySeverity.critical,
        major: result.summary.bySeverity.major,
        minor: result.summary.bySeverity.minor,
      },
      byRule: Object.fromEntries(sortedRuleEntries(result.summary.byRule)),
    },
    findings: result.findings.map(toJsonFinding),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/**
 * Kullanıcıya gösterilen metni Markdown için kaçışlar: `|`, backtick, `*`, `_`, `[`, `]`,
 * `<`, `>` karakterlerinin önüne `\` ekler ve satır sonlarını (birden çok olsa da) tek
 * boşluğa indirir. Böylece kanıt metni tablo sınırlarını bozamaz.
 */
export function escapeMarkdown(value: string): string {
  return value.replace(/[\r\n]+/gu, ' ').replace(/[|`*_[\]<>]/gu, (char) => `\\${char}`);
}

function renderSeverityTable(result: AuditResult): readonly string[] {
  const rows = ['| Şiddet | Bulgu |', '| --- | --- |'];
  const bySeverity = result.summary.bySeverity;
  for (const severity of SEVERITY_ORDER) {
    rows.push(`| ${severityLabelTr(severity)} | ${bySeverity[severity]} |`);
  }
  if (result.summary.findingCount > 0) {
    rows.push(`| **Toplam** | ${result.summary.findingCount} |`);
  }
  return rows;
}

function renderRuleTable(
  result: AuditResult,
  ruleTitles: ReadonlyMap<string, string>,
): readonly string[] {
  const rows = ['| Kural | Bulgu |', '| --- | --- |'];
  for (const [ruleId, count] of sortedRuleEntries(result.summary.byRule)) {
    const ruleTitle = ruleTitles.get(ruleId);
    const label =
      ruleTitle === undefined ? `\`${ruleId}\`` : `\`${ruleId}\` — ${escapeMarkdown(ruleTitle)}`;
    rows.push(`| ${label} | ${count} |`);
  }
  return rows;
}

function renderFindingItem(finding: Finding): readonly string[] {
  const lines = [
    `- **${severityLabelTr(finding.severity)}** · \`${finding.ruleId}\` · \`${finding.productId}\``,
    `  alan: ${finding.field}`,
  ];

  const sku = finding.variantSku?.trim() ?? '';
  if (sku !== '') {
    lines.push(`  varyant: ${sku}`);
  }

  lines.push(`  sorun: ${finding.message}`);
  lines.push(`  öneri: ${finding.fixHint}`);

  const evidence = finding.evidence;
  if (evidence !== null && evidence.trim() !== '') {
    lines.push(`  kanıt: ${escapeMarkdown(truncateEvidence(evidence, EVIDENCE_MAX_LENGTH))}`);
  }

  return lines;
}

function renderFindingsSection(result: AuditResult, maxFindings: number): readonly string[] {
  const findings = result.findings;
  if (findings.length === 0) {
    return ['- Bulgu yok. 🎉'];
  }

  const shown = maxFindings > 0 ? findings.slice(0, maxFindings) : [];
  const lines: string[] = [];
  for (const finding of shown) {
    lines.push(...renderFindingItem(finding));
  }

  const remaining = findings.length - shown.length;
  if (remaining > 0) {
    lines.push(`- … ve ${remaining} bulgu daha (raporda kısaltıldı).`);
  }
  return lines;
}

/**
 * Bulguları Türkçe Markdown raporu olarak döner. Bölüm sırası sabittir:
 * başlık → giriş cümlesi → `## Özet` (şiddet/kural tabloları) → `## Bulgular` → kapanış notu.
 *
 * `maxFindings` yalnızca `## Bulgular` listesini kısaltır; özet tabloları her zaman tüm
 * bulguları sayar.
 */
export function renderFindingsMarkdown(result: AuditResult, options: ReportOptions = {}): string {
  const title = resolveTitle(options);
  const maxFindings = resolveMaxFindings(options);
  const ruleTitles = buildRuleTitleMap(options.rules);

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(
    `Bu raporda **${result.summary.productCount}** ürün denetlendi ve toplam ` +
      `**${result.summary.findingCount}** bulgu bulundu.`,
  );
  lines.push('');
  lines.push('## Özet');
  lines.push('');
  lines.push(...renderSeverityTable(result));
  lines.push('');
  lines.push(...renderRuleTable(result, ruleTitles));
  lines.push('');
  lines.push('## Bulgular');
  lines.push('');
  lines.push(...renderFindingsSection(result, maxFindings));
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(REPORT_NOTE);
  lines.push('');
  return lines.join('\n');
}

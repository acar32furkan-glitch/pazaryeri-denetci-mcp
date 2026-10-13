import { severityRank } from './severity.ts';
import type { ChannelListing, Finding, Product, RuleDefinition } from './types.ts';

/** Kuralın denetlediği bağlam: tek ürün + o ürünün kanal beslemesi satırları. */
export interface RuleContext {
  readonly product: Product;
  readonly listings: readonly ChannelListing[];
}

/** Tek bir denetim kuralı. `check` saf olmalıdır: yan etki yok, saat/rastgelelik yok. */
export interface Rule extends RuleDefinition {
  readonly check: (context: RuleContext) => readonly Finding[];
}

export interface FindingInput {
  readonly field: string;
  readonly message: string;
  readonly fixHint: string;
  readonly variantSku?: string | null;
  readonly evidence?: string | null;
}

const EVIDENCE_MAX_LENGTH = 120;

/** Bulgu üretiminde kullanılan ortak yardımcı — alan sırası ve varsayılanlar tek yerde kalsın. */
export function makeFinding(
  definition: RuleDefinition,
  product: Product,
  input: FindingInput,
): Finding {
  return {
    ruleId: definition.id,
    severity: definition.severity,
    productId: product.id,
    variantSku: input.variantSku ?? null,
    field: input.field,
    message: input.message,
    fixHint: input.fixHint,
    evidence: input.evidence ?? null,
  };
}

/** Kanıt metni loglara/rapora sızmasın diye tek satıra indirilir ve kısaltılır. */
export function truncateEvidence(value: string, max = EVIDENCE_MAX_LENGTH): string {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

/** Kararlı sıralama anahtarı: şiddet → kural → ürün → varyant → alan. */
export function compareFindings(a: Finding, b: Finding): number {
  const bySeverity = severityRank(a.severity) - severityRank(b.severity);
  if (bySeverity !== 0) return bySeverity;
  if (a.ruleId !== b.ruleId) return a.ruleId < b.ruleId ? -1 : 1;
  if (a.productId !== b.productId) return a.productId < b.productId ? -1 : 1;
  const aSku = a.variantSku ?? '';
  const bSku = b.variantSku ?? '';
  if (aSku !== bSku) return aSku < bSku ? -1 : 1;
  if (a.field === b.field) return 0;
  return a.field < b.field ? -1 : 1;
}

export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(compareFindings);
}

/** Kuralları sabit sırada koşturur ve bulguları kararlı biçimde sıralar. */
export function runRules(rules: readonly Rule[], context: RuleContext): Finding[] {
  const findings: Finding[] = [];
  for (const rule of rules) {
    findings.push(...rule.check(context));
  }
  return sortFindings(findings);
}

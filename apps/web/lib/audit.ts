import {
  RULE_CATALOG,
  auditCatalog,
  renderFindingsMarkdown,
  severityLabelTr,
} from '@pazaryeri-denetci/core';
import type { AuditSummary, Finding, Rule, Severity } from '@pazaryeri-denetci/core';
import { generateCatalog } from '@pazaryeri-denetci/mock-data';
import type { GeneratedCatalog } from '@pazaryeri-denetci/mock-data';

import type { CatalogProfile, CatalogProfileId } from './catalog-profiles';

/** Bir kuralın katalogdaki bulgu sayısı ve Türkçe meta bilgisi. */
export interface RuleCount {
  readonly ruleId: string;
  readonly title: string;
  readonly severity: Severity;
  readonly severityLabel: string;
  readonly count: number;
}

/** Demo sonucu: sayfa ve API rotaları bu nesneyi paylaşır. */
export interface DemoAudit {
  readonly profile: CatalogProfile;
  readonly summary: AuditSummary;
  readonly findings: readonly Finding[];
  /** İndirilebilir Türkçe Markdown raporu (tüm bulgular dâhil). */
  readonly markdown: string;
  /** Üreticinin etiketlediği (yani bilerek enjekte edilen) hata sayısı. */
  readonly injectedDefectCount: number;
}

/** Kural kimliğinden tanıma — rapor tablolarında Türkçe başlık göstermek için. */
export const RULE_BY_ID: ReadonlyMap<string, Rule> = new Map(
  RULE_CATALOG.map((rule) => [rule.id, rule] as const),
);

/**
 * Üretilen kataloglar profillere göre önbelleklenir: `runDemoAudit` ve `productTitleMap` aynı
 * kataloğu paylaşır, sayfa başına iki kez üretim/kalıcılık yapılmaz. Üretici saf ve seed'li
 * olduğu için önbellek sonucu değiştirmez.
 */
const catalogCache = new Map<CatalogProfileId, GeneratedCatalog>();

/** Profil tanımına göre sentetik katalog üretir (önbellekli, deterministik). */
export function getProfileCatalog(profile: CatalogProfile): GeneratedCatalog {
  const cached = catalogCache.get(profile.id);
  if (cached !== undefined) return cached;

  const generated = generateCatalog({
    seed: profile.seed,
    productCount: profile.productCount,
    defectKinds: profile.defectKinds,
    defectsPerKind: profile.defectsPerKind,
  });
  catalogCache.set(profile.id, generated);
  return generated;
}

/**
 * Seçilen profil için denetimi uçtan uca koşar: sentetik katalog üretimi → `auditCatalog` →
 * Türkçe Markdown raporu. Girdi saf olduğu için çıktı her koşuda aynıdır.
 */
export function runDemoAudit(profile: CatalogProfile): DemoAudit {
  const generated = getProfileCatalog(profile);
  const result = auditCatalog(generated.catalog);
  const markdown = renderFindingsMarkdown(result, {
    title: `Katalog Denetim Raporu — ${profile.label} profil (${profile.productCount} ürün)`,
    rules: RULE_CATALOG,
    maxFindings: result.findings.length,
  });

  return {
    profile,
    summary: result.summary,
    findings: result.findings,
    markdown,
    injectedDefectCount: generated.meta.injectedCount,
  };
}

/** Ürün kimliğinden başlığa harita — bulgu listesinde ürün adını göstermek için. */
export function productTitleMap(profile: CatalogProfile): ReadonlyMap<string, string> {
  const products = getProfileCatalog(profile).catalog.products;
  return new Map(products.map((product) => [product.id, product.title] as const));
}

/**
 * En sık görülen kurallar. Eşitlikte kural kimliğine göre alfabetik sıralanır (deterministik,
 * yerel ayardan bağımsız).
 */
export function topRules(summary: AuditSummary, limit: number): readonly RuleCount[] {
  return Object.entries(summary.byRule)
    .sort(([leftId, leftCount], [rightId, rightCount]) =>
      leftCount === rightCount ? (leftId < rightId ? -1 : 1) : rightCount - leftCount,
    )
    .slice(0, limit)
    .map(([ruleId, count]) => {
      const rule = RULE_BY_ID.get(ruleId);
      return {
        ruleId,
        title: rule?.title ?? ruleId,
        severity: rule?.severity ?? 'minor',
        severityLabel: severityLabelTr(rule?.severity ?? 'minor'),
        count,
      };
    });
}

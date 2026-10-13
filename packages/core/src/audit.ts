import { RULE_CATALOG } from './rules/index.ts';
import { EMPTY_CATALOG_INDEX, runRules, sortFindings } from './rule.ts';

import type { CatalogIndex, Rule, RuleContext } from './rule.ts';
import type { Catalog, ChannelListing, Finding, Product, Severity } from './types.ts';

export interface AuditOptions {
  /** Varsayılan: tüm kural kayıt defteri. */
  readonly rules?: readonly Rule[];
  /** Kanal beslemeleri (aynı SKU'nun pazaryeri satırları); varsayılan: boş. */
  readonly listings?: readonly ChannelListing[];
  /** Uzun koşularda ilerleme bildirimi (opsiyonel, yan etkisi yok). */
  readonly onProgress?: (done: number, total: number) => void;
}

export interface AuditSummary {
  readonly productCount: number;
  readonly findingCount: number;
  readonly bySeverity: Readonly<Record<Severity, number>>;
  readonly byRule: Readonly<Record<string, number>>;
}

export interface AuditResult {
  readonly findings: readonly Finding[];
  readonly summary: AuditSummary;
}

/** Sayfalama sonucu: `hasMore` istemcinin bir sonraki isteği atıp atmayacağını söyler. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly offset: number;
  readonly limit: number;
  readonly total: number;
  readonly hasMore: boolean;
}

/**
 * Katalog geneli indeksi kurar (ürün-ötesi kurallar için; ör. SKU çakışması).
 * Katalog başına **bir kez** kurulur, tüm ürünler aynı indeksi paylaşır.
 */
export function buildCatalogIndex(catalog: Catalog): CatalogIndex {
  const skuOwners = new Map<string, string[]>();
  for (const product of catalog.products) {
    for (const variant of product.variants) {
      const sku = variant.sku?.trim() ?? '';
      if (sku === '') continue;
      const owners = skuOwners.get(sku);
      if (owners === undefined) {
        skuOwners.set(sku, [product.id]);
      } else {
        owners.push(product.id);
      }
    }
  }
  return { skuOwners };
}

/** Kanal beslemelerini SKU'ya göre gruplar (bir SKU birden çok kanalda olabilir). */
export function groupListingsBySku(
  listings: readonly ChannelListing[],
): Map<string, ChannelListing[]> {
  const groups = new Map<string, ChannelListing[]>();
  for (const listing of listings) {
    const sku = listing.sku?.trim();
    if (sku === undefined || sku === '') continue;
    const existing = groups.get(sku);
    if (existing === undefined) {
      groups.set(sku, [listing]);
    } else {
      existing.push(listing);
    }
  }
  return groups;
}

export function summarize(findings: readonly Finding[], productCount: number): AuditSummary {
  const bySeverity: Record<Severity, number> = { critical: 0, major: 0, minor: 0 };
  const byRule: Record<string, number> = {};
  for (const finding of findings) {
    bySeverity[finding.severity] += 1;
    byRule[finding.ruleId] = (byRule[finding.ruleId] ?? 0) + 1;
  }
  return {
    productCount,
    findingCount: findings.length,
    bySeverity,
    byRule,
  };
}

export function auditProduct(
  product: Product,
  rules: readonly Rule[] = RULE_CATALOG,
  listings: readonly ChannelListing[] = [],
  index: CatalogIndex = EMPTY_CATALOG_INDEX,
): Finding[] {
  const context: RuleContext = { product, listings, index };
  return runRules(rules, context);
}

/** Tüm kataloğu denetler; bulgular kararlı biçimde sıralanır (ADR-007). */
export function auditCatalog(catalog: Catalog, options: AuditOptions = {}): AuditResult {
  const rules = options.rules ?? RULE_CATALOG;
  const listingsBySku = groupListingsBySku(options.listings ?? catalog.listings);
  const index = buildCatalogIndex(catalog);
  const collected: Finding[] = [];

  for (const [position, product] of catalog.products.entries()) {
    const variantSkus = product.variants
      .map((variant) => variant.sku?.trim() ?? '')
      .filter((sku) => sku !== '');
    const productListings: ChannelListing[] = [];
    for (const sku of variantSkus) {
      productListings.push(...(listingsBySku.get(sku) ?? []));
    }
    collected.push(...auditProduct(product, rules, productListings, index));
    options.onProgress?.(position + 1, catalog.products.length);
  }

  const findings = sortFindings(collected);
  return { findings, summary: summarize(findings, catalog.products.length) };
}

/** Önem sırasına göre en kritik N bulgu. */
export function topFindings(result: AuditResult, limit: number): readonly Finding[] {
  if (limit <= 0) return [];
  return result.findings.slice(0, limit);
}

export interface PageOptions {
  readonly offset?: number;
  readonly limit?: number;
  /** Sayfa başına üst sınır: tek istekte sınırsız veri dönmesin (varsayılan 500). */
  readonly maxLimit?: number;
}

/** Bellek dostu sayfalama: girdi zaten bellekteyse dilim döner, sınırlar normalize edilir. */
export function paginate<T>(items: readonly T[], options: PageOptions = {}): Page<T> {
  const maxLimit = options.maxLimit ?? 500;
  const total = items.length;
  const offset = Math.min(Math.max(options.offset ?? 0, 0), total);
  const requested = options.limit ?? Math.min(total, maxLimit);
  const limit = Math.min(Math.max(requested, 0), maxLimit);
  const slice = items.slice(offset, offset + limit);
  return {
    items: slice,
    offset,
    limit,
    total,
    hasMore: offset + slice.length < total,
  };
}

export function pageFindings(
  findings: readonly Finding[],
  options: PageOptions = {},
): Page<Finding> {
  return paginate(findings, options);
}

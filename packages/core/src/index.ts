/**
 * Denetim çekirdeği: tipler, kural kayıt defteri, denetim ve rapor üretimi.
 *
 * Saf fonksiyonlar: dosya sistemi, ağ, saat ve rastgelelik yok. Aynı girdi her zaman aynı
 * bulgu listesini üretir (kararlı sıralama dâhil).
 */
export const PACKAGE_NAME = '@pazaryeri-denetci/core';

export { auditCatalog, auditProduct, groupListingsBySku, summarize, topFindings } from './audit.ts';
export type { AuditOptions, AuditResult, AuditSummary } from './audit.ts';

export { checkGtin, computeGtinCheckDigit } from './gtin.ts';
export type { GtinCheck, GtinFormat } from './gtin.ts';

export { plainText, plainTextLength } from './html.ts';

export { compareFindings, makeFinding, runRules, sortFindings, truncateEvidence } from './rule.ts';
export type { FindingInput, Rule, RuleContext } from './rule.ts';

export { RULE_ID_LIST } from './rule-ids.ts';
export type { RuleId } from './rule-ids.ts';

export {
  RULE_CATALOG,
  barcodeInvalidRule,
  descMissingRule,
  getRule,
  imageAltMissingRule,
  seoMetaMissingRule,
  skuMissingRule,
  titleLengthRule,
} from './rules/index.ts';
export { TITLE_MAX_LENGTH, TITLE_MIN_LENGTH } from './rules/title-length.ts';

export { SEVERITY_LABELS_TR, SEVERITY_ORDER, severityLabelTr, severityRank } from './severity.ts';

export { lowerTr, slugifyTr, upperTr } from './text-tr.ts';

export type {
  Catalog,
  Channel,
  ChannelListing,
  Finding,
  Metafield,
  Product,
  ProductImage,
  ProductStatus,
  RuleDefinition,
  SeoMeta,
  Severity,
  Variant,
  VariantOption,
} from './types.ts';

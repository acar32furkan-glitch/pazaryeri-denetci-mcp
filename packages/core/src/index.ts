/**
 * Denetim çekirdeği: tipler, kural kayıt defteri, denetim ve rapor üretimi.
 *
 * Saf fonksiyonlar: dosya sistemi, ağ, saat ve rastgelelik yok. Aynı girdi her zaman aynı
 * bulgu listesini üretir (kararlı sıralama dâhil).
 */
export const PACKAGE_NAME = '@pazaryeri-denetci/core';

export { auditCatalog, auditProduct, groupListingsBySku, summarize, topFindings } from './audit.ts';
export type { AuditOptions, AuditResult, AuditSummary, Page, PageOptions } from './audit.ts';
export { buildCatalogIndex, pageFindings, paginate } from './audit.ts';
export { containsUnsafeHtml, sanitizeHtml } from './sanitize.ts';
export { ALL_CHANNELS, EMPTY_CATALOG_INDEX } from './rule.ts';
export type { CatalogIndex } from './rule.ts';

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
  channelMismatchRule,
  descMissingRule,
  descTooShortRule,
  descUnsafeHtmlRule,
  getRule,
  imageAltMissingRule,
  imageCountLowRule,
  metafieldMissingRule,
  priceCompareAtInvalidRule,
  seoMetaMissingRule,
  skuDuplicateRule,
  skuMissingRule,
  titleKeywordStuffingRule,
  titleLengthRule,
  trTextQualityRule,
  variantMissingPriceOrStockRule,
  variantOptionInconsistentRule,
} from './rules/index.ts';
export { TITLE_MAX_LENGTH, TITLE_MIN_LENGTH } from './rules/title-length.ts';
export {
  TITLE_MAX_SEPARATORS,
  TITLE_MAX_WORDS,
  TITLE_WORD_REPEAT_LIMIT,
  titleWords,
} from './rules/title-keyword-stuffing.ts';
export { DESC_MIN_LENGTH } from './rules/desc-too-short.ts';
export { IMAGE_MIN_COUNT } from './rules/image-count-low.ts';
export { SIZE_ORDER } from './rules/variant-option-inconsistent.ts';
export { METAFIELD_NAMESPACE, REQUIRED_METAFIELDS } from './rules/metafield-missing.ts';
export type { RequiredMetafield } from './rules/metafield-missing.ts';
export { COMBINING_DOT, findMojibake, localeSensitiveWords } from './rules/tr-text-quality.ts';

export { renderFindingsJson, renderFindingsMarkdown, escapeMarkdown } from './report.ts';
export type { ReportOptions } from './report.ts';

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

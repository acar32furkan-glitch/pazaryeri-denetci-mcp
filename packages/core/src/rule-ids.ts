/**
 * Kural kimliklerinin tek kaynağı. Kod ve doküman bu listeye bağlıdır; yeni kural eklerken
 * buraya da ekleyin, aksi hâlde `RuleId` tipi derlemeyi durdurur.
 */
export const RULE_ID_LIST = [
  'TITLE_LENGTH',
  'TITLE_KEYWORD_STUFFING',
  'DESC_MISSING',
  'DESC_TOO_SHORT',
  'DESC_UNSAFE_HTML',
  'SEO_META_MISSING',
  'IMAGE_ALT_MISSING',
  'IMAGE_COUNT_LOW',
  'VARIANT_OPTION_INCONSISTENT',
  'VARIANT_MISSING_PRICE_OR_STOCK',
  'SKU_MISSING',
  'SKU_DUPLICATE',
  'BARCODE_INVALID',
  'PRICE_COMPARE_AT_INVALID',
  'METAFIELD_MISSING',
  'CHANNEL_MISMATCH',
  'TR_TEXT_QUALITY',
] as const;

export type RuleId = (typeof RULE_ID_LIST)[number];

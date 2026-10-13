/**
 * Kural kimliklerinin tek kaynağı. Kod ve doküman bu listeye bağlıdır; yeni kural eklerken
 * buraya da ekleyin, aksi hâlde `RuleId` tipi derlemeyi durdurur.
 */
export const RULE_ID_LIST = [
  'TITLE_LENGTH',
  'DESC_MISSING',
  'SEO_META_MISSING',
  'IMAGE_ALT_MISSING',
  'SKU_MISSING',
  'BARCODE_INVALID',
] as const;

export type RuleId = (typeof RULE_ID_LIST)[number];

/**
 * Etiketlenmiş hata enjeksiyonu sözleşmesi.
 *
 * Üretici her enjekte ettiği hatayı **etiketler**: eval harness'ı "gerçek doğruluk" verisini
 * yalnızca bu etiketlerden alır (docs/DECISIONS.md, ADR-003). Hata türleri fazlara göre
 * büyür; bir tür eklendiğinde `EXPECTED_RULE_ID_BY_KIND` da güncellenmelidir.
 */

/** Faz 1 ve Faz 2'de uygulanan hata türleri. Yeni tür eklerken üç tabloyu birlikte güncelle. */
export const DEFECT_KINDS = [
  // Faz 1
  'TITLE_TOO_SHORT',
  'TITLE_TOO_LONG',
  'DESC_EMPTY',
  'SEO_META_NULL',
  'IMAGE_ALT_NULL',
  'SKU_NULL',
  'BARCODE_CHECKSUM_BROKEN',
  // Faz 2
  'TITLE_REPEATED_WORDS',
  'DESC_SHORT',
  'DESC_SCRIPT',
  'IMAGE_COUNT_LOW',
  'VARIANT_OPTION_CASE_MISMATCH',
  'VARIANT_PRICE_NULL',
  'SKU_DUPLICATE_IN_PRODUCT',
  'SKU_DUPLICATE_ACROSS_PRODUCTS',
  'COMPARE_AT_BELOW_PRICE',
  'METAFIELD_REMOVED',
  'METAFIELD_INVALID_VALUE',
  'LISTING_PRICE_MISMATCH',
  'TR_MOJIBAKE',
  'TR_LOCALE_CASING',
] as const;

export type DefectKind = (typeof DEFECT_KINDS)[number];

/** Enjekte edilen hatanın, hangi kural tarafından yakalanması **beklendiğini** söyler. */
export const EXPECTED_RULE_ID_BY_KIND: Readonly<Record<DefectKind, string>> = {
  TITLE_TOO_SHORT: 'TITLE_LENGTH',
  TITLE_TOO_LONG: 'TITLE_LENGTH',
  DESC_EMPTY: 'DESC_MISSING',
  SEO_META_NULL: 'SEO_META_MISSING',
  IMAGE_ALT_NULL: 'IMAGE_ALT_MISSING',
  SKU_NULL: 'SKU_MISSING',
  BARCODE_CHECKSUM_BROKEN: 'BARCODE_INVALID',
  TITLE_REPEATED_WORDS: 'TITLE_KEYWORD_STUFFING',
  DESC_SHORT: 'DESC_TOO_SHORT',
  DESC_SCRIPT: 'DESC_UNSAFE_HTML',
  IMAGE_COUNT_LOW: 'IMAGE_COUNT_LOW',
  VARIANT_OPTION_CASE_MISMATCH: 'VARIANT_OPTION_INCONSISTENT',
  VARIANT_PRICE_NULL: 'VARIANT_MISSING_PRICE_OR_STOCK',
  SKU_DUPLICATE_IN_PRODUCT: 'SKU_DUPLICATE',
  SKU_DUPLICATE_ACROSS_PRODUCTS: 'SKU_DUPLICATE',
  COMPARE_AT_BELOW_PRICE: 'PRICE_COMPARE_AT_INVALID',
  METAFIELD_REMOVED: 'METAFIELD_MISSING',
  METAFIELD_INVALID_VALUE: 'METAFIELD_MISSING',
  LISTING_PRICE_MISMATCH: 'CHANNEL_MISMATCH',
  TR_MOJIBAKE: 'TR_TEXT_QUALITY',
  TR_LOCALE_CASING: 'TR_TEXT_QUALITY',
};

/** Rapor ve eval tablosunda kullanılan Türkçe karşılıklar. */
export const DEFECT_LABELS_TR: Readonly<Record<DefectKind, string>> = {
  TITLE_TOO_SHORT: 'başlık çok kısa',
  TITLE_TOO_LONG: 'başlık çok uzun',
  DESC_EMPTY: 'açıklama boş',
  SEO_META_NULL: 'SEO meta yok',
  IMAGE_ALT_NULL: 'görsel alt metni yok',
  SKU_NULL: 'SKU yok',
  BARCODE_CHECKSUM_BROKEN: 'barkod sağlama basamağı bozuk',
  TITLE_REPEATED_WORDS: 'başlıkta kelime tekrarı',
  DESC_SHORT: 'açıklama çok kısa',
  DESC_SCRIPT: 'açıklamada <script>',
  IMAGE_COUNT_LOW: 'görsel sayısı yetersiz',
  VARIANT_OPTION_CASE_MISMATCH: 'seçenek değerinde harf farkı',
  VARIANT_PRICE_NULL: 'varyantta fiyat yok',
  SKU_DUPLICATE_IN_PRODUCT: 'ürün içinde SKU tekrarı',
  SKU_DUPLICATE_ACROSS_PRODUCTS: 'ürünler arası SKU tekrarı',
  COMPARE_AT_BELOW_PRICE: 'karşılaştırma fiyatı düşük',
  METAFIELD_REMOVED: 'zorunlu alan kaldırıldı',
  METAFIELD_INVALID_VALUE: 'zorunlu alanda geçersiz değer',
  LISTING_PRICE_MISMATCH: 'kanal fiyatı uyuşmuyor',
  TR_MOJIBAKE: 'Türkçe karakter bozulması',
  TR_LOCALE_CASING: 'yanlış yerelde harf dönüşümü',
};

export interface InjectedDefect {
  readonly kind: DefectKind;
  readonly expectedRuleId: string;
  readonly productId: string;
  readonly variantSku: string | null;
  /** Hatanın yazıldığı alan yolu, ör. `variants[0].barcode`. */
  readonly field: string;
  /** İnsan okunur kısa açıklama (rapor için). */
  readonly detail: string;
}

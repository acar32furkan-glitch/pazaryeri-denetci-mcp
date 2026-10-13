/**
 * Etiketlenmiş hata enjeksiyonu sözleşmesi.
 *
 * Üretici her enjekte ettiği hatayı **etiketler**: eval harness'ı "gerçek doğruluk" verisini
 * yalnızca bu etiketlerden alır (docs/DECISIONS.md, ADR-003). Hata türleri fazlara göre
 * büyür; bir tür eklendiğinde `EXPECTED_RULE_ID_BY_KIND` da güncellenmelidir.
 */

/** Faz 1'de uygulanan hata türleri (Faz 2'de genişletilecek). */
export const DEFECT_KINDS = [
  'TITLE_TOO_SHORT',
  'TITLE_TOO_LONG',
  'DESC_EMPTY',
  'SEO_META_NULL',
  'IMAGE_ALT_NULL',
  'SKU_NULL',
  'BARCODE_CHECKSUM_BROKEN',
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

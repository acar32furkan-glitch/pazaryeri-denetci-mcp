/**
 * Katalog ve denetim veri modeli.
 *
 * Bu tipler sistemin sözleşmesidir: `mock-data` (sentetik üretici), `core` (kurallar),
 * `mcp-server` ve `eval` yalnızca bu tipler üzerinden konuşur.
 */

/** Bulgu şiddeti — rapor sıralaması bu sıraya göre yapılır. */
export type Severity = 'critical' | 'major' | 'minor';

/** Denetimin uygulandığı kanallar. */
export type Channel = 'shopify' | 'hepsiburada' | 'trendyol' | 'n11' | 'merchant-center';

export type ProductStatus = 'active' | 'draft' | 'archived';

export interface SeoMeta {
  title: string | null;
  description: string | null;
}

export interface ProductImage {
  url: string;
  altText: string | null;
}

export interface VariantOption {
  name: string;
  value: string;
}

export interface Variant {
  sku: string | null;
  barcode: string | null;
  /** Satış fiyatı (TRY). */
  price: number | null;
  /** Karşılaştırma ("eski") fiyatı (TRY). */
  compareAtPrice: number | null;
  options: VariantOption[];
  inventoryQuantity: number | null;
}

export interface Metafield {
  namespace: string;
  key: string;
  type: string;
  value: string | null;
}

export interface Product {
  id: string;
  handle: string;
  title: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: ProductStatus;
  seo: SeoMeta;
  images: ProductImage[];
  variants: Variant[];
  metafields: Metafield[];
}

/** Pazaryeri/Merchant Center beslemesindeki tek SKU satırı. */
export interface ChannelListing {
  channel: Channel;
  sku: string | null;
  price: number | null;
  stock: number | null;
  attributes: Record<string, string>;
  warnings: string[];
}

export interface Catalog {
  products: Product[];
  listings: ChannelListing[];
}

/** Denetim sonucunun tek bir satırı. */
export interface Finding {
  ruleId: string;
  severity: Severity;
  productId: string;
  variantSku: string | null;
  /** Hatalı alanın yolu, ör. `title`, `variants[0].barcode`, `seo`. */
  field: string;
  message: string;
  fixHint: string;
  /** Hatalı alanın (kısaltılmış) değeri — kullanıcıya neyin yanlış olduğunu gösterir. */
  evidence: string | null;
}

/** Kuralın kimliği ve meta bilgisi — `check` fonksiyonu olmadan. */
export interface RuleDefinition {
  id: string;
  severity: Severity;
  appliesTo: readonly Channel[];
  /** İnsan okunur kısa başlık (Türkçe). */
  title: string;
  /** Kuralın ne aradığının tek cümlelik açıklaması (Türkçe). */
  description: string;
}

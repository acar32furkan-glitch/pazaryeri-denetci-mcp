/**
 * Deterministik JSON dışa/içe aktarma.
 *
 * `exportCatalogJson` çıktısı sabittir: anahtar sırası tip tanımındaki sıraya göre kilitlenir,
 * girinti 2 boşluk, sonunda satır sonu vardır ve `attributes` anahtarları sıralanır. Böylece
 * aynı katalog her zaman bayt bayt aynı JSON'u üretir (diff/snapshot/test güvenilir olur).
 *
 * `importCatalogJson` bu biçimi okur; bozuk JSON'da anlamlı Türkçe mesajla hata atar.
 */

import type {
  Catalog,
  Channel,
  ChannelListing,
  Metafield,
  Product,
  ProductImage,
  ProductStatus,
  SeoMeta,
  Variant,
  VariantOption,
} from '@pazaryeri-denetci/core';

function serializeSeo(seo: SeoMeta): { title: string | null; description: string | null } {
  return { title: seo.title, description: seo.description };
}

function serializeImage(image: ProductImage): { url: string; altText: string | null } {
  return { url: image.url, altText: image.altText };
}

function serializeOption(option: VariantOption): { name: string; value: string } {
  return { name: option.name, value: option.value };
}

function serializeVariant(variant: Variant): {
  sku: string | null;
  barcode: string | null;
  price: number | null;
  compareAtPrice: number | null;
  options: { name: string; value: string }[];
  inventoryQuantity: number | null;
} {
  return {
    sku: variant.sku,
    barcode: variant.barcode,
    price: variant.price,
    compareAtPrice: variant.compareAtPrice,
    options: variant.options.map(serializeOption),
    inventoryQuantity: variant.inventoryQuantity,
  };
}

function serializeMetafield(metafield: Metafield): {
  namespace: string;
  key: string;
  type: string;
  value: string | null;
} {
  return {
    namespace: metafield.namespace,
    key: metafield.key,
    type: metafield.type,
    value: metafield.value,
  };
}

function serializeProduct(product: Product): Record<string, unknown> {
  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    descriptionHtml: product.descriptionHtml,
    vendor: product.vendor,
    productType: product.productType,
    tags: [...product.tags],
    status: product.status,
    seo: serializeSeo(product.seo),
    images: product.images.map(serializeImage),
    variants: product.variants.map(serializeVariant),
    metafields: product.metafields.map(serializeMetafield),
  };
}

/** `attributes` anahtarlarını sıralar: determinizmin gereği. */
function serializeAttributes(attributes: Record<string, string>): Record<string, string> {
  const ordered: Record<string, string> = {};
  for (const key of Object.keys(attributes).sort()) {
    ordered[key] = attributes[key] ?? '';
  }
  return ordered;
}

function serializeListing(listing: ChannelListing): Record<string, unknown> {
  return {
    channel: listing.channel,
    sku: listing.sku,
    price: listing.price,
    stock: listing.stock,
    attributes: serializeAttributes(listing.attributes),
    warnings: [...listing.warnings],
  };
}

/** Kataloğu deterministik JSON metnine çevirir (2 boşluk girinti, sonunda `\n`). */
export function exportCatalogJson(catalog: Catalog): string {
  const payload = {
    products: catalog.products.map(serializeProduct),
    listings: catalog.listings.map(serializeListing),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!isUnknownArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') out.push(item);
  }
  return out;
}

function coerceAttribute(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function parseAttributes(value: unknown): Record<string, string> {
  if (!isPlainObject(value)) return {};
  const attributes: Record<string, string> = {};
  for (const key of Object.keys(value).sort()) {
    attributes[key] = coerceAttribute(value[key]);
  }
  return attributes;
}

function parseStatus(value: unknown): ProductStatus {
  return typeof value === 'string' && isProductStatus(value) ? value : 'active';
}

function isProductStatus(value: string): value is ProductStatus {
  return value === 'active' || value === 'draft' || value === 'archived';
}

function isChannel(value: string): value is Channel {
  return (
    value === 'shopify' ||
    value === 'hepsiburada' ||
    value === 'trendyol' ||
    value === 'n11' ||
    value === 'merchant-center'
  );
}

function parseSeo(value: unknown): SeoMeta {
  if (!isPlainObject(value)) return { title: null, description: null };
  return {
    title: asNullableString(value['title']),
    description: asNullableString(value['description']),
  };
}

function parseOptions(value: unknown, path: string): VariantOption[] {
  if (!isUnknownArray(value)) return [];
  return value.map((item, index) => {
    if (!isPlainObject(item)) {
      throw new Error(`Katalog JSON biçimi geçersiz: "${path}.options[${index}]" bir nesne değil.`);
    }
    return { name: asString(item['name']), value: asString(item['value']) };
  });
}

function parseVariant(value: unknown, path: string): Variant {
  if (!isPlainObject(value)) {
    throw new Error(`Katalog JSON biçimi geçersiz: "${path}" bir nesne değil.`);
  }
  return {
    sku: asNullableString(value['sku']),
    barcode: asNullableString(value['barcode']),
    price: asNullableNumber(value['price']),
    compareAtPrice: asNullableNumber(value['compareAtPrice']),
    options: parseOptions(value['options'], path),
    inventoryQuantity: asNullableNumber(value['inventoryQuantity']),
  };
}

function parseImages(value: unknown, path: string): ProductImage[] {
  if (!isUnknownArray(value)) return [];
  return value.map((item, index) => {
    if (!isPlainObject(item)) {
      throw new Error(`Katalog JSON biçimi geçersiz: "${path}.images[${index}]" bir nesne değil.`);
    }
    return { url: asString(item['url']), altText: asNullableString(item['altText']) };
  });
}

function parseMetafields(value: unknown, path: string): Metafield[] {
  if (!isUnknownArray(value)) return [];
  return value.map((item, index) => {
    if (!isPlainObject(item)) {
      throw new Error(
        `Katalog JSON biçimi geçersiz: "${path}.metafields[${index}]" bir nesne değil.`,
      );
    }
    return {
      namespace: asString(item['namespace']),
      key: asString(item['key']),
      type: asString(item['type']),
      value: asNullableString(item['value']),
    };
  });
}

function parseProduct(value: unknown, index: number): Product {
  const path = `products[${index}]`;
  if (!isPlainObject(value)) {
    throw new Error(`Katalog JSON biçimi geçersiz: "${path}" bir nesne değil.`);
  }

  const variantsRaw = value['variants'];
  let variants: Variant[];
  if (variantsRaw === undefined) {
    variants = [];
  } else if (isUnknownArray(variantsRaw)) {
    variants = variantsRaw.map((item, variantIndex) =>
      parseVariant(item, `${path}.variants[${variantIndex}]`),
    );
  } else {
    throw new Error(`Katalog JSON biçimi geçersiz: "${path}.variants" bir dizi değil.`);
  }

  return {
    id: asString(value['id']),
    handle: asString(value['handle']),
    title: asString(value['title']),
    descriptionHtml: asString(value['descriptionHtml']),
    vendor: asString(value['vendor']),
    productType: asString(value['productType']),
    tags: asStringArray(value['tags']),
    status: parseStatus(value['status']),
    seo: parseSeo(value['seo']),
    images: parseImages(value['images'], path),
    variants,
    metafields: parseMetafields(value['metafields'], path),
  };
}

function parseListing(value: unknown, index: number): ChannelListing {
  const path = `listings[${index}]`;
  if (!isPlainObject(value)) {
    throw new Error(`Katalog JSON biçimi geçersiz: "${path}" bir nesne değil.`);
  }
  const channel = asString(value['channel']);
  if (!isChannel(channel)) {
    throw new Error(
      `Katalog JSON biçimi geçersiz: "${path}.channel" bilinmeyen kanal: "${channel}".`,
    );
  }
  return {
    channel,
    sku: asNullableString(value['sku']),
    price: asNullableNumber(value['price']),
    stock: asNullableNumber(value['stock']),
    attributes: parseAttributes(value['attributes']),
    warnings: asStringArray(value['warnings']),
  };
}

/**
 * JSON metnini `Catalog`'a çevirir. Geçersiz JSON veya yapıda anlamlı Türkçe mesajla hata atar.
 * Eksik isteğe bağlı alanlar güvenli varsayılanlarla doldurulur.
 */
export function importCatalogJson(json: string): Catalog {
  let data: unknown;
  try {
    data = JSON.parse(json) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Geçersiz JSON: ${detail}`, { cause: error });
  }

  if (!isPlainObject(data)) {
    throw new Error('Katalog JSON biçimi geçersiz: kök değer bir nesne olmalı.');
  }

  const productsRaw = data['products'];
  if (!isUnknownArray(productsRaw)) {
    throw new Error('Katalog JSON biçimi geçersiz: "products" dizisi bulunamadı.');
  }
  const products = productsRaw.map((item, index) => parseProduct(item, index));

  const listingsRaw = data['listings'];
  const listings = isUnknownArray(listingsRaw)
    ? listingsRaw.map((item, index) => parseListing(item, index))
    : [];

  return { products, listings };
}

import { computeGtinCheckDigit, lowerTr, plainText, slugifyTr } from '@pazaryeri-denetci/core';

import { DEFECT_KINDS, EXPECTED_RULE_ID_BY_KIND, DEFECT_LABELS_TR } from './defects.ts';
import type { DefectKind, InjectedDefect } from './defects.ts';
import { createRng } from './prng.ts';
import type { Rng } from './prng.ts';
import {
  AGE_GROUPS,
  CARE_INSTRUCTIONS,
  COLORS,
  DESCRIPTION_FILLERS,
  MATERIALS,
  PRODUCT_NOUNS,
  SIZES,
  TITLE_TAILS,
  VENDORS,
} from './vocabulary.ts';

import type { Catalog, Channel, ChannelListing, Product, Variant } from '@pazaryeri-denetci/core';

export interface CatalogOptions {
  readonly seed: number;
  readonly productCount: number;
  /** Hangi hata türleri enjekte edilecek. Varsayılan: tümü. */
  readonly defectKinds?: readonly DefectKind[];
  /** Her hata türü için hata enjekte edilecek ürün sayısı (varsayılan 10). */
  readonly defectsPerKind?: number;
  /** Besleme üretilecek kanallar. */
  readonly channels?: readonly Channel[];
}

export interface GeneratedCatalog {
  readonly catalog: Catalog;
  readonly defects: readonly InjectedDefect[];
  readonly meta: {
    readonly seed: number;
    readonly productCount: number;
    readonly injectedCount: number;
    readonly byKind: Readonly<Record<DefectKind, number>>;
  };
}

const DEFAULT_CHANNELS: readonly Channel[] = ['trendyol', 'hepsiburada', 'merchant-center'];
const DEFAULT_DEFECTS_PER_KIND = 10;
const IMAGES_MIN = 3;
const IMAGES_MAX = 5;
const VARIANTS_MIN = 2;
const VARIANTS_MAX = 3;
const PRICE_MIN_CENTS = 14990;
const PRICE_MAX_CENTS = 249990;

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

function productId(index: number): string {
  return `snt-prd-${pad(index + 1, 4)}`;
}

/** Fiyatı kuruş cinsinden üretip iki basamağa yuvarlar — kayan nokta artıkları raporu bozmasın. */
function priceFromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function buildDescription(
  productNoun: string,
  material: string,
  color: string,
  vendor: string,
  tail: string,
  rng: Rng,
): string {
  const filler = rng.pick(DESCRIPTION_FILLERS);
  const care = rng.pick(CARE_INSTRUCTIONS);
  return [
    `<p>${color} ${material} ${productNoun}, ${filler}. ${tail} serisinde yer alan bu ürün ${vendor} tarafından hazırlanır.</p>`,
    `<p>Ölçü ve bakım bilgileri için aşağıdaki listeyi inceleyin. Ürün, ${material} materyalinin doğal dokusunu korur.</p>`,
    `<ul><li>Materyal: ${material}</li><li>Renk: ${color}</li><li>Bakım: ${care}</li></ul>`,
  ].join('');
}

function buildBarcode(rng: Rng): string {
  const body = `869${pad(rng.int(0, 999999999), 9)}`;
  return `${body}${String(computeGtinCheckDigit(body))}`;
}

interface CleanProductResult {
  readonly product: Product;
  readonly listings: readonly ChannelListing[];
}

function createCleanProduct(
  index: number,
  rng: Rng,
  channels: readonly Channel[],
): CleanProductResult {
  const noun = rng.pick(PRODUCT_NOUNS);
  const material = rng.pick(MATERIALS);
  const color = rng.pick(COLORS);
  const size = rng.pick(SIZES);
  const tail = rng.pick(TITLE_TAILS);
  const vendor = rng.pick(VENDORS);
  const id = productId(index);
  const title = `${color} ${material} ${noun} ${tail}`;
  const handle = `${slugifyTr(`${noun}-${color}`)}-${pad(index + 1, 4)}`;
  const descriptionHtml = buildDescription(noun, material, color, vendor, tail, rng);

  const imageCount = rng.int(IMAGES_MIN, IMAGES_MAX);
  const images = Array.from({ length: imageCount }, (_, imageIndex) => ({
    url: `https://cdn.sentetik-ornek.test/${handle}/${imageIndex + 1}.jpg`,
    altText: `${title} - görsel ${imageIndex + 1}`,
  }));

  const variantCount = rng.int(VARIANTS_MIN, VARIANTS_MAX);
  const baseColorIndex = COLORS.indexOf(color);
  const variants: Variant[] = Array.from({ length: variantCount }, (_, variantIndex) => {
    const cents = rng.int(PRICE_MIN_CENTS, PRICE_MAX_CENTS);
    const price = priceFromCents(cents);
    // Seçenekler varyant başına DEĞİŞİR ve kanonik sözlükten gelir: aksi hâlde aynı ürünün
    // varyantları aynı kombinasyonda olur ve VARIANT_OPTION_INCONSISTENT haklı olarak bağırır.
    const variantColor = COLORS[(baseColorIndex + variantIndex) % COLORS.length] ?? color;
    const variantSize = SIZES[variantIndex % SIZES.length] ?? size;
    return {
      sku: `SNT-${pad(index + 1, 4)}-${pad(variantIndex + 1, 2)}`,
      barcode: buildBarcode(rng),
      price,
      compareAtPrice: rng.bool(0.4) ? priceFromCents(Math.round(cents * 1.25)) : null,
      options: [
        { name: 'Renk', value: variantColor },
        { name: 'Beden', value: variantSize },
      ],
      inventoryQuantity: rng.int(0, 120),
    };
  });

  const descriptionText = plainText(descriptionHtml);
  const product: Product = {
    id,
    handle,
    title,
    descriptionHtml,
    vendor,
    productType: noun,
    tags: [slugifyTr(color), slugifyTr(material), 'sentetik'],
    status: rng.bool(0.1) ? 'draft' : 'active',
    seo: {
      title: `${title} | Sentetik Mağaza`,
      description: `${descriptionText.slice(0, 150)}…`,
    },
    images,
    variants,
    metafields: [
      {
        namespace: 'sentetik',
        key: 'yas_grubu',
        type: 'single_line_text_field',
        value: rng.pick(AGE_GROUPS),
      },
      { namespace: 'sentetik', key: 'materyal', type: 'single_line_text_field', value: material },
      { namespace: 'sentetik', key: 'renk', type: 'single_line_text_field', value: color },
    ],
  };

  const listings: ChannelListing[] = [];
  for (const channel of channels) {
    for (const variant of variants) {
      listings.push({
        channel,
        sku: variant.sku,
        price: variant.price,
        stock: variant.inventoryQuantity,
        attributes: { renk: color, beden: size },
        warnings: [],
      });
    }
  }

  return { product, listings };
}

/** Bir hatayı uygularken gereken ürün-dışı bağlam (temiz ürünler, sıra bilgisi, kanal satırları). */
interface DefectContext {
  /** Hiç hata enjekte edilmemiş ürünler — SKU kopyalamak için güvenli kaynak havuzu. */
  readonly cleanProducts: readonly Product[];
  readonly indexByProduct: ReadonlyMap<string, number>;
  readonly listings: readonly ChannelListing[];
}

/** UTF-8 metnin Latin-1 varsayımıyla okunmasından doğan tipik bozulmalar. */
const MOJIBAKE_REPLACEMENTS: readonly (readonly [string, string])[] = [
  ['ü', 'Ã¼'],
  ['ö', 'Ã¶'],
  ['ç', 'Ã§'],
  ['ı', 'Ä±'],
  ['ş', 'ÅŸ'],
  ['ğ', 'ÄŸ'],
];

function toMojibake(value: string): string {
  let result = value;
  for (const [correct, broken] of MOJIBAKE_REPLACEMENTS) {
    result = result.split(correct).join(broken);
  }
  return result;
}

/** Tek bir hatayı ürüne uygular ve etiketini döner. */
function applyDefect(
  product: Product,
  kind: DefectKind,
  rng: Rng,
  context: DefectContext,
): InjectedDefect {
  const base = {
    kind,
    expectedRuleId: EXPECTED_RULE_ID_BY_KIND[kind],
    productId: product.id,
  };
  const label = DEFECT_LABELS_TR[kind];

  switch (kind) {
    case 'TITLE_TOO_SHORT': {
      const titles = ['Kazak', 'Çanta', 'Kupa'];
      product.title = rng.pick(titles);
      return {
        ...base,
        variantSku: null,
        field: 'title',
        detail: `${label}: başlık "${product.title}" (${product.title.length} karakter)`,
      };
    }
    case 'TITLE_TOO_LONG': {
      // Uzun ama kelime tekrarı olmayan kuyruk: yalnızca TITLE_LENGTH tetiklensin
      // (kelime sayısı 12'yi, tekrar 3'ü aşmasın).
      product.title =
        `${product.title} Koleksiyon Mevsimlik Kaliteli Detaylı Bakımlı Harmoni`.trim();
      return {
        ...base,
        variantSku: null,
        field: 'title',
        detail: `${label}: başlık ${product.title.length} karaktere çıkarıldı`,
      };
    }
    case 'DESC_EMPTY': {
      product.descriptionHtml = rng.bool(0.5) ? '' : '<p>&nbsp;</p>';
      return {
        ...base,
        variantSku: null,
        field: 'descriptionHtml',
        detail: `${label}: açıklama "${product.descriptionHtml}"`,
      };
    }
    case 'SEO_META_NULL': {
      product.seo = { title: null, description: null };
      return {
        ...base,
        variantSku: null,
        field: 'seo',
        detail: `${label}: seo.title ve seo.description kaldırıldı`,
      };
    }
    case 'IMAGE_ALT_NULL': {
      const imageIndex = rng.int(0, product.images.length - 1);
      const image = product.images[imageIndex];
      if (image === undefined) throw new Error('IMAGE_ALT_NULL: görsel bulunamadı.');
      image.altText = null;
      return {
        ...base,
        variantSku: null,
        field: 'images',
        detail: `${label}: ${imageIndex + 1}. görselin alt metni kaldırıldı`,
      };
    }
    case 'SKU_NULL': {
      const variantIndex = rng.int(0, product.variants.length - 1);
      const variant = product.variants[variantIndex];
      if (variant === undefined) throw new Error('SKU_NULL: varyant bulunamadı.');
      variant.sku = null;
      return {
        ...base,
        variantSku: null,
        field: `variants[${variantIndex}].sku`,
        detail: `${label}: ${variantIndex + 1}. varyantın SKU değeri kaldırıldı`,
      };
    }
    case 'BARCODE_CHECKSUM_BROKEN': {
      const variantIndex = rng.int(0, product.variants.length - 1);
      const variant = product.variants[variantIndex];
      if (variant === undefined) throw new Error('BARCODE_CHECKSUM_BROKEN: varyant bulunamadı.');
      const original = variant.barcode ?? '';
      const body = original.slice(0, -1);
      const wrongCheck = (Number(original.slice(-1)) + 1) % 10;
      variant.barcode = `${body}${String(wrongCheck)}`;
      return {
        ...base,
        variantSku: variant.sku,
        field: `variants[${variantIndex}].barcode`,
        detail: `${label}: ${original} → ${variant.barcode}`,
      };
    }
    case 'TITLE_REPEATED_WORDS': {
      product.title = `${product.title} kazak kazak kazak`.trim();
      return {
        ...base,
        variantSku: null,
        field: 'title',
        detail: `${label}: "kazak" 3 kez eklendi`,
      };
    }
    case 'DESC_SHORT': {
      product.descriptionHtml = '<p>Kısa açıklama.</p>';
      return {
        ...base,
        variantSku: null,
        field: 'descriptionHtml',
        detail: `${label}: açıklama ${String(plainText(product.descriptionHtml).length)} karaktere indirildi`,
      };
    }
    case 'DESC_SCRIPT': {
      product.descriptionHtml = `${product.descriptionHtml}<script>alert('deneme')</script>`;
      return {
        ...base,
        variantSku: null,
        field: 'descriptionHtml',
        detail: `${label}: <script> eklendi`,
      };
    }
    case 'IMAGE_COUNT_LOW': {
      product.images = product.images.slice(0, 1);
      return {
        ...base,
        variantSku: null,
        field: 'images',
        detail: `${label}: görsel sayısı 1'e indirildi`,
      };
    }
    case 'VARIANT_OPTION_CASE_MISMATCH': {
      const first = product.variants[0];
      const second = product.variants[1];
      const firstOption = first?.options[0];
      const secondOption = second?.options[0];
      if (firstOption === undefined || secondOption === undefined) {
        throw new Error('VARIANT_OPTION_CASE_MISMATCH: iki varyant ve bir seçenek gerekir.');
      }
      secondOption.value = lowerTr(firstOption.value);
      return {
        ...base,
        variantSku: null,
        field: 'variants[1].options[0].value',
        detail: `${label}: "${firstOption.value}" → "${secondOption.value}"`,
      };
    }
    case 'VARIANT_PRICE_NULL': {
      const variant = product.variants[0];
      if (variant === undefined) throw new Error('VARIANT_PRICE_NULL: varyant bulunamadı.');
      const previous = variant.price;
      variant.price = null;
      // Fiyat yoksa karşılaştırma fiyatı da anlamsızdır: iki kural birden bağırmasın
      // (hatanın tek sahibi VARIANT_MISSING_PRICE_OR_STOCK).
      variant.compareAtPrice = null;
      return {
        ...base,
        variantSku: variant.sku,
        field: 'variants[0].price',
        detail: `${label}: ${String(previous)} → (boş)`,
      };
    }
    case 'SKU_DUPLICATE_IN_PRODUCT': {
      const first = product.variants[0];
      const second = product.variants[1];
      if (first?.sku === undefined || first.sku === null || second === undefined) {
        throw new Error('SKU_DUPLICATE_IN_PRODUCT: iki varyant ve dolu SKU gerekir.');
      }
      second.sku = first.sku;
      return {
        ...base,
        variantSku: first.sku,
        field: 'variants[1].sku',
        detail: `${label}: 2. varyanta "${first.sku}" yazıldı`,
      };
    }
    case 'SKU_DUPLICATE_ACROSS_PRODUCTS': {
      const target = product.variants[0];
      if (target === undefined)
        throw new Error('SKU_DUPLICATE_ACROSS_PRODUCTS: varyant bulunamadı.');
      const targetPosition = context.indexByProduct.get(product.id) ?? 0;
      const sources = context.cleanProducts.filter(
        (candidate) => (context.indexByProduct.get(candidate.id) ?? 0) < targetPosition,
      );
      const source = sources.length > 0 ? rng.pick(sources) : null;
      const sourceSku = source?.variants[0]?.sku ?? null;
      if (sourceSku === null || sourceSku === '') {
        // Kaynak bulunamazsa ürün içi tekrara düşülür: etiket yine aynı kuralı gösterir ve
        // bulgu yine bu üründe çıkar (eval eşleşmesi bozulmaz).
        const second = product.variants[1];
        if (target.sku === null || second === undefined) {
          throw new Error('SKU_DUPLICATE_ACROSS_PRODUCTS: kaynak SKU da yedek yol da yok.');
        }
        second.sku = target.sku;
        return {
          ...base,
          variantSku: target.sku,
          field: 'variants[1].sku',
          detail: `${label}: kaynak ürün yok, ürün içi tekrara düşüldü`,
        };
      }
      target.sku = sourceSku;
      return {
        ...base,
        variantSku: sourceSku,
        field: 'variants[0].sku',
        detail: `${label}: "${sourceSku}" başka bir üründen kopyalandı`,
      };
    }
    case 'COMPARE_AT_BELOW_PRICE': {
      const variant = product.variants[0];
      if (variant?.price === null || variant?.price === undefined) {
        throw new Error('COMPARE_AT_BELOW_PRICE: önce fiyat gerekir.');
      }
      const below = Number((variant.price * 0.8).toFixed(2));
      variant.compareAtPrice = below;
      return {
        ...base,
        variantSku: variant.sku,
        field: 'variants[0].compareAtPrice',
        detail: `${label}: ${String(below)} < ${String(variant.price)}`,
      };
    }
    case 'METAFIELD_REMOVED': {
      product.metafields = product.metafields.filter((metafield) => metafield.key !== 'renk');
      return {
        ...base,
        variantSku: null,
        field: 'metafields[sentetik]',
        detail: `${label}: "renk" kaldırıldı`,
      };
    }
    case 'METAFIELD_INVALID_VALUE': {
      const metafield = product.metafields.find((candidate) => candidate.key === 'yas_grubu');
      if (metafield === undefined)
        throw new Error('METAFIELD_INVALID_VALUE: yas_grubu bulunamadı.');
      metafield.value = 'Bilinmeyen yaş aralığı';
      return {
        ...base,
        variantSku: null,
        field: 'metafields[sentetik]',
        detail: `${label}: yas_grubu = "${metafield.value}"`,
      };
    }
    case 'LISTING_PRICE_MISMATCH': {
      const variant = product.variants[0];
      if (variant?.sku === undefined || variant.sku === null) {
        throw new Error('LISTING_PRICE_MISMATCH: SKU gerekir.');
      }
      const rows = context.listings.filter(
        (listing) => (listing.sku?.trim() ?? '') === variant.sku && listing.price !== null,
      );
      if (rows.length === 0) throw new Error('LISTING_PRICE_MISMATCH: kanal satırı bulunamadı.');
      const row = rng.pick(rows);
      const previous = row.price;
      row.price = Number(((row.price ?? 0) + 10).toFixed(2));
      return {
        ...base,
        variantSku: variant.sku,
        field: 'listings',
        detail: `${label}: ${row.channel} ${String(previous)} → ${String(row.price)}`,
      };
    }
    case 'TR_MOJIBAKE': {
      product.descriptionHtml = toMojibake(product.descriptionHtml);
      return {
        ...base,
        variantSku: null,
        field: 'descriptionHtml',
        detail: `${label}: açıklama Latin-1 varsayımıyla bozuldu`,
      };
    }
    case 'TR_LOCALE_CASING': {
      product.title = `${product.title} İNDİRİMLİ`;
      // Varsayılan toLowerCase() 'İ' harfini "i̇" (i + U+0307) yapar; bozuk slug böyle üretilir.
      product.handle = product.title.toLowerCase().replace(/\s+/gu, '-');
      return {
        ...base,
        variantSku: null,
        field: 'handle',
        detail: `${label}: slug varsayılan yerelde üretildi (U+0307)`,
      };
    }
  }
}

/**
 * Seed'li sentetik katalog üretir.
 *
 * Önce tüm ürünler **hatasız** üretilir, sonra seçilen ürünlere tek tek hata enjekte edilir.
 * Her ürüne en fazla bir hata yazılır; böylece bir kuralın bulgusu ile etiket bire bir eşleşir
 * ve eval'de yanlış pozitif gürültüsü oluşmaz.
 */
export function generateCatalog(options: CatalogOptions): GeneratedCatalog {
  const { seed, productCount } = options;
  const kinds = options.defectKinds ?? DEFECT_KINDS;
  const perKind = options.defectsPerKind ?? DEFAULT_DEFECTS_PER_KIND;
  const channels = options.channels ?? DEFAULT_CHANNELS;

  if (productCount <= 0) {
    throw new Error('generateCatalog: productCount pozitif olmalı.');
  }
  for (const kind of kinds) {
    if (!DEFECT_KINDS.includes(kind)) {
      throw new Error(`generateCatalog: bilinmeyen hata türü "${kind}".`);
    }
  }
  const totalDefects = kinds.length * perKind;
  if (totalDefects > productCount) {
    throw new Error(
      `generateCatalog: ${totalDefects} hata için ${productCount} ürün yetmiyor (her ürüne en fazla bir hata).`,
    );
  }

  const rng = createRng(seed);
  const products: Product[] = [];
  const listings: ChannelListing[] = [];
  const defects: InjectedDefect[] = [];
  const byKind = Object.fromEntries(kinds.map((kind) => [kind, 0])) as Record<DefectKind, number>;

  for (let index = 0; index < productCount; index += 1) {
    const created = createCleanProduct(index, rng, channels);
    products.push(created.product);
    listings.push(...created.listings);
  }

  // Hata yerleşimi: ürün sırası seed'li olarak karıştırılır, ilk `totalDefects` ürüne birer hata yazılır.
  const order = rng.shuffle(products.map((_, index) => index));
  const indexByProduct = new Map(products.map((product, position) => [product.id, position]));
  const defectPositions = new Set(order.slice(0, totalDefects));
  const cleanProducts = products.filter((_, position) => !defectPositions.has(position));
  const context: DefectContext = { cleanProducts, indexByProduct, listings };
  let cursor = 0;
  for (const kind of kinds) {
    for (let count = 0; count < perKind; count += 1) {
      const target = order[cursor];
      cursor += 1;
      if (target === undefined) throw new Error('generateCatalog: hata yerleşimi taşdı.');
      const product = products[target];
      if (product === undefined) throw new Error('generateCatalog: ürün bulunamadı.');
      defects.push(applyDefect(product, kind, rng, context));
      byKind[kind] += 1;
    }
  }

  return {
    catalog: { products, listings },
    defects,
    meta: {
      seed,
      productCount,
      injectedCount: defects.length,
      byKind,
    },
  };
}

/** Yalnızca hatasız ürünlerden oluşan bir katalog (taban çizgisi testleri için). */
export function generateCleanCatalog(
  options: Omit<CatalogOptions, 'defectKinds' | 'defectsPerKind'>,
): Catalog {
  return generateCatalog({ ...options, defectKinds: [], defectsPerKind: 0 }).catalog;
}

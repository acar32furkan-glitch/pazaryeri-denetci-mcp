import { computeGtinCheckDigit, plainText, slugifyTr } from '@pazaryeri-denetci/core';

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
const VARIANTS_MIN = 1;
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
  const variants: Variant[] = Array.from({ length: variantCount }, (_, variantIndex) => {
    const cents = rng.int(PRICE_MIN_CENTS, PRICE_MAX_CENTS);
    const price = priceFromCents(cents);
    return {
      sku: `SNT-${pad(index + 1, 4)}-${pad(variantIndex + 1, 2)}`,
      barcode: buildBarcode(rng),
      price,
      compareAtPrice: rng.bool(0.4) ? priceFromCents(Math.round(cents * 1.25)) : null,
      options: [
        { name: 'Renk', value: color },
        { name: 'Beden', value: size },
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

/** Tek bir hatayı ürüne uygular ve etiketini döner. */
function applyDefect(product: Product, kind: DefectKind, rng: Rng): InjectedDefect {
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
      product.title =
        `${product.title} ${'Detaylı Ürün Açıklaması ve Sezon Bilgisi '.repeat(4)}`.trim();
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
  let cursor = 0;
  for (const kind of kinds) {
    for (let count = 0; count < perKind; count += 1) {
      const target = order[cursor];
      cursor += 1;
      if (target === undefined) throw new Error('generateCatalog: hata yerleşimi taşdı.');
      const product = products[target];
      if (product === undefined) throw new Error('generateCatalog: ürün bulunamadı.');
      defects.push(applyDefect(product, kind, rng));
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

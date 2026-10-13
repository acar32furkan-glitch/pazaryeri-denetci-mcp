import type { Catalog, ChannelListing, Product, Variant } from '../src/index.ts';

/** Sınır değer testlerinin okunabilir kalması için ortak ürün/varyant fabrikaları. */

export const VALID_EAN13 = '4006381333931';
export const VALID_EAN8 = '96385074';
export const VALID_UPC12 = '036000291452';

export function makeVariant(overrides: Partial<Variant> = {}): Variant {
  return {
    sku: 'SNT-0001-01',
    barcode: VALID_EAN13,
    price: 199.9,
    compareAtPrice: 249.9,
    options: [
      { name: 'Renk', value: 'Gri' },
      { name: 'Beden', value: 'M' },
    ],
    inventoryQuantity: 12,
    ...overrides,
  };
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'snt-prd-0001',
    handle: 'ornek-kazak-0001',
    title: 'Antrasit Yün Kazak Kadın Giyim',
    descriptionHtml:
      '<p>Antrasit yün kazak, günlük kullanım için uygundur ve mevsimlik koleksiyonun bir parçasıdır. Yumuşak dokusu ve nefes alan yapısıyla gün boyu rahatlık sağlar; ölçüleri ve bakım bilgileri ürün sayfasında listelenmiştir.</p>',
    vendor: 'Test Atölye',
    productType: 'Kazak',
    tags: ['sentetik'],
    status: 'active',
    seo: {
      title: 'Antrasit Yün Kazak | Test',
      description: 'Antrasit yün kazak kısa SEO açıklaması.',
    },
    images: [
      { url: 'https://cdn.test/1.jpg', altText: 'Kazak önden görünüm' },
      { url: 'https://cdn.test/2.jpg', altText: 'Kazak detay görünüm' },
      { url: 'https://cdn.test/3.jpg', altText: 'Kazak arka görünüm' },
    ],
    variants: [makeVariant()],
    metafields: [
      {
        namespace: 'sentetik',
        key: 'yas_grubu',
        type: 'single_line_text_field',
        value: 'Yetişkin',
      },
      { namespace: 'sentetik', key: 'materyal', type: 'single_line_text_field', value: 'Yün' },
      { namespace: 'sentetik', key: 'renk', type: 'single_line_text_field', value: 'Gri' },
    ],
    ...overrides,
  };
}

export function makeListing(overrides: Partial<ChannelListing> = {}): ChannelListing {
  return {
    channel: 'trendyol',
    sku: 'SNT-0001-01',
    price: 199.9,
    stock: 12,
    attributes: {},
    warnings: [],
    ...overrides,
  };
}

export function makeCatalog(products: Product[], listings: ChannelListing[] = []): Catalog {
  return { products, listings };
}

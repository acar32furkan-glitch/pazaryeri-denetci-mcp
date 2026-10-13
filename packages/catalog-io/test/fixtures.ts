import type { Catalog, Product } from '@pazaryeri-denetci/core';

/** Test yardımcıları: BOM'lu/Windows-1254 bayt dizileri ve örnek katalog. */

const UTF8_BOM = Uint8Array.from([0xef, 0xbb, 0xbf]);

/** Windows-1254'te ASCII dışı gerekli Türkçe karakterlerin bayt karşılıkları. */
const WIN1254_BYTES: Readonly<Record<string, number>> = {
  ı: 0xfd,
  İ: 0xdd,
  ş: 0xfe,
  Ş: 0xde,
  ğ: 0xf0,
  Ğ: 0xd0,
  ç: 0xe7,
  Ç: 0xc7,
  ö: 0xf6,
  Ö: 0xd6,
  ü: 0xfc,
  Ü: 0xdc,
};

/** Metni UTF-8 baytlarına çevirir; `bom` true ise başına EF BB BF ekler. */
export function utf8(text: string, bom = false): Uint8Array {
  const body = new TextEncoder().encode(text);
  if (!bom) return body;
  const out = new Uint8Array(body.length + UTF8_BOM.length);
  out.set(UTF8_BOM, 0);
  out.set(body, UTF8_BOM.length);
  return out;
}

/** Metni Windows-1254 baytlarına çevirir (yalnızca eşlenen Türkçe karakterler + ASCII). */
export function win1254(text: string): Uint8Array {
  const out: number[] = [];
  for (const character of text) {
    const byte = WIN1254_BYTES[character];
    if (byte !== undefined) {
      out.push(byte);
      continue;
    }
    const code = character.codePointAt(0) ?? 0;
    if (code > 0x7f) throw new Error(`Windows-1254 eşlemesi yok: "${character}"`);
    out.push(code);
  }
  return Uint8Array.from(out);
}

/** Tüm alanları dolu tek ürün + tek kanal beslemesi içeren örnek katalog. */
export function sampleCatalog(): Catalog {
  const product: Product = {
    id: 'snt-prd-0001',
    handle: 'antrasit-kazak',
    title: 'Antrasit Yün Kazak',
    descriptionHtml: '<p>Antrasit yün kazak.</p>',
    vendor: 'Test Atölye',
    productType: 'Kazak',
    tags: ['yeni', 'kış'],
    status: 'active',
    seo: { title: 'Antrasit Kazak | Test', description: 'Kısa açıklama.' },
    images: [
      { url: 'https://cdn.test/1.jpg', altText: 'Önden görünüm' },
      { url: 'https://cdn.test/2.jpg', altText: null },
    ],
    variants: [
      {
        sku: 'SNT-1-S',
        barcode: '4006381333931',
        price: 199.9,
        compareAtPrice: 249.9,
        options: [{ name: 'Renk', value: 'Gri' }],
        inventoryQuantity: 12,
      },
      {
        sku: null,
        barcode: null,
        price: null,
        compareAtPrice: null,
        options: [],
        inventoryQuantity: null,
      },
    ],
    metafields: [
      { namespace: 'sentetik', key: 'materyal', type: 'single_line_text_field', value: 'Yün' },
    ],
  };

  return {
    products: [product],
    listings: [
      {
        channel: 'trendyol',
        sku: 'SNT-1-S',
        price: 199.9,
        stock: 12,
        attributes: { renk: 'Gri', materyal: 'Yün' },
        warnings: ['stok düşük'],
      },
    ],
  };
}

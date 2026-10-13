import { describe, expect, it } from 'vitest';

import { exportCatalogJson, importCatalogJson } from '../src/index.ts';
import { sampleCatalog } from './fixtures.ts';

describe('exportCatalogJson', () => {
  it('iki boşluk girintili ve sonunda satır sonu olan JSON üretir', () => {
    expect(exportCatalogJson({ products: [], listings: [] })).toBe(
      '{\n  "products": [],\n  "listings": []\n}\n',
    );
  });

  it('deterministiktir: aynı girdi aynı çıktıyı verir', () => {
    const catalog = sampleCatalog();
    expect(exportCatalogJson(catalog)).toBe(exportCatalogJson(catalog));
  });

  it('anahtar sırası girdinin anahtar sırasından bağımsızdır', () => {
    const catalog = sampleCatalog();
    const product = catalog.products[0]!;
    const reorderedProduct = {
      metafields: product.metafields,
      variants: product.variants,
      images: product.images,
      seo: product.seo,
      status: product.status,
      tags: product.tags,
      productType: product.productType,
      vendor: product.vendor,
      descriptionHtml: product.descriptionHtml,
      title: product.title,
      handle: product.handle,
      id: product.id,
    };
    const reordered = { listings: catalog.listings, products: [reorderedProduct] };
    expect(exportCatalogJson(reordered)).toBe(exportCatalogJson(catalog));
  });

  it('attributes anahtarlarını sıralar', () => {
    const json = exportCatalogJson({
      products: [],
      listings: [
        {
          channel: 'trendyol',
          sku: null,
          price: null,
          stock: null,
          attributes: { zebra: '1', alfa: '2' },
          warnings: [],
        },
      ],
    });
    expect(json.indexOf('"alfa"')).toBeLessThan(json.indexOf('"zebra"'));
  });
});

describe('importCatalogJson', () => {
  it('dışa aktarılan katalog geri okunabilir (round-trip)', () => {
    const catalog = sampleCatalog();
    expect(importCatalogJson(exportCatalogJson(catalog))).toEqual(catalog);
  });

  it('bozuk JSON\u2019da anlamlı Türkçe mesajla hata atar', () => {
    expect(() => importCatalogJson('{ bozuk')).toThrow(/Geçersiz JSON/);
  });

  it('"products" dizisi yoksa anlamlı hata atar', () => {
    expect(() => importCatalogJson('{"listings":[]}')).toThrow(/products/);
  });

  it('kök nesne değilse anlamlı hata atar', () => {
    expect(() => importCatalogJson('[]')).toThrow(/kök değer bir nesne/);
  });

  it('"listings" alanı yoksa boş dizi varsayar', () => {
    expect(importCatalogJson('{"products":[]}').listings).toEqual([]);
  });

  it('eksik ürün alanlarını güvenli varsayılanlarla doldurur', () => {
    const catalog = importCatalogJson('{"products":[{"handle":"a"}]}');
    const product = catalog.products[0]!;
    expect(product.handle).toBe('a');
    expect(product.title).toBe('');
    expect(product.status).toBe('active');
    expect(product.tags).toEqual([]);
    expect(product.images).toEqual([]);
    expect(product.variants).toEqual([]);
    expect(product.metafields).toEqual([]);
    expect(product.seo).toEqual({ title: null, description: null });
  });
});

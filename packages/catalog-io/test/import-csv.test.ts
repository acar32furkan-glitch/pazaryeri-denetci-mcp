import { describe, expect, it } from 'vitest';

import { importCsv } from '../src/index.ts';
import { utf8, win1254 } from './fixtures.ts';

const codes = (result: ReturnType<typeof importCsv>): string[] =>
  result.warnings.map((item) => item.code);

describe('importCsv — boş ve başlıksız girdiler', () => {
  it('boş metinde EMPTY_FILE verir ve boş katalog döner', () => {
    const result = importCsv('');
    expect(codes(result)).toEqual(['EMPTY_FILE']);
    expect(result.catalog).toEqual({ products: [], listings: [] });
    expect(result.rowCount).toBe(0);
    expect(result.productCount).toBe(0);
    expect(result.skippedRows).toBe(0);
  });

  it('yalnızca boş satırlardan oluşan metinde EMPTY_FILE verir', () => {
    expect(codes(importCsv('\n\n  \n'))).toEqual(['EMPTY_FILE']);
  });

  it('başlık satırı tanınmıyorsa NO_HEADER verir ve boş katalog döner', () => {
    const result = importCsv('12,34,56\n78,90,11\n');
    expect(codes(result)).toEqual(['NO_HEADER']);
    expect(result.catalog.products).toEqual([]);
  });

  it('tek satırlık bozuk CSV çökmez', () => {
    expect(() => importCsv('tek-satirlik-basliksiz-icerik')).not.toThrow();
    expect(importCsv('tek-satirlik-basliksiz-icerik').catalog.products).toEqual([]);
  });
});

describe('importCsv — mutlu yol', () => {
  it('tek satırlık katalogu varsayılanlarla üretir', () => {
    const result = importCsv('handle,title,price\nalfa-kazak,Alfa Yün Kazak,199.90\n');
    expect(result.rowCount).toBe(1);
    expect(result.productCount).toBe(1);
    expect(result.skippedRows).toBe(0);
    expect(result.warnings).toEqual([]);

    const product = result.catalog.products[0]!;
    expect(product.id).toBe('alfa-kazak');
    expect(product.handle).toBe('alfa-kazak');
    expect(product.title).toBe('Alfa Yün Kazak');
    expect(product.status).toBe('active');
    expect(product.seo).toEqual({ title: null, description: null });
    expect(product.images).toEqual([]);
    expect(product.metafields).toEqual([]);
    expect(product.variants).toEqual([
      {
        sku: null,
        barcode: null,
        price: 199.9,
        compareAtPrice: null,
        options: [],
        inventoryQuantity: null,
      },
    ]);
    expect(result.catalog.listings).toEqual([]);
  });

  it('aynı handle yeni ürün açmaz, varyant ekler', () => {
    const csv =
      [
        'handle,title,price,sku,option_renk',
        'kazak,Kazak,100,KZ-S,Kırmızı',
        'kazak,Kazak,120,KZ-M,Lacivert',
      ].join('\n') + '\n';
    const result = importCsv(csv);
    expect(result.productCount).toBe(1);
    expect(result.warnings).toEqual([]);

    const product = result.catalog.products[0]!;
    expect(product.variants).toHaveLength(2);
    expect(product.variants[0]!.sku).toBe('KZ-S');
    expect(product.variants[1]!.sku).toBe('KZ-M');
    expect(product.variants[1]!.options).toEqual([{ name: 'Renk', value: 'Lacivert' }]);
  });

  it('Türkçe sayı biçimini, etiketleri, SEO ve durumu çözer', () => {
    const csv =
      [
        'handle,title,price,compare_at_price,stock,status,seo_title,seo_description,tags',
        '"a-canta","A Çanta","1.299,90","1.499,90","1.234","draft","A Çanta | Marka","Kısa açıklama","yeni;indirim;çanta"',
      ].join('\n') + '\n';
    const result = importCsv(csv);
    expect(result.warnings).toEqual([]);

    const product = result.catalog.products[0]!;
    expect(product.variants[0]!.price).toBe(1299.9);
    expect(product.variants[0]!.compareAtPrice).toBe(1499.9);
    expect(product.variants[0]!.inventoryQuantity).toBe(1234);
    expect(product.status).toBe('draft');
    expect(product.seo).toEqual({ title: 'A Çanta | Marka', description: 'Kısa açıklama' });
    expect(product.tags).toEqual(['yeni', 'indirim', 'çanta']);
  });

  it('görsel URL\u2019lerini alt metinlerle sıra ile eşleştirir; eksik alt metin null olur', () => {
    const csv =
      'handle,title,price,image_urls,image_alts\n' +
      'a,A,10,https://cdn/1.jpg;https://cdn/2.jpg;https://cdn/3.jpg,önden;detay\n';
    const result = importCsv(csv);
    expect(result.catalog.products[0]!.images).toEqual([
      { url: 'https://cdn/1.jpg', altText: 'önden' },
      { url: 'https://cdn/2.jpg', altText: 'detay' },
      { url: 'https://cdn/3.jpg', altText: null },
    ]);
  });

  it('options ve metafields yalnızca dolu sütunlardan üretilir', () => {
    const csv =
      'handle,title,price,option_renk,option_beden,metafield_materyal,metafield_yas_grubu\n' +
      'a,A,10,Kırmızı,,Pamuk,\n';
    const result = importCsv(csv);
    const product = result.catalog.products[0]!;
    expect(product.variants[0]!.options).toEqual([{ name: 'Renk', value: 'Kırmızı' }]);
    expect(product.metafields).toEqual([
      { namespace: 'sentetik', key: 'materyal', type: 'single_line_text_field', value: 'Pamuk' },
    ]);
  });
});

describe('importCsv — kodlama', () => {
  it('UTF-8 BOM\u2019unu soyarak okur', () => {
    const bytes = utf8('handle,title,price\nalfa,Alfa,10\n', true);
    const result = importCsv(bytes);
    expect(result.productCount).toBe(1);
    expect(result.catalog.products[0]!.handle).toBe('alfa');
  });

  it('Windows-1254 baytlarını Türkçe karakterlerle çözer', () => {
    const bytes = win1254('handle,title,price\ngunes-canta,Güneş Çanta,149.90\n');
    const result = importCsv(bytes);
    expect(result.productCount).toBe(1);
    expect(result.catalog.products[0]!.title).toBe('Güneş Çanta');
  });
});

describe('importCsv — uyarılar', () => {
  it('zorunlu kolon eksikse MISSING_COLUMN verir', () => {
    const result = importCsv('handle,title\nalfa,Alfa\n');
    expect(codes(result)).toContain('MISSING_COLUMN');
    const missing = result.warnings.find((item) => item.code === 'MISSING_COLUMN');
    expect(missing?.field).toBe('price');
  });

  it('alan sayısı uyuşmayan satırı atlar', () => {
    const csv = 'handle,title,price\nalfa,Alfa,10\nbeta,Betta,20,fazla\n';
    const result = importCsv(csv);
    expect(result.productCount).toBe(1);
    expect(result.skippedRows).toBe(1);
    expect(codes(result)).toContain('ROW_COLUMN_MISMATCH');
    const mismatch = result.warnings.find((item) => item.code === 'ROW_COLUMN_MISMATCH');
    expect(mismatch?.row).toBe(3);
  });

  it('zorunlu değer boşsa satırı atlar', () => {
    const csv = 'handle,title,price\n,Boş Handle,10\nbeta,,20\n';
    const result = importCsv(csv);
    expect(result.productCount).toBe(0);
    expect(result.skippedRows).toBe(2);
    expect(codes(result)).toEqual(['MISSING_REQUIRED_VALUE', 'MISSING_REQUIRED_VALUE']);
    expect(result.warnings[0]!.field).toBe('handle');
    expect(result.warnings[1]!.field).toBe('title');
  });

  it('price sayıya çevrilemezse INVALID_NUMBER verir ve satırı atlar', () => {
    const csv = 'handle,title,price\nalfa,Alfa,abc\nbeta,Betta,20\n';
    const result = importCsv(csv);
    expect(codes(result)).toContain('INVALID_NUMBER');
    expect(result.skippedRows).toBe(1);
    expect(result.productCount).toBe(1);
    expect(result.catalog.products[0]!.handle).toBe('beta');
  });

  it('stock tamsayıya çevrilemezse INVALID_INTEGER verir, değer null kalır', () => {
    const csv = 'handle,title,price,stock\na,A,10,abc\n';
    const result = importCsv(csv);
    expect(codes(result)).toContain('INVALID_INTEGER');
    expect(result.catalog.products[0]!.variants[0]!.inventoryQuantity).toBeNull();
  });

  it('geçersiz barkodda INVALID_BARCODE verir, değeri korur', () => {
    const csv = 'handle,title,price,barcode\na,A,10,4006381333932\n';
    const result = importCsv(csv);
    expect(codes(result)).toContain('INVALID_BARCODE');
    expect(result.catalog.products[0]!.variants[0]!.barcode).toBe('4006381333932');
  });

  it('geçerli barkodda INVALID_BARCODE vermez', () => {
    const csv = 'handle,title,price,barcode\na,A,10,4006381333931\n';
    expect(codes(importCsv(csv))).not.toContain('INVALID_BARCODE');
  });

  it('yinelenen SKU\u2019da DUPLICATE_SKU verir', () => {
    const csv = ['handle,title,price,sku', 'a,A,10,SKU-1', 'b,B,20,SKU-1'].join('\n') + '\n';
    const result = importCsv(csv);
    expect(codes(result)).toContain('DUPLICATE_SKU');
    expect(result.productCount).toBe(2);
  });

  it('aynı handle çelişkili durumla gelirse DUPLICATE_HANDLE_STATUS verir', () => {
    const csv = ['handle,title,price,status', 'a,A,10,active', 'a,A,20,draft'].join('\n') + '\n';
    const result = importCsv(csv);
    expect(codes(result)).toContain('DUPLICATE_HANDLE_STATUS');
    expect(result.catalog.products[0]!.status).toBe('active');
    expect(result.catalog.products[0]!.variants).toHaveLength(2);
  });

  it('maxRows aşılırsa TOO_MANY_ROWS verir ve fazla satırları işlemez', () => {
    const csv = 'handle,title,price\na,A,10\nb,B,20\nc,C,30\n';
    const result = importCsv(csv, { maxRows: 2 });
    expect(codes(result)).toContain('TOO_MANY_ROWS');
    expect(result.productCount).toBe(2);
    expect(result.rowCount).toBe(3);
    expect(result.skippedRows).toBe(1);
  });

  it('requiredColumns seçeneğine saygı duyar', () => {
    const withSku = importCsv('handle,title,price,sku\na,A,10,S\n', {
      requiredColumns: ['handle', 'title', 'sku'],
    });
    expect(withSku.warnings.some((item) => item.code === 'MISSING_COLUMN')).toBe(false);

    const withoutSku = importCsv('handle,title\na,A\n', {
      requiredColumns: ['handle', 'title', 'sku'],
    });
    expect(
      withoutSku.warnings.some((item) => item.code === 'MISSING_COLUMN' && item.field === 'sku'),
    ).toBe(true);
  });
});

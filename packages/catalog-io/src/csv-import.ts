/**
 * CSV → `Catalog` içe aktarma.
 *
 * Şema: ürün başına bir satır. Aynı `handle`'ı taşıyan satırlar aynı ürünün **varyantlarıdır**;
 * yeni ürün açılmaz. Kanal beslemesi üretilmez (`listings` her zaman boş dizi).
 *
 * Hata politikası: bozuk satırlar atlanır ve `skippedRows` sayılır; her atlama gerekçesiyle
 * birlikte bir `ImportWarning` üretir. Fonksiyon hiçbir koşulda çökmez.
 */

import { checkGtin } from '@pazaryeri-denetci/core';
import type {
  Catalog,
  Metafield,
  Product,
  ProductImage,
  ProductStatus,
  SeoMeta,
  Variant,
  VariantOption,
} from '@pazaryeri-denetci/core';
import { parse } from 'csv-parse/sync';

import { decodeBytes } from './encoding.ts';
import { parseTrInteger, parseTrNumber } from './tr-number.ts';
import type { ImportWarning, ImportWarningCode } from './warnings.ts';

/** Zorunlu CSVit kolonları: başlıkta bulunması gereken en küçük küme. */
export const MINIMAL_CSV_COLUMNS: readonly string[] = ['handle', 'title', 'price'];

/** Tanınan tüm kolon adları (küçük harfe indirgenmiş hâliyle karşılaştırılır). */
const KNOWN_COLUMNS: readonly string[] = [
  'handle',
  'title',
  'sku',
  'barcode',
  'price',
  'compare_at_price',
  'stock',
  'description_html',
  'vendor',
  'product_type',
  'tags',
  'status',
  'seo_title',
  'seo_description',
  'image_urls',
  'image_alts',
  'option_renk',
  'option_beden',
  'metafield_yas_grubu',
  'metafield_materyal',
  'metafield_renk',
];

/** `option_*` kolonlarından üretilecek varyant seçenekleri. */
const OPTION_COLUMNS: readonly { readonly column: string; readonly name: string }[] = [
  { column: 'option_renk', name: 'Renk' },
  { column: 'option_beden', name: 'Beden' },
];

/** `metafield_*` kolonlarından üretilecek metafield'ler (namespace: `sentetik`). */
const METAFIELD_COLUMNS: readonly { readonly column: string; readonly key: string }[] = [
  { column: 'metafield_yas_grubu', key: 'yas_grubu' },
  { column: 'metafield_materyal', key: 'materyal' },
  { column: 'metafield_renk', key: 'renk' },
];

const METAFIELD_NAMESPACE = 'sentetik';
const METAFIELD_TYPE = 'single_line_text_field';
const HEADER_ROW_NUMBER = 1;

/** İçe aktarma seçenekleri. */
export interface CsvImportOptions {
  /** Zorunlu kolonlar; verilmezse `MINIMAL_CSV_COLUMNS` kullanılır. */
  requiredColumns?: string[];
  /** İşlenecek en fazla veri satırı; aşılırsa `TOO_MANY_ROWS` uyarısı verilir. */
  maxRows?: number;
}

/** İçe aktarma sonucu. */
export interface ImportResult {
  catalog: Catalog;
  warnings: ImportWarning[];
  /** Dosyadaki veri satırı sayısı (başlık hariç). */
  rowCount: number;
  /** Üretilen ürün sayısı. */
  productCount: number;
  /** Hiçbir varyant üretmeyen (atlanan) satır sayısı. */
  skippedRows: number;
}

type ColumnIndex = ReadonlyMap<string, number>;

function warning(
  row: number,
  field: string | null,
  code: ImportWarningCode,
  message: string,
): ImportWarning {
  return { row, field, code, message };
}

/** Başlık adını küçük harfe indirger; Türkçe metinlerde `toLocaleLowerCase` karakteri bozmaz. */
function normalizeHeaderName(value: string): string {
  return value.trim().toLowerCase();
}

function cell(row: readonly string[], columns: ColumnIndex, name: string): string {
  const index = columns.get(name);
  if (index === undefined) return '';
  return row[index] ?? '';
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** `;` ile ayrılmış alanı boş parçaları da koruyarak diziye çevirir (görsel hizalaması için). */
function splitRaw(value: string): string[] {
  return value.split(';');
}

/** Etiketleri `;` ile ayırır, boşları atar. */
function splitTags(value: string): string[] {
  return value
    .split(';')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');
}

function isProductStatus(value: string): value is ProductStatus {
  return value === 'active' || value === 'draft' || value === 'archived';
}

function normalizeStatus(raw: string): ProductStatus {
  const value = raw.trim().toLowerCase();
  return isProductStatus(value) ? value : 'active';
}

function buildColumns(headerRow: readonly string[]): ColumnIndex {
  const columns = new Map<string, number>();
  for (let index = 0; index < headerRow.length; index += 1) {
    const name = normalizeHeaderName(headerRow[index] ?? '');
    if (name !== '' && !columns.has(name)) columns.set(name, index);
  }
  return columns;
}

function hasKnownColumn(columns: ColumnIndex): boolean {
  return KNOWN_COLUMNS.some((name) => columns.has(name));
}

function buildOptions(row: readonly string[], columns: ColumnIndex): VariantOption[] {
  const options: VariantOption[] = [];
  for (const { column, name } of OPTION_COLUMNS) {
    const value = cell(row, columns, column).trim();
    if (value !== '') options.push({ name, value });
  }
  return options;
}

function buildMetafields(row: readonly string[], columns: ColumnIndex): Metafield[] {
  const metafields: Metafield[] = [];
  for (const { column, key } of METAFIELD_COLUMNS) {
    const value = cell(row, columns, column).trim();
    if (value !== '') {
      metafields.push({ namespace: METAFIELD_NAMESPACE, key, type: METAFIELD_TYPE, value });
    }
  }
  return metafields;
}

function buildSeo(row: readonly string[], columns: ColumnIndex): SeoMeta {
  return {
    title: nullable(cell(row, columns, 'seo_title')),
    description: nullable(cell(row, columns, 'seo_description')),
  };
}

/** `image_urls` ile `image_alts`'ı **sıra ile** eşleştirir; eksik alt metin `null` olur. */
function buildImages(row: readonly string[], columns: ColumnIndex): ProductImage[] {
  const urls = splitRaw(cell(row, columns, 'image_urls'));
  const alts = splitRaw(cell(row, columns, 'image_alts'));
  const images: ProductImage[] = [];
  for (let index = 0; index < urls.length; index += 1) {
    const url = (urls[index] ?? '').trim();
    if (url === '') continue;
    images.push({ url, altText: nullable(alts[index] ?? '') });
  }
  return images;
}

/** CSV metnini `string[][]` olarak ayrıştırır; ayrıştırma hatasında boş dizi döner (çökmemeli). */
function parseRecords(text: string): string[][] {
  if (text.trim() === '') return [];
  try {
    return parse(text, {
      bom: false,
      delimiter: ',',
      relax_column_count: true,
      skip_empty_lines: true,
      trim: false,
    });
  } catch {
    return [];
  }
}

function emptyResult(importWarning: ImportWarning): ImportResult {
  return {
    catalog: { products: [], listings: [] },
    warnings: [importWarning],
    rowCount: 0,
    productCount: 0,
    skippedRows: 0,
  };
}

/**
 * CSV baytlarını (veya metni) `Catalog`'a çevirir.
 *
 * - Başlık satırı yok/boşsa: `EMPTY_FILE` veya `NO_HEADER`, boş katalog döner.
 * - Zorunlu kolon eksikse: `MISSING_COLUMN` (satırlar yine de işlenmeye çalışılır).
 * - Alan sayısı başlıkla uyuşmayan satır atlanır: `ROW_COLUMN_MISMATCH`.
 * - `handle`/`title` boşsa atlanır: `MISSING_REQUIRED_VALUE`.
 * - `price` sayıya çevrilemezse atlanır: `INVALID_NUMBER`.
 * - Aynı `handle` tekrar ederse yeni ürün açılmaz, varyant eklenir; durum çelişirse
 *   `DUPLICATE_HANDLE_STATUS` bildirilir.
 * - Aynı `sku` tekrar ederse `DUPLICATE_SKU`; barkod geçersizse `INVALID_BARCODE` bildirilir.
 * - `maxRows` aşılırsa `TOO_MANY_ROWS` bildirilir ve fazla satırlar işlenmez.
 */
export function importCsv(
  input: Uint8Array | string,
  options: CsvImportOptions = {},
): ImportResult {
  const text = typeof input === 'string' ? input.replace(/^\uFEFF/, '') : decodeBytes(input).text;
  const records = parseRecords(text);

  if (records.length === 0) {
    return emptyResult(
      warning(0, null, 'EMPTY_FILE', 'CSV boş: içe aktarılacak satır bulunamadı.'),
    );
  }

  const headerRow = records[0];
  if (headerRow === undefined) {
    return emptyResult(
      warning(0, null, 'EMPTY_FILE', 'CSV boş: içe aktarılacak satır bulunamadı.'),
    );
  }

  const columns = buildColumns(headerRow);
  if (!hasKnownColumn(columns)) {
    return emptyResult(
      warning(
        HEADER_ROW_NUMBER,
        null,
        'NO_HEADER',
        'Başlık satırı tanınamadı: bilinen kolon adları bulunamadı.',
      ),
    );
  }

  const warnings: ImportWarning[] = [];

  const requiredColumns = options.requiredColumns ?? MINIMAL_CSV_COLUMNS;
  for (const name of requiredColumns) {
    if (!columns.has(name)) {
      warnings.push(
        warning(HEADER_ROW_NUMBER, name, 'MISSING_COLUMN', `Zorunlu kolon eksik: "${name}".`),
      );
    }
  }

  const dataRows = records.slice(1);
  const rowCount = dataRows.length;

  const maxRows = options.maxRows;
  let skippedRows = 0;
  let rowsToProcess = dataRows;
  if (maxRows !== undefined && rowCount > maxRows) {
    const overflow = rowCount - maxRows;
    skippedRows = overflow;
    rowsToProcess = dataRows.slice(0, maxRows);
    warnings.push(
      warning(
        maxRows + 2,
        null,
        'TOO_MANY_ROWS',
        `Satır sayısı üst sınırı aştı (maxRows=${maxRows}); ${overflow} satır işlenmedi.`,
      ),
    );
  }

  const byHandle = new Map<string, Product>();
  const seenSkus = new Set<string>();

  for (let index = 0; index < rowsToProcess.length; index += 1) {
    const row = rowsToProcess[index];
    if (row === undefined) continue;
    const rowNumber = index + 2;

    if (row.length !== headerRow.length) {
      warnings.push(
        warning(
          rowNumber,
          null,
          'ROW_COLUMN_MISMATCH',
          `Alan sayısı (${row.length}) başlıktaki kolon sayısıyla (${headerRow.length}) uyuşmuyor; satır atlandı.`,
        ),
      );
      skippedRows += 1;
      continue;
    }

    const handle = cell(row, columns, 'handle').trim();
    if (handle === '') {
      warnings.push(
        warning(rowNumber, 'handle', 'MISSING_REQUIRED_VALUE', 'Zorunlu değer boş: "handle".'),
      );
      skippedRows += 1;
      continue;
    }

    const title = cell(row, columns, 'title').trim();
    if (title === '') {
      warnings.push(
        warning(rowNumber, 'title', 'MISSING_REQUIRED_VALUE', 'Zorunlu değer boş: "title".'),
      );
      skippedRows += 1;
      continue;
    }

    const priceRaw = cell(row, columns, 'price').trim();
    const price = parseTrNumber(priceRaw);
    if (price === null) {
      warnings.push(
        warning(rowNumber, 'price', 'INVALID_NUMBER', `"price" sayıya çevrilemedi: "${priceRaw}".`),
      );
      skippedRows += 1;
      continue;
    }

    const compareRaw = cell(row, columns, 'compare_at_price').trim();
    let compareAtPrice: number | null = null;
    if (compareRaw !== '') {
      compareAtPrice = parseTrNumber(compareRaw);
      if (compareAtPrice === null) {
        warnings.push(
          warning(
            rowNumber,
            'compare_at_price',
            'INVALID_NUMBER',
            `"compare_at_price" sayıya çevrilemedi: "${compareRaw}".`,
          ),
        );
      }
    }

    const stockRaw = cell(row, columns, 'stock').trim();
    let inventoryQuantity: number | null = null;
    if (stockRaw !== '') {
      const stock = parseTrInteger(stockRaw);
      if (stock === null) {
        warnings.push(
          warning(
            rowNumber,
            'stock',
            'INVALID_INTEGER',
            `"stock" tamsayıya çevrilemedi: "${stockRaw}".`,
          ),
        );
      } else {
        inventoryQuantity = stock;
      }
    }

    const sku = cell(row, columns, 'sku').trim();
    if (sku !== '') {
      if (seenSkus.has(sku)) {
        warnings.push(
          warning(
            rowNumber,
            'sku',
            'DUPLICATE_SKU',
            `"${sku}" SKU'su birden fazla satırda görüldü.`,
          ),
        );
      } else {
        seenSkus.add(sku);
      }
    }

    const barcode = cell(row, columns, 'barcode').trim();
    if (barcode !== '') {
      const gtin = checkGtin(barcode);
      if (!gtin.valid) {
        warnings.push(
          warning(
            rowNumber,
            'barcode',
            'INVALID_BARCODE',
            `"${barcode}" geçerli bir GTIN değil (${gtin.reason ?? 'bilinmeyen neden'}).`,
          ),
        );
      }
    }

    const variant: Variant = {
      sku: nullable(sku),
      barcode: nullable(barcode),
      price,
      compareAtPrice,
      options: buildOptions(row, columns),
      inventoryQuantity,
    };
    const status = normalizeStatus(cell(row, columns, 'status'));

    const existing = byHandle.get(handle);
    if (existing === undefined) {
      byHandle.set(handle, {
        id: handle,
        handle,
        title,
        descriptionHtml: cell(row, columns, 'description_html').trim(),
        vendor: cell(row, columns, 'vendor').trim(),
        productType: cell(row, columns, 'product_type').trim(),
        tags: splitTags(cell(row, columns, 'tags')),
        status,
        seo: buildSeo(row, columns),
        images: buildImages(row, columns),
        variants: [variant],
        metafields: buildMetafields(row, columns),
      });
    } else {
      if (existing.status !== status) {
        warnings.push(
          warning(
            rowNumber,
            'status',
            'DUPLICATE_HANDLE_STATUS',
            `"${handle}" handle'ı için çelişkili durum: ilk satır "${existing.status}", bu satır "${status}".`,
          ),
        );
      }
      existing.variants.push(variant);
    }
  }

  const products = [...byHandle.values()];
  return {
    catalog: { products, listings: [] },
    warnings,
    rowCount,
    productCount: products.length,
    skippedRows,
  };
}

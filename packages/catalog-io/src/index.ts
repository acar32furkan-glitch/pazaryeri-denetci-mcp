/**
 * Katalog içe/dışa aktarma paketi.
 *
 * - CSV içe aktarma: BOM/Windows-1254 kodlama sezgisi, Türkçe sayı biçimi (`1.299,90`) ve
 *   satır bazlı uyarılar (`ImportWarning`).
 * - JSON dışa/içe aktarma: anahtar sırası sabit, 2 boşluk girintili deterministik çıktı.
 */
export const PACKAGE_NAME = '@pazaryeri-denetci/catalog-io';

export { decodeBytes, detectEncoding, hasUtf8Bom } from './encoding.ts';
export type { DecodeResult, EncodingName } from './encoding.ts';

export { parseTrInteger, parseTrNumber } from './tr-number.ts';

export type { ImportWarning, ImportWarningCode } from './warnings.ts';

export { MINIMAL_CSV_COLUMNS, importCsv } from './csv-import.ts';
export type { CsvImportOptions, ImportResult } from './csv-import.ts';

export { exportCatalogJson, importCatalogJson } from './json-io.ts';

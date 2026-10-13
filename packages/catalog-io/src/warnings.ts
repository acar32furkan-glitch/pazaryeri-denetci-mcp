/**
 * İçe aktarma uyarıları.
 *
 * İçe aktarma "ya hep ya hiç" değildir: bozuk satırlar atlanır, ama neden atlandığı
 * kullanıcıya satır numarası ve alan adıyla bildirilir. Bu dosya yalnızca tipleri tutar;
 * uyarı üretimi `csv-import.ts` içindedir.
 */

/** Uyarı kodları — kararlı, makine tarafından okunabilir kimlikler. */
export type ImportWarningCode =
  | 'EMPTY_FILE'
  | 'NO_HEADER'
  | 'MISSING_COLUMN'
  | 'ROW_COLUMN_MISMATCH'
  | 'INVALID_NUMBER'
  | 'INVALID_INTEGER'
  | 'MISSING_REQUIRED_VALUE'
  | 'DUPLICATE_HANDLE_STATUS'
  | 'DUPLICATE_SKU'
  | 'INVALID_BARCODE'
  | 'TOO_MANY_ROWS';

/** Tek bir içe aktarma uyarısı. `row`: CSV satır numarası (başlık = 1); yapısal uyarılarda 0. */
export interface ImportWarning {
  row: number;
  field: string | null;
  code: ImportWarningCode;
  message: string;
}

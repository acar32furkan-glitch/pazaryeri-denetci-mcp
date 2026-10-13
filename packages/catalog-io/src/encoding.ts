/**
 * Bayt → metin kod çözümü.
 *
 * İki kodlamayı destekliyoruz: UTF-8 (BOM'lı veya BOM'suz) ve Windows-1254
 * (`latin5`; Microsoft Excel'in Türkçe yerel ayarında kaydettiği kodlama). Seçim
 * sezgiseldir: bayt dizisi geçerli UTF-8 ise UTF-8, değilse Windows-1254 kabul edilir.
 *
 * Çözme için Node'un yerleşik `TextDecoder`'ı kullanılır; `windows-1254` kod çözücüsü
 * ICU tarafından sağlanır. Böylece ek bir CJS paketlemesine ve modül etkileşimi
 * (interop) ayarına gerek kalmaz.
 */

/** Desteklenen kodlama adları. */
export type EncodingName = 'utf-8' | 'windows-1254';

/** `decodeBytes` sonucu: çözülen metin, seçilen kodlama ve BOM varlığı. */
export interface DecodeResult {
  text: string;
  encoding: EncodingName;
  hadBom: boolean;
}

/** UTF-8 bayt sırası işareti (BOM): EF BB BF. */
const UTF8_BOM_FIRST = 0xef;
const UTF8_BOM_SECOND = 0xbb;
const UTF8_BOM_THIRD = 0xbf;

/** Bayt dizisinin başında UTF-8 BOM var mı? */
export function hasUtf8Bom(bytes: Uint8Array): boolean {
  if (bytes[0] !== UTF8_BOM_FIRST || bytes[1] !== UTF8_BOM_SECOND || bytes[2] !== UTF8_BOM_THIRD) {
    return false;
  }
  return bytes.length >= 3;
}

/**
 * Bayt dizisinin geçerli UTF-8 olup olmadığını kesin (fatal) çözümlemeyle sınar.
 * Kısmi/geçersiz dizilerde `TextDecoder` hata atar; bu bize kodlama ayrımını verir.
 */
function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Bayt dizisinin kodlamasını sezgisel olarak belirler.
 *
 * - Boş dizi → `utf-8` (boş metin her iki kodlamada da geçerlidir).
 * - UTF-8 BOM → `utf-8`.
 * - Geçerli UTF-8 → `utf-8`.
 * - Aksi halde (geçersiz UTF-8 ama Windows-1254'te anlamlı, ör. 0xFD `ı`) → `windows-1254`.
 */
export function detectEncoding(bytes: Uint8Array): EncodingName {
  if (bytes.length === 0) return 'utf-8';
  if (hasUtf8Bom(bytes)) return 'utf-8';
  return isValidUtf8(bytes) ? 'utf-8' : 'windows-1254';
}

/** Bayt dizisini metne çevirir; UTF-8 ise BOM'u kaldırır ve `hadBom` ile bildirir. */
export function decodeBytes(bytes: Uint8Array): DecodeResult {
  const encoding = detectEncoding(bytes);
  const hadBom = hasUtf8Bom(bytes);

  if (encoding === 'windows-1254') {
    return { text: new TextDecoder('windows-1254').decode(bytes), encoding, hadBom: false };
  }

  const body = hadBom ? bytes.subarray(3) : bytes;
  return { text: new TextDecoder('utf-8').decode(body), encoding, hadBom };
}

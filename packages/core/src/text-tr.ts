/**
 * Türkçe metin yardımcıları.
 *
 * `toLocaleLowerCase('tr')` / `toLocaleUpperCase('tr')` kullanmak zorunludur: Türkçe'de
 * I→ı ve İ→i eşlemesi varsayılan (İngilizce) yerelde yanlış sonuç verir; "INDIRIM" kelimesi
 * varsayılan yerelde "indirim" değil "ındırım" olur ve arama/eşleştirme sessizce bozulur.
 */

const TR_ASCII: Readonly<Record<string, string>> = {
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ı: 'i',
  İ: 'i',
  ö: 'o',
  Ö: 'o',
  ş: 's',
  Ş: 's',
  ü: 'u',
  Ü: 'u',
};

export function lowerTr(value: string): string {
  return value.toLocaleLowerCase('tr-TR');
}

export function upperTr(value: string): string {
  return value.toLocaleUpperCase('tr-TR');
}

/** Türkçe karakterleri ASCII'ye indirip `handle`/slug üretir. */
export function slugifyTr(value: string): string {
  const lowered = lowerTr(value);
  const mapped = lowered.replace(/[çğıöşü]/gu, (character) => TR_ASCII[character] ?? character);
  return mapped.replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
}

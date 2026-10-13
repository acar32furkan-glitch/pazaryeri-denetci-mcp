/**
 * GTIN/EAN barkod doğrulaması (GS1 mod-10 sağlama toplamı).
 *
 * Bu dosya saf fonksiyonlardan oluşur; üretici (`mock-data`) de geçerli barkod üretmek için
 * `computeGtinCheckDigit` fonksiyonunu buradan kullanır — böylece doğrulayıcı ve üretici
 * aynı algoritmayı paylaşır ve testler ikisini birbirine karşı çapraz doğrular.
 */

export type GtinFormat = 'GTIN-8' | 'GTIN-12' | 'GTIN-13' | 'GTIN-14';

const FORMAT_BY_LENGTH: Readonly<Record<number, GtinFormat>> = {
  8: 'GTIN-8',
  12: 'GTIN-12',
  13: 'GTIN-13',
  14: 'GTIN-14',
};

export interface GtinCheck {
  valid: boolean;
  format: GtinFormat | null;
  reason: string | null;
}

function toDigits(value: string): number[] | null {
  const digits: number[] = [];
  for (const character of value) {
    if (character < '0' || character > '9') return null;
    digits.push(Number(character));
  }
  return digits;
}

/**
 * Sağdan sola doğru 3-1-3-1 ağırlıklarıyla sağlama basamağını hesaplar.
 * `body` sağlama basamağı hariç gövdedir (ör. EAN-13 için 12 hane).
 */
export function computeGtinCheckDigit(body: string): number {
  const digits = toDigits(body);
  if (digits === null || digits.length === 0) {
    throw new Error(`Sağlama basamağı hesaplanamaz: "${body}" rakamlardan oluşmuyor.`);
  }
  let sum = 0;
  let weight = 3;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    sum += (digits[index] ?? 0) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10;
}

/** Barkodun biçimini ve sağlama toplamını doğrular. */
export function checkGtin(raw: string | null | undefined): GtinCheck {
  const value = (raw ?? '').trim();
  if (value === '') {
    return { valid: false, format: null, reason: 'barkod boş' };
  }
  const digits = toDigits(value);
  if (digits === null) {
    return { valid: false, format: null, reason: 'rakam dışı karakter içeriyor' };
  }
  const format = FORMAT_BY_LENGTH[digits.length];
  if (format === undefined) {
    return { valid: false, format: null, reason: `desteklenmeyen uzunluk (${digits.length} hane)` };
  }
  const body = value.slice(0, -1);
  const expected = computeGtinCheckDigit(body);
  const actual = digits[digits.length - 1] ?? -1;
  if (expected !== actual) {
    return { valid: false, format, reason: `sağlama basamağı hatalı (beklenen ${expected})` };
  }
  return { valid: true, format, reason: null };
}

/**
 * Türkçe sayı biçimi ayrıştırma.
 *
 * Türkçe (ve genel olarak Avrupa) biçiminde binlik ayıracı `.`, ondalık ayıracı `,`'dır;
 * İngilizce biçimde roller terstir. Tek başına `1.299` iki şekilde okunabilir. Bu yüzden
 * kural şudur: **son ayıraç ondalık ayıraç adayıdır ve yalnızca ardından 1–2 hane geliyorsa
 * ondalık sayılır**; aksi halde binlik ayıraçtır (`1.299` → 1299, `1.299,90` → 1299.9).
 */

/** Yalnızca rakam, `.`, `,` ve `-` karakterlerini bırakır (para simgesi/boşluk/harf atılır). */
function extractNumericCharacters(raw: string): string {
  let cleaned = '';
  for (const character of raw) {
    if (
      (character >= '0' && character <= '9') ||
      character === '.' ||
      character === ',' ||
      character === '-'
    ) {
      cleaned += character;
    }
  }
  return cleaned;
}

/** Metin içinde en az bir rakam var mı? */
function containsDigit(value: string): boolean {
  for (const character of value) {
    if (character >= '0' && character <= '9') return true;
  }
  return false;
}

/**
 * `1.299,90` → 1299.9 · `1299.90` → 1299.9 · `1.299` → 1299 · `1,299.90` → 1299.9 ·
 * `129,90` → 129.9 · `₺ 1.299,90` → 1299.9 · `1.299,90 TL` → 1299.9 · `0` → 0.
 * Boş, `-` veya yalnızca harflerden oluşan girdilerde `null` döner.
 */
export function parseTrNumber(raw: string): number | null {
  const cleaned = extractNumericCharacters(raw.trim());
  if (cleaned === '' || !containsDigit(cleaned)) return null;

  let negative = false;
  let body = cleaned;
  if (body.startsWith('-')) {
    negative = true;
    body = body.slice(1);
  }
  // İşaret dışında kalan `-` belirsizdir: reddet.
  if (body.includes('-')) return null;

  const lastDot = body.lastIndexOf('.');
  const lastComma = body.lastIndexOf(',');
  const lastSeparator = lastDot > lastComma ? lastDot : lastComma;

  let integerPart = body;
  let fractionPart = '';
  if (lastSeparator >= 0) {
    const tail = body.slice(lastSeparator + 1);
    if (/^[0-9]{1,2}$/.test(tail)) {
      integerPart = body.slice(0, lastSeparator);
      fractionPart = tail;
    }
  }

  const integerDigits = integerPart.replace(/[.,]/g, '');
  if (integerDigits === '' && fractionPart === '') return null;

  const normalized = `${negative ? '-' : ''}${integerDigits === '' ? '0' : integerDigits}${
    fractionPart === '' ? '' : `.${fractionPart}`
  }`;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Stok gibi tam sayı alanları için ayrıştırıcı. `parseTrNumber` kurallarını kullanır;
 * negatif değerleri ve sayıya çevrilemeyen girdileri reddeder (`null`).
 * `1.234` → 1234 · `12` → 12 · `12,0` → 12 · `-3` → null · `abc` → null.
 */
export function parseTrInteger(raw: string): number | null {
  const value = parseTrNumber(raw);
  if (value === null || value < 0) return null;
  const rounded = Math.round(value);
  return Object.is(rounded, -0) ? 0 : rounded;
}

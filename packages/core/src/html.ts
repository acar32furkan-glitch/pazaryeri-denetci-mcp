/**
 * HTML'den düz metin çıkarma yardımcıları.
 *
 * Not: Bu fonksiyonlar **güvenlik temizliği değildir**; yalnızca içerik uzunluğu/boşluk
 * ölçümü için metin çıkarır. XSS temizliği ayrı bir modüldür (Faz 2).
 */

const TAG_PATTERN = /<[^>]*>/gu;
const ENTITY_PATTERN = /&[a-z0-9#]+;/giu;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
};

export function plainText(html: string): string {
  return html
    .replace(TAG_PATTERN, ' ')
    .replace(ENTITY_PATTERN, (match) => NAMED_ENTITIES[match.toLowerCase()] ?? ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function plainTextLength(html: string): number {
  return plainText(html).length;
}

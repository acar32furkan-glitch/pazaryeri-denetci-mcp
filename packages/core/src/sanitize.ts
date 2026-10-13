/**
 * HTML güvenlik yardımcıları.
 *
 * İki ayrı iş yapılır ve bilinçli olarak ayrı tutulur:
 * - `containsUnsafeHtml`: denetim kuralının (DESC_UNSAFE_HTML) karar vericisi.
 * - `sanitizeHtml`: içeriği **gösterirken** çalıştırılacak temizleyici (XSS savunması).
 *
 * Buradaki temizleyici bir tarayıcı sınıfı kütüphanesi değildir; izin listesi yaklaşımıyla
 * tehlikeli etiket ve öznitelikleri atar. Nihai güvenlik sınırı her zaman tarayıcıdır
 * (kullanıcı içeriği asla `innerHTML` ile doğrudan basılmaz).
 */

const UNSAFE_PAIRED =
  /<\s*(script|style|iframe|object|embed|svg|math|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/iu;
const UNSAFE_OPEN =
  /<\s*(script|style|iframe|object|embed|svg|math|link|meta|base|form|input|button)\b[^>]*>/iu;
const EVENT_ATTRIBUTE = /\son[a-z]+\s*=/iu;
const DANGEROUS_URL =
  /(href|src|xlink:href)\s*=\s*["']?\s*(javascript|vbscript|data:text\/html)\s*:/iu;

const UNSAFE_PAIRED_G = new RegExp(UNSAFE_PAIRED.source, 'giu');
const UNSAFE_OPEN_G = new RegExp(UNSAFE_OPEN.source, 'giu');
const EVENT_ATTRIBUTE_G = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/giu;
const DANGEROUS_URL_G = new RegExp(DANGEROUS_URL.source, 'giu');

export function containsUnsafeHtml(html: string): boolean {
  return (
    UNSAFE_PAIRED.test(html) ||
    UNSAFE_OPEN.test(html) ||
    EVENT_ATTRIBUTE.test(html) ||
    DANGEROUS_URL.test(html)
  );
}

/** Tehlikeli etiketleri, olay işleyici özniteliklerini ve `javascript:` bağlantılarını atar. */
export function sanitizeHtml(html: string): string {
  return html
    .replace(UNSAFE_PAIRED_G, '')
    .replace(UNSAFE_OPEN_G, '')
    .replace(EVENT_ATTRIBUTE_G, '')
    .replace(DANGEROUS_URL_G, '$1="#"');
}

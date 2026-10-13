import { lowerTr, slugifyTr } from '../text-tr.ts';
import { truncateEvidence } from '../rule.ts';
import type { Rule } from '../rule.ts';

/**
 * TR_TEXT_QUALITY — Türkçe yerel ayarı ve kodlama tutarlılığı.
 *
 * İki somut, kanıtlanabilir bozukluk aranır (soyut "Türkçe kötü" yargısı değil):
 * (a) **Kodlama bozulması**: UTF-8 metnin Latin-1/Windows-1254 varsayımıyla okunmasından doğan
 *     `Ã¼`, `Ä±`, `ÅŸ` gibi diziler ya da yerine koyma karakteri (U+FFFD).
 * (b) **Yerel ayarı yanlış küçültme**: `İ` harfinin varsayılan `toLowerCase()` ile küçültülmesi
 *     "i̇" (i + U+0307 birleşik nokta) üretir. Doğrusu `toLocaleLowerCase('tr')` → "i". Bir
 *     handle/slug içinde U+0307 görülmesi, dönüşümün yanlış yerelde yapıldığının kanıtıdır.
 */
export const MOJIBAKE_TOKENS: readonly string[] = ['Ã', 'Ä±', 'Ä°', 'ÄŸ', 'ÅŸ', 'Åž', '\uFFFD'];

export const COMBINING_DOT = '\u0307';

export function findMojibake(value: string): string | null {
  for (const token of MOJIBAKE_TOKENS) {
    const index = value.indexOf(token);
    if (index === -1) continue;
    const start = Math.max(0, index - 12);
    return value.slice(start, index + 12);
  }
  return null;
}

/** Varsayılan yerel ile TR yerelinin farklı sonuç verdiği kelimeler (ör. "İNDİRİMLİ"). */
export function localeSensitiveWords(text: string): string[] {
  return text
    .split(/\s+/u)
    .map((word) => word.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter((word) => word !== '')
    .filter((word) => word.toLowerCase() !== lowerTr(word));
}

export const trTextQualityRule: Rule = {
  id: 'TR_TEXT_QUALITY',
  severity: 'major',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'Türkçe metin kalitesi',
  description:
    'Türkçe karakterler kodlama sırasında bozulmuş ya da büyük/küçük harf dönüşümü TR yereli yerine varsayılan yerelde yapılmış.',
  check({ product }) {
    const textFields: readonly [string, string][] = [
      ['title', product.title],
      ['descriptionHtml', product.descriptionHtml],
      ['seo.title', product.seo.title ?? ''],
      ['seo.description', product.seo.description ?? ''],
    ];

    for (const [field, value] of textFields) {
      const mojibake = findMojibake(value);
      if (mojibake === null) continue;
      return [
        {
          ruleId: 'TR_TEXT_QUALITY',
          severity: 'major',
          productId: product.id,
          variantSku: null,
          field,
          message: `${field} alanında kodlama bozulması var ("…${mojibake}…"); içe aktarma yanlış kodlamayla okunmuş.`,
          fixHint:
            "CSV dosyasını UTF-8 (BOM'lu) olarak dışa aktarın ve içe aktarmada kodlamayı açıkça belirtin (Windows-1254 kaynaklar için dönüştürücü kullanın).",
          evidence: truncateEvidence(mojibake),
        },
      ];
    }

    const localeFields: readonly [string, string][] = [['handle', product.handle], ...textFields];
    for (const [field, value] of localeFields) {
      if (!value.includes(COMBINING_DOT)) continue;
      const words = localeSensitiveWords(product.title);
      return [
        {
          ruleId: 'TR_TEXT_QUALITY',
          severity: 'major',
          productId: product.id,
          variantSku: null,
          field,
          message: `${field} alanında birleşik nokta (U+0307) var: TR büyük harf küçültmesi varsayılan yerelde yapılmış${
            words.length > 0 ? ` ("${words.join('", "')}")` : ''
          }.`,
          fixHint:
            'Büyük/küçük harf ve slug dönüşümlerinde `toLocaleLowerCase("tr")` / `toLocaleUpperCase("tr")` kullanın; aksi hâlde "İ" → "i̇" olur ve arama/eşleştirme bozulur.',
          evidence: truncateEvidence(value),
        },
      ];
    }

    if (slugifyTr(product.title).length === 0 && product.title.trim() !== '') {
      return [
        {
          ruleId: 'TR_TEXT_QUALITY',
          severity: 'major',
          productId: product.id,
          variantSku: null,
          field: 'title',
          message: "Başlık slug'a çevrilemiyor; başlık yalnızca geçersiz karakterlerden oluşuyor.",
          fixHint: 'Başlıkta en az bir harf ya da rakam bulunduğundan emin olun.',
          evidence: truncateEvidence(product.title),
        },
      ];
    }

    return [];
  },
};

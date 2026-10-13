import { lowerTr } from '../text-tr.ts';
import { truncateEvidence } from '../rule.ts';
import type { Rule } from '../rule.ts';

/**
 * TITLE_KEYWORD_STUFFING — başlıkta anahtar kelime yığma.
 *
 * Üç bağımsız belirti aranır (eşikler örnek/yapılandırılabilir, bkz. ADR-008): aynı kelimenin
 * sürekli tekrarı, aşırı uzun kelime listesi, ayraç yığını (`|`, `,`, `;`).
 */
export const TITLE_MAX_WORDS = 12;
export const TITLE_WORD_REPEAT_LIMIT = 3;
export const TITLE_MAX_SEPARATORS = 4;

/** Başlığı TR yereLine göre küçültüp kelimelere ayırır (noktalama atılır). */
export function titleWords(title: string): string[] {
  return lowerTr(title)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/u)
    .filter((word) => word !== '');
}

export const titleKeywordStuffingRule: Rule = {
  id: 'TITLE_KEYWORD_STUFFING',
  severity: 'major',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'Başlıkta anahtar kelime yığma',
  description: 'Başlıkta kelime tekrarı, aşırı uzun kelime listesi veya ayraç yığını var.',
  check({ product }) {
    const words = titleWords(product.title);
    const counts = new Map<string, number>();
    for (const word of words) {
      if (word.length < 4) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    const repeated = [...counts.entries()]
      .filter(([, count]) => count >= TITLE_WORD_REPEAT_LIMIT)
      .sort((left, right) => (left[0] < right[0] ? -1 : 1));
    const separators = (product.title.match(/[|,;]/gu) ?? []).length;

    const reasons: string[] = [];
    if (repeated.length > 0) {
      reasons.push(
        `tekrar eden kelime: ${repeated.map(([word, count]) => `${word}×${count}`).join(', ')}`,
      );
    }
    if (words.length > TITLE_MAX_WORDS) {
      reasons.push(`${words.length} kelime (en fazla ${TITLE_MAX_WORDS})`);
    }
    if (separators >= TITLE_MAX_SEPARATORS) {
      reasons.push(`${separators} ayraç (| , ;)`);
    }
    if (reasons.length === 0) return [];

    return [
      {
        ruleId: 'TITLE_KEYWORD_STUFFING',
        severity: 'major',
        productId: product.id,
        variantSku: null,
        field: 'title',
        message: `Anahtar kelime yığma belirtisi: ${reasons.join('; ')}.`,
        fixHint:
          'Başlığı "renk + materyal + ürün + hedef kitle" kalıbında 3-7 kelimeye indirin; anahtar kelimeleri açıklama ve etiketlerde kullanın.',
        evidence: truncateEvidence(product.title),
      },
    ];
  },
};

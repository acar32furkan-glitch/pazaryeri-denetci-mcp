import { truncateEvidence } from '../rule.ts';
import type { Rule } from '../rule.ts';

/**
 * TITLE_LENGTH — başlık çok kısa veya çok uzun.
 *
 * Eşikler **örnek** değerlerdir (bkz. docs/DECISIONS.md, ADR-008): pazaryerlerinin resmî
 * karakter sınırları değişir, bu yüzden sabitler dışa aktarılır ve kolayca yapılandırılabilir.
 */
export const TITLE_MIN_LENGTH = 15;
export const TITLE_MAX_LENGTH = 70;

export const titleLengthRule: Rule = {
  id: 'TITLE_LENGTH',
  severity: 'major',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'Başlık uzunluğu',
  description: `Ürün başlığı ${TITLE_MIN_LENGTH}-${TITLE_MAX_LENGTH} karakter aralığında olmalı.`,
  check({ product }) {
    const title = product.title.trim();
    const length = title.length;
    if (length >= TITLE_MIN_LENGTH && length <= TITLE_MAX_LENGTH) return [];

    const tooShort = length < TITLE_MIN_LENGTH;
    return [
      {
        ruleId: 'TITLE_LENGTH',
        severity: 'major',
        productId: product.id,
        variantSku: null,
        field: 'title',
        message: tooShort
          ? `Başlık çok kısa: ${length} karakter (en az ${TITLE_MIN_LENGTH} olmalı).`
          : `Başlık çok uzun: ${length} karakter (en fazla ${TITLE_MAX_LENGTH} olmalı).`,
        fixHint: tooShort
          ? 'Başlığa ürün tipini, materyali ve hedef kitleyi ekleyerek anlamlı hâle getirin.'
          : 'Başlığı kısaltın; tekrar eden kelimeleri ve gereksiz süslemeleri çıkarın.',
        evidence: truncateEvidence(title === '' ? '<boş>' : title),
      },
    ];
  },
};

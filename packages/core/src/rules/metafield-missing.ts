import { truncateEvidence } from '../rule.ts';
import type { Rule } from '../rule.ts';

/**
 * METAFIELD_MISSING — örnek zorunlu alanlar eksik veya izin verilmeyen değerde.
 *
 * Değer listeleri **örnek** yapılandırmadır (bkz. ADR-008): gerçek bir pazaryerinin/kategori
 * şemasının yerine geçmez, o şema değiştiğinde burası da güncellenir.
 */
export const METAFIELD_NAMESPACE = 'sentetik';

export interface RequiredMetafield {
  readonly key: string;
  readonly allowedValues: readonly string[];
  readonly label: string;
}

export const REQUIRED_METAFIELDS: readonly RequiredMetafield[] = [
  {
    key: 'yas_grubu',
    allowedValues: ['0-3 yaş', '4-6 yaş', '7-9 yaş', '10-14 yaş', 'Yetişkin'],
    label: 'yaş grubu',
  },
  {
    key: 'materyal',
    allowedValues: [
      'Pamuk',
      'Yün',
      'Deri',
      'Keten',
      'Polyester',
      'Viskon',
      'Kanvas',
      'Saten',
      'Şişe Cam',
      'Seramik',
    ],
    label: 'materyal',
  },
  {
    key: 'renk',
    allowedValues: [
      'Kırmızı',
      'Mavi',
      'Yeşil',
      'Antrasit',
      'Ekru',
      'Bordo',
      'Lacivert',
      'Haki',
      'Bej',
      'Gri',
    ],
    label: 'renk',
  },
];

export const metafieldMissingRule: Rule = {
  id: 'METAFIELD_MISSING',
  severity: 'major',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'Zorunlu ürün alanı eksik',
  description: `Örnek zorunlu metafield'lar (${REQUIRED_METAFIELDS.map((field) => field.key).join(', ')}) eksik ya da izin verilmeyen değerde.`,
  check({ product }) {
    const issues: string[] = [];
    for (const required of REQUIRED_METAFIELDS) {
      const metafield = product.metafields.find(
        (candidate) =>
          candidate.namespace === METAFIELD_NAMESPACE && candidate.key === required.key,
      );
      const value = metafield?.value?.trim() ?? '';
      if (value === '') {
        issues.push(`${required.label} eksik`);
        continue;
      }
      if (required.allowedValues.length > 0 && !required.allowedValues.includes(value)) {
        issues.push(`${required.label} izin verilmeyen değerde ("${value}")`);
      }
    }
    if (issues.length === 0) return [];

    return [
      {
        ruleId: 'METAFIELD_MISSING',
        severity: 'major',
        productId: product.id,
        variantSku: null,
        field: `metafields[${METAFIELD_NAMESPACE}]`,
        message: `Zorunlu alan sorunu: ${issues.join('; ')}.`,
        fixHint:
          'Kategori şemasındaki zorunlu alanları (yaş grubu, materyal, renk) ürün verisinde tanımlı ve izin verilen değerlerle doldurun.',
        evidence: truncateEvidence(issues.join('; ')),
      },
    ];
  },
};

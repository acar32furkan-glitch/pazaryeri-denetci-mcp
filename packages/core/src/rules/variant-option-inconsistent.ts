import { lowerTr } from '../text-tr.ts';
import { truncateEvidence } from '../rule.ts';
import type { Rule } from '../rule.ts';
import type { Variant } from '../types.ts';

/**
 * VARIANT_OPTION_INCONSISTENT — aynı seçeneğin değerleri tutarsız.
 *
 * Üç belirti: (a) yalnızca büyük/küçük harf ve boşlukla ayrışan değerler (`Kırmızı` / `kırmızı`),
 * (b) aynı seçenek kombinasyonunun iki varyantta tekrarı, (c) beden sıralamasının bozulması.
 */
export const SIZE_ORDER: readonly string[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Standart'];

function normalize(value: string): string {
  return lowerTr(value).replace(/\s+/gu, ' ').trim();
}

function optionValue(variant: Variant, name: string): string | null {
  const option = variant.options.find((candidate) => normalize(candidate.name) === normalize(name));
  return option?.value ?? null;
}

function signature(variant: Variant): string {
  return variant.options
    .map((option) => `${normalize(option.name)}=${normalize(option.value)}`)
    .sort()
    .join('|');
}

export const variantOptionInconsistentRule: Rule = {
  id: 'VARIANT_OPTION_INCONSISTENT',
  severity: 'major',
  appliesTo: ['shopify', 'hepsiburada', 'trendyol', 'n11', 'merchant-center'],
  title: 'Varyant seçenekleri tutarsız',
  description:
    'Aynı seçenek için harf/boşluk farkıyla ayrışan değerler, tekrar eden kombinasyon veya bozuk beden sıralaması var.',
  check({ product }) {
    const issues: string[] = [];

    // (a) yalnızca büyük/küçük harf farkıyla ayrışan değerler
    const byOption = new Map<string, Map<string, Set<string>>>();
    for (const variant of product.variants) {
      for (const option of variant.options) {
        const optionKey = normalize(option.name);
        const values = byOption.get(optionKey) ?? new Map<string, Set<string>>();
        const variantsForValue = values.get(normalize(option.value)) ?? new Set<string>();
        variantsForValue.add(option.value.trim());
        values.set(normalize(option.value), variantsForValue);
        byOption.set(optionKey, values);
      }
    }
    for (const [optionName, values] of [...byOption.entries()].sort()) {
      for (const [normalized, rawValues] of [...values.entries()].sort()) {
        if (rawValues.size > 1) {
          issues.push(
            `"${optionName}" seçeneğinde harf/boşluk farkı: ${[...rawValues].sort().join(' / ')}`,
          );
        } else if (normalized === '') {
          issues.push(`"${optionName}" seçeneğinde boş değer var`);
        }
      }
    }

    // (b) aynı kombinasyonun tekrarı
    const seen = new Set<string>();
    for (const [index, variant] of product.variants.entries()) {
      const key = signature(variant);
      if (seen.has(key)) {
        issues.push(`${index + 1}. varyant, önceki bir varyantla aynı seçenek kombinasyonunda`);
      }
      seen.add(key);
    }

    // (c) beden sıralaması (yalnızca sıralamada yer alan değerler değerlendirilir)
    const sizes = product.variants
      .map((variant) => optionValue(variant, 'Beden') ?? optionValue(variant, 'Size'))
      .filter((value): value is string => value !== null);
    const knownSizes = sizes.filter((value) => SIZE_ORDER.includes(value));
    if (knownSizes.length === sizes.length && knownSizes.length > 1) {
      const indexes = knownSizes.map((value) => SIZE_ORDER.indexOf(value));
      const sorted = [...indexes].sort((left, right) => left - right);
      if (indexes.join(',') !== sorted.join(',')) {
        issues.push(`beden sıralaması bozuk: ${sizes.join(' → ')}`);
      }
    }

    if (issues.length === 0) return [];

    return [
      {
        ruleId: 'VARIANT_OPTION_INCONSISTENT',
        severity: 'major',
        productId: product.id,
        variantSku: null,
        field: 'variants[].options',
        message: `Varyant seçenekleri tutarsız: ${issues.join('; ')}.`,
        fixHint:
          'Seçenek değerlerini tek bir sözlükten üretin (ör. "Kırmızı", "M"), varyant kombinasyonlarını tekilleştirin ve bedenleri XS→XXL sırasında tutun.',
        evidence: truncateEvidence(issues.join('; ')),
      },
    ];
  },
};

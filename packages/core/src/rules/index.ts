import { barcodeInvalidRule } from './barcode-invalid.ts';
import { descMissingRule } from './desc-missing.ts';
import { imageAltMissingRule } from './image-alt-missing.ts';
import { seoMetaMissingRule } from './seo-meta-missing.ts';
import { skuMissingRule } from './sku-missing.ts';
import { titleLengthRule } from './title-length.ts';

import type { Rule } from '../rule.ts';
import type { RuleId } from '../rule-ids.ts';

/**
 * Kural kayıt defteri — **sıra anlamlıdır** (deterministik koşu sırası).
 * Yeni kural eklerken: `rule-ids.ts` + bu liste + en az bir geçen/kalan test.
 */
export const RULE_CATALOG: readonly Rule[] = [
  titleLengthRule,
  descMissingRule,
  seoMetaMissingRule,
  imageAltMissingRule,
  skuMissingRule,
  barcodeInvalidRule,
];

export function getRule(id: RuleId): Rule | undefined {
  return RULE_CATALOG.find((rule) => rule.id === id);
}

export {
  barcodeInvalidRule,
  descMissingRule,
  imageAltMissingRule,
  seoMetaMissingRule,
  skuMissingRule,
  titleLengthRule,
};

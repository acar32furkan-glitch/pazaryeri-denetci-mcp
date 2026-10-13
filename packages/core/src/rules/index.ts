import { barcodeInvalidRule } from './barcode-invalid.ts';
import { channelMismatchRule } from './channel-mismatch.ts';
import { descMissingRule } from './desc-missing.ts';
import { descTooShortRule } from './desc-too-short.ts';
import { descUnsafeHtmlRule } from './desc-unsafe-html.ts';
import { imageAltMissingRule } from './image-alt-missing.ts';
import { imageCountLowRule } from './image-count-low.ts';
import { metafieldMissingRule } from './metafield-missing.ts';
import { priceCompareAtInvalidRule } from './price-compare-at-invalid.ts';
import { seoMetaMissingRule } from './seo-meta-missing.ts';
import { skuDuplicateRule } from './sku-duplicate.ts';
import { skuMissingRule } from './sku-missing.ts';
import { titleKeywordStuffingRule } from './title-keyword-stuffing.ts';
import { titleLengthRule } from './title-length.ts';
import { trTextQualityRule } from './tr-text-quality.ts';
import { variantMissingPriceOrStockRule } from './variant-missing-price-or-stock.ts';
import { variantOptionInconsistentRule } from './variant-option-inconsistent.ts';

import type { Rule } from '../rule.ts';
import type { RuleId } from '../rule-ids.ts';

/**
 * Kural kayıt defteri — **sıra anlamlıdır** (deterministik koşu sırası).
 * Yeni kural eklerken: `rule-ids.ts` + bu liste + en az bir geçen/kalan test.
 */
export const RULE_CATALOG: readonly Rule[] = [
  titleLengthRule,
  titleKeywordStuffingRule,
  descMissingRule,
  descTooShortRule,
  descUnsafeHtmlRule,
  seoMetaMissingRule,
  imageAltMissingRule,
  imageCountLowRule,
  variantOptionInconsistentRule,
  variantMissingPriceOrStockRule,
  skuMissingRule,
  skuDuplicateRule,
  barcodeInvalidRule,
  priceCompareAtInvalidRule,
  metafieldMissingRule,
  channelMismatchRule,
  trTextQualityRule,
];

export function getRule(id: RuleId): Rule | undefined {
  return RULE_CATALOG.find((rule) => rule.id === id);
}

export {
  barcodeInvalidRule,
  channelMismatchRule,
  descMissingRule,
  descTooShortRule,
  descUnsafeHtmlRule,
  imageAltMissingRule,
  imageCountLowRule,
  metafieldMissingRule,
  priceCompareAtInvalidRule,
  seoMetaMissingRule,
  skuDuplicateRule,
  skuMissingRule,
  titleKeywordStuffingRule,
  titleLengthRule,
  trTextQualityRule,
  variantMissingPriceOrStockRule,
  variantOptionInconsistentRule,
};

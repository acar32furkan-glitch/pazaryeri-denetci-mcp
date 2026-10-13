import { describe, expect, it } from 'vitest';

import { RULE_CATALOG, RULE_ID_LIST, auditProduct, getRule } from '../src/index.ts';
import type { Product } from '../src/index.ts';
import { makeProduct, makeVariant } from './factories.ts';

/** Kasıtlı olarak her kuralın tetiklendiği bozuk ürün. */
const brokenProduct: Product = makeProduct({
  title: 'X',
  descriptionHtml: '',
  seo: { title: null, description: null },
  images: [{ url: 'https://cdn.test/1.jpg', altText: null }],
  variants: [makeVariant({ sku: null, barcode: '4006381333932' })],
});

describe('kural kayıt defteri sözleşmesi', () => {
  it('kayıt defteri sırası RULE_ID_LIST ile birebir aynıdır', () => {
    expect(RULE_CATALOG.map((rule) => rule.id)).toEqual([...RULE_ID_LIST]);
  });

  it('kural kimlikleri benzersizdir', () => {
    const ids = RULE_CATALOG.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('her kural meta bilgisi doludur ve en az bir kanala uygulanır', () => {
    for (const rule of RULE_CATALOG) {
      expect(rule.title.trim().length).toBeGreaterThan(0);
      expect(rule.description.trim().length).toBeGreaterThan(10);
      expect(rule.appliesTo.length).toBeGreaterThan(0);
    }
  });

  it('getRule kayıtlı kuralı bulur, kayıtsız kimlikte undefined döner', () => {
    expect(getRule('TITLE_LENGTH')?.id).toBe('TITLE_LENGTH');
    expect(RULE_CATALOG.every((rule) => getRule(rule.id as never) === rule)).toBe(true);
  });

  it('bulgular kendi kuralının kimliğini ve şiddetini taşır (kayma koruması)', () => {
    const findings = auditProduct(brokenProduct);
    expect(findings.length).toBeGreaterThanOrEqual(RULE_CATALOG.length);
    for (const finding of findings) {
      const rule = RULE_CATALOG.find((candidate) => candidate.id === finding.ruleId);
      expect(rule, `bilinmeyen kural: ${finding.ruleId}`).toBeDefined();
      expect(finding.severity).toBe(rule?.severity);
      expect(finding.productId).toBe(brokenProduct.id);
      expect(finding.message.trim().length).toBeGreaterThan(0);
      expect(finding.fixHint.trim().length).toBeGreaterThan(0);
    }
  });

  it('her kural bozuk üründe en az bir bulgu üretir', () => {
    const findings = auditProduct(brokenProduct);
    for (const rule of RULE_CATALOG) {
      expect(
        findings.some((finding) => finding.ruleId === rule.id),
        `${rule.id} hiç bulgu üretmedi`,
      ).toBe(true);
    }
  });
});

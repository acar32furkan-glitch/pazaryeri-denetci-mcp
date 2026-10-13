import { describe, expect, it } from 'vitest';

import { barcodeInvalidRule, computeGtinCheckDigit } from '../../src/index.ts';
import { VALID_EAN13, VALID_EAN8, VALID_UPC12, makeProduct, makeVariant } from '../factories.ts';

function check(barcodes: readonly (string | null)[]) {
  return barcodeInvalidRule.check({
    product: makeProduct({
      variants: barcodes.map((barcode, index) =>
        makeVariant({ barcode, sku: `SNT-0001-0${index + 1}` }),
      ),
    }),
    listings: [],
  });
}

describe('BARCODE_INVALID', () => {
  it('geçen durum: GTIN-13, GTIN-8 ve GTIN-12 doğru barkodlar kabul edilir', () => {
    expect(
      barcodeInvalidRule.check({
        product: makeProduct({ variants: [makeVariant({ barcode: VALID_EAN13 })] }),
        listings: [],
      }),
    ).toEqual([]);
    expect(check([VALID_EAN8, VALID_UPC12])).toEqual([]);
  });

  it('kalan durum: barkod yok', () => {
    const findings = check([null]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('barkod boş');
    expect(findings[0]?.field).toBe('variants[0].barcode');
    expect(findings[0]?.variantSku).toBe('SNT-0001-01');
    expect(findings[0]?.evidence).toBe('<boş>');
  });

  it('kalan durum: sağlama basamağı bozuk (tek hane farklı)', () => {
    const body = VALID_EAN13.slice(0, -1);
    const correct = computeGtinCheckDigit(body);
    const broken = `${body}${String((correct + 1) % 10)}`;
    const findings = check([broken]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('sağlama basamağı hatalı');
    expect(findings[0]?.message).toContain(`beklenen ${correct}`);
    expect(findings[0]?.evidence).toBe(broken);
  });

  it('kalan durum: rakam dışı karakter', () => {
    expect(check(['400638133393X'])[0]?.message).toContain('rakam dışı karakter');
  });

  it('kalan durum: desteklenmeyen uzunluk', () => {
    expect(check(['1234567890'])[0]?.message).toContain('desteklenmeyen uzunluk (10 hane)');
  });

  it('her varyant için ayrı bulgu üretir', () => {
    const findings = check([null, VALID_EAN13, '']);
    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.field)).toEqual([
      'variants[0].barcode',
      'variants[2].barcode',
    ]);
  });
});

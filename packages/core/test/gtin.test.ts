import { describe, expect, it } from 'vitest';

import { checkGtin, computeGtinCheckDigit } from '../src/index.ts';
import { VALID_EAN13, VALID_EAN8, VALID_UPC12 } from './factories.ts';

describe('computeGtinCheckDigit', () => {
  it('bilinen gövdeler için doğru basamağı üretir', () => {
    expect(computeGtinCheckDigit('400638133393')).toBe(1);
    expect(computeGtinCheckDigit('9638507')).toBe(4);
    expect(computeGtinCheckDigit('03600029145')).toBe(2);
  });

  it('rakam dışı gövdelerde hata verir', () => {
    expect(() => computeGtinCheckDigit('12A45')).toThrow(/rakam/);
    expect(() => computeGtinCheckDigit('')).toThrow(/rakam/);
  });
});

describe('checkGtin', () => {
  it('geçerli barkodları biçimiyle birlikte kabul eder', () => {
    expect(checkGtin(VALID_EAN13)).toEqual({ valid: true, format: 'GTIN-13', reason: null });
    expect(checkGtin(VALID_EAN8)).toEqual({ valid: true, format: 'GTIN-8', reason: null });
    expect(checkGtin(VALID_UPC12)).toEqual({ valid: true, format: 'GTIN-12', reason: null });
  });

  it('boş/null değerleri reddeder', () => {
    expect(checkGtin('').valid).toBe(false);
    expect(checkGtin(null).valid).toBe(false);
    expect(checkGtin(undefined).valid).toBe(false);
    expect(checkGtin('   ').reason).toBe('barkod boş');
  });

  it('14 haneli GTIN-14 desteği vardır', () => {
    const body = '1001234500001';
    const gtin = `${body}${String(computeGtinCheckDigit(body))}`;
    expect(gtin).toHaveLength(14);
    expect(checkGtin(gtin).valid).toBe(true);
    expect(checkGtin(gtin).format).toBe('GTIN-14');
  });

  it('boşluklu yazımı kabul eder ama iç boşluğu reddeder', () => {
    expect(checkGtin(` ${VALID_EAN13} `).valid).toBe(true);
    expect(checkGtin('4006381 333931').valid).toBe(false);
  });

  it('üretilen barkod her zaman doğrulanır (üretici ↔ doğrulayıcı çapraz kontrolü)', () => {
    const bodies = ['869000000001', '869123456789', '001234567890', '999999999999'];
    for (const body of bodies) {
      const barcode = `${body}${String(computeGtinCheckDigit(body))}`;
      expect(checkGtin(barcode).valid).toBe(true);
    }
  });
});

import { describe, expect, it } from 'vitest';

import { parseTrInteger, parseTrNumber } from '../src/index.ts';

describe('parseTrNumber', () => {
  it('Türkçe binlik/ondalık ayıracını çözer', () => {
    expect(parseTrNumber('1.299,90')).toBe(1299.9);
    expect(parseTrNumber('1299.90')).toBe(1299.9);
    expect(parseTrNumber('1.299')).toBe(1299);
    expect(parseTrNumber('1,299.90')).toBe(1299.9);
    expect(parseTrNumber('129,90')).toBe(129.9);
    expect(parseTrNumber('0')).toBe(0);
  });

  it('para simgesi/kodu ve boşluk gürültüsünü yok sayar', () => {
    expect(parseTrNumber('₺ 1.299,90')).toBe(1299.9);
    expect(parseTrNumber('1.299,90 TL')).toBe(1299.9);
    expect(parseTrNumber('  129,90  ')).toBe(129.9);
  });

  it('belirsiz ayıraçta son ayıracı ondalık sayar; 3 hane binliktir', () => {
    // `1.299` → son ayıracın ardında 3 hane var, ondalık değil binlik ayıraçtır.
    expect(parseTrNumber('1.299')).toBe(1299);
    // `1.29` → son ayıracın ardında 2 hane var, ondalıktır.
    expect(parseTrNumber('1.29')).toBe(1.29);
  });

  it('negatif değeri korur', () => {
    expect(parseTrNumber('-1.299,90')).toBe(-1299.9);
  });

  it('sayı üretilemeyen girdilerde null döner', () => {
    expect(parseTrNumber('')).toBeNull();
    expect(parseTrNumber('   ')).toBeNull();
    expect(parseTrNumber('-')).toBeNull();
    expect(parseTrNumber('abc')).toBeNull();
    expect(parseTrNumber('₺')).toBeNull();
  });
});

describe('parseTrInteger', () => {
  it('tam sayıları ve binlik ayıracını çözer', () => {
    expect(parseTrInteger('1.234')).toBe(1234);
    expect(parseTrInteger('12')).toBe(12);
    expect(parseTrInteger('12,0')).toBe(12);
  });

  it('negatif stok ve sayı olmayan girdileri reddeder', () => {
    expect(parseTrInteger('-3')).toBeNull();
    expect(parseTrInteger('abc')).toBeNull();
    expect(parseTrInteger('')).toBeNull();
  });
});

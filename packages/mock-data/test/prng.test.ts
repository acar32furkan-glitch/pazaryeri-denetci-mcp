import { describe, expect, it } from 'vitest';

import { createRng } from '../src/index.ts';

describe('createRng (mulberry32)', () => {
  it('aynı seed aynı diziyi üretir', () => {
    const first = createRng(2026);
    const second = createRng(2026);
    const a = Array.from({ length: 8 }, () => first.next());
    const b = Array.from({ length: 8 }, () => second.next());
    expect(a).toEqual(b);
  });

  it('farklı seed farklı dizi üretir', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('next() [0,1) aralığında kalır', () => {
    const rng = createRng(7);
    for (let index = 0; index < 500; index += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('int() uçları dâhil aralıkta kalır', () => {
    const rng = createRng(11);
    const seen = new Set<number>();
    for (let index = 0; index < 500; index += 1) {
      const value = rng.int(3, 5);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(5);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([3, 4, 5]);
  });

  it('geçersiz aralıkta hata verir', () => {
    expect(() => createRng(1).int(5, 3)).toThrow(/Geçersiz aralık/);
  });

  it('pick() boş listede hata verir, dolu listede eleman döner', () => {
    const rng = createRng(3);
    expect(() => rng.pick([])).toThrow(/boş/);
    expect(['a', 'b']).toContain(rng.pick(['a', 'b']));
  });

  it('bool() uç olasılıklarda deterministik davranır', () => {
    const rng = createRng(5);
    expect(rng.bool(0)).toBe(false);
    expect(rng.bool(1)).toBe(true);
  });

  it('shuffle() girdiyi bozmaz, aynı elemanları korur ve deterministiktir', () => {
    const rng = createRng(13);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = rng.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(input);
    expect(shuffled).toEqual(createRng(13).shuffle(input));
  });
});

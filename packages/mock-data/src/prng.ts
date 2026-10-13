/**
 * Seed'li sözde rastgele sayı üreteci (mulberry32).
 *
 * Üreticinin **deterministik** olması projenin temel şartıdır: aynı seed aynı kataloğu, aynı
 * bulguları ve dolayısıyla aynı eval rakamlarını üretmelidir. Bu yüzden `Math.random()` ve
 * `Date` hiçbir yerde kullanılmaz.
 */

export interface Rng {
  /** [0, 1) aralığında bir sonraki değer. */
  next(): number;
  /** [min, max] aralığında tam sayı (uçlar dâhil). */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  bool(probability: number): boolean;
  /** Girdiyi bozmadan karıştırılmış bir kopya döner (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[];
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);

  const int = (min: number, max: number): number => {
    if (max < min) throw new Error(`Geçersiz aralık: ${min}..${max}`);
    return Math.floor(next() * (max - min + 1)) + min;
  };

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error('pick(): liste boş olamaz.');
    const item = items[int(0, items.length - 1)];
    if (item === undefined) throw new Error('pick(): indeks aralık dışı.');
    return item;
  };

  const bool = (probability: number): boolean => next() < probability;

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapWith = int(0, index);
      const left = copy[index];
      const right = copy[swapWith];
      if (left === undefined || right === undefined) continue;
      copy[index] = right;
      copy[swapWith] = left;
    }
    return copy;
  };

  return { next, int, pick, bool, shuffle };
}

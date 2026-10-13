import { DEFECT_KINDS } from '@pazaryeri-denetci/mock-data';
import type { DefectKind } from '@pazaryeri-denetci/mock-data';

/** Demo katalog profillerinin kimlikleri (`?profil=kucuk|orta|buyuk`). */
export const PROFILE_IDS = ['kucuk', 'orta', 'buyuk'] as const;

export type CatalogProfileId = (typeof PROFILE_IDS)[number];

export interface CatalogProfile {
  readonly id: CatalogProfileId;
  /** Kullanıcıya görünen kısa ad. */
  readonly label: string;
  /** Katalogdaki ürün sayısı. */
  readonly productCount: number;
  /** Her hata türü için kaç farklı ürüne hata enjekte edileceği. */
  readonly defectsPerKind: number;
  /** Sabit seed: aynı profil her koşuda bire bir aynı kataloğu üretir. */
  readonly seed: number;
  /** Bu profilde enjekte edilecek hata türleri. */
  readonly defectKinds: readonly DefectKind[];
  /** Profil seçicide gösterilen tek satırlık açıklama. */
  readonly description: string;
}

/** Tüm profillerin ortak seed'i — demo koşuları tekrarlanabilir olsun. */
export const DEMO_SEED = 20261013;

/**
 * Küçük profilde 21 hata türü × 2 = 42 hata, 40 ürüne sığmıyor: üretici her ürüne **en fazla bir**
 * hata yazar (etiket–bulgu bire bir eşleşsin diye). Bu yüzden küçük profilde son tür
 * (`TR_LOCALE_CASING`) çıkarılır → 20 tür × 2 = 40 hata / 40 ürün.
 */
const SMALL_PROFILE_DEFECT_KINDS: readonly DefectKind[] = DEFECT_KINDS.filter(
  (kind) => kind !== 'TR_LOCALE_CASING',
);

/** Üç sentetik katalog profili: küçük → büyük (sabit seed, deterministik). */
export const CATALOG_PROFILES: Readonly<Record<CatalogProfileId, CatalogProfile>> = {
  kucuk: {
    id: 'kucuk',
    label: 'Küçük',
    productCount: 40,
    defectsPerKind: 2,
    seed: DEMO_SEED,
    defectKinds: SMALL_PROFILE_DEFECT_KINDS,
    description: '40 ürün · 20 hata türü × 2 enjeksiyon (40 etiketli hata)',
  },
  orta: {
    id: 'orta',
    label: 'Orta',
    productCount: 200,
    defectsPerKind: 5,
    seed: DEMO_SEED,
    defectKinds: DEFECT_KINDS,
    description: '200 ürün · 21 hata türü × 5 enjeksiyon (105 etiketli hata)',
  },
  buyuk: {
    id: 'buyuk',
    label: 'Büyük',
    productCount: 500,
    defectsPerKind: 10,
    seed: DEMO_SEED,
    defectKinds: DEFECT_KINDS,
    description: '500 ürün · 21 hata türü × 10 enjeksiyon (210 etiketli hata)',
  },
};

/** `?profil=` verilmediğinde veya geçersiz olduğunda gösterilen profil. */
export const DEFAULT_PROFILE_ID: CatalogProfileId = 'orta';

export const PROFILE_LIST: readonly CatalogProfile[] = PROFILE_IDS.map(
  (id) => CATALOG_PROFILES[id],
);

/** Tip daraltıcı: bilinmeyen bir değerin geçerli profil kimliği olup olmadığı. */
export function isProfileId(value: unknown): value is CatalogProfileId {
  return typeof value === 'string' && Object.hasOwn(CATALOG_PROFILES, value);
}

/** Geçerli profil döner, geçersiz/boş değerde `undefined` (çağıran karar verir). */
export function resolveProfile(value: unknown): CatalogProfile | undefined {
  return isProfileId(value) ? CATALOG_PROFILES[value] : undefined;
}

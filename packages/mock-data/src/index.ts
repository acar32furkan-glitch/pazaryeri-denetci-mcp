/**
 * Sentetik katalog üreticisi: seed'li, deterministik ürün üretimi ve **etiketlenmiş** hata
 * enjeksiyonu. Etiketler eval harness'ının gerçek doğruluk verisidir.
 */
export const PACKAGE_NAME = '@pazaryeri-denetci/mock-data';

export { DEFECT_KINDS, DEFECT_LABELS_TR, EXPECTED_RULE_ID_BY_KIND } from './defects.ts';
export type { DefectKind, InjectedDefect } from './defects.ts';

export { generateCatalog, generateCleanCatalog } from './generator.ts';
export type { CatalogOptions, GeneratedCatalog } from './generator.ts';

export { createRng } from './prng.ts';
export type { Rng } from './prng.ts';

export {
  AGE_GROUPS,
  CARE_INSTRUCTIONS,
  COLORS,
  DESCRIPTION_FILLERS,
  MATERIALS,
  PRODUCT_NOUNS,
  SIZES,
  TITLE_TAILS,
  VENDORS,
} from './vocabulary.ts';

/**
 * LLM öneri kalite kontrolü — **MOCK istemci ile HARNESS doğrulaması**.
 *
 * DÜRÜSTLÜK NOTU: Bu modül bir modelin öneri kalitesini ÖLÇMEZ. Sahte (mock) istemci kullanır ve
 * yalnızca şu zincirin uçtan uca çalıştığını doğrular:
 *
 *   sentetik katalog → denetim → prompt kurulumu → şema doğrulaması → öneri →
 *   öneriyi ürüne uygula → ilgili DETERMİNİSTİK kuralları yeniden çalıştır
 *
 * Yani ölçülen şey öneri hattının kendisidir (alan eşlemesi, şema, uygulama, yeniden denetim),
 * model kalitesi değildir. Canlı model ölçümü için gerçek istemci (`anthropic`) ile ayrı bir koşu
 * gerekir; buradaki sayılar o ölçümün yerine geçmez.
 *
 * Kural kümesi core'dan import edilir; burada elle kural yazılmaz. Hangi kuralın hangi alana
 * uygulandığı tek yerde (`FIELDS_BY_RULE` / `FIELD_RULES`) tanımlıdır.
 */

import {
  auditCatalog,
  auditProduct,
  descMissingRule,
  descTooShortRule,
  descUnsafeHtmlRule,
  seoMetaMissingRule,
  titleKeywordStuffingRule,
  titleLengthRule,
} from '@pazaryeri-denetci/core';
import { generateCatalog } from '@pazaryeri-denetci/mock-data';
import { createDemoMockClient, createSuggester } from '@pazaryeri-denetci/suggest';

import type { EvalConfig } from './harness.ts';
import type { Catalog, Finding, Product, Rule, RuleId } from '@pazaryeri-denetci/core';
import type {
  SuggestFinding,
  SuggestProduct,
  SuggestRequest,
  SuggestTarget,
  Suggester,
  SuggestionFields,
} from '@pazaryeri-denetci/suggest';

/** Rapor ve ölçüm sırası — alan bazında kapsanan hedef listesi (kararlı sıra). */
export const SUGGEST_QUALITY_FIELDS: readonly SuggestTarget[] = [
  'title',
  'descriptionHtml',
  'seoTitle',
  'seoDescription',
];

/** Hangi öneri alanının hangi deterministik kurallarla yeniden denetleneceği. */
const FIELD_RULES: Readonly<Record<SuggestTarget, readonly Rule[]>> = {
  title: [titleLengthRule, titleKeywordStuffingRule],
  descriptionHtml: [descMissingRule, descTooShortRule, descUnsafeHtmlRule],
  seoTitle: [seoMetaMissingRule],
  seoDescription: [seoMetaMissingRule],
};

/**
 * Bir bulgunun hangi öneri alan(lar)ını gerektirdiği. Anahtarlar core kural kimlikleridir;
 * `satisfies` sayesinde yazım hatası derlemeyi durdurur.
 */
const FIELDS_BY_RULE = {
  TITLE_LENGTH: ['title'],
  TITLE_KEYWORD_STUFFING: ['title'],
  DESC_MISSING: ['descriptionHtml'],
  DESC_TOO_SHORT: ['descriptionHtml'],
  DESC_UNSAFE_HTML: ['descriptionHtml'],
  SEO_META_MISSING: ['seoTitle', 'seoDescription'],
} as const satisfies Partial<Record<RuleId, readonly SuggestTarget[]>>;

const FIELDS_BY_RULE_LOOKUP: Readonly<Record<string, readonly SuggestTarget[] | undefined>> =
  FIELDS_BY_RULE;

/** Kural kimliğine göre öneri alanları; ilgilenilmeyen kural için boş dizi. */
function fieldsForRule(ruleId: string): readonly SuggestTarget[] {
  return FIELDS_BY_RULE_LOOKUP[ruleId] ?? [];
}

export interface SuggestFieldQuality {
  readonly field: SuggestTarget;
  /** Bu alan için yeniden çalıştırılan deterministik kuralların kimlikleri. */
  readonly rules: readonly string[];
  /** Öneri gerektiren ürün sayısı (bu alanda düzeltilebilir bulgusu olan). */
  readonly expected: number;
  /** Öneride bu alanın gerçekten doldurulduğu sayı. */
  readonly produced: number;
  /** Doldurulmuş ve alan kurallarını geçen öneri sayısı. */
  readonly passed: number;
  readonly passRate: number;
}

export interface SuggestFailure {
  readonly productId: string;
  readonly field: SuggestTarget;
  /** Öneride alan hiç doldurulmadı mı. */
  readonly produced: boolean;
  /** Alan uygulandıktan sonra hâlâ bağıran kural kimlikleri. */
  readonly remainingRuleIds: readonly string[];
}

export interface SuggestQualityReport {
  /** Ölçüm modu: her zaman "mock" — canlı model ölçülmedi. */
  readonly mode: 'mock';
  readonly model: string;
  /** Düzeltilebilir bulgusu olan ve öneri istenen ürün sayısı. */
  readonly consideredProducts: number;
  /** Öneri isteği sayısı. */
  readonly requests: number;
  /** Başarıyla üretilen öneri sayısı (ok dönen). */
  readonly suggestions: number;
  /** Öneri alınamayan istek sayısı (kota/hata/geçersiz çıktı). */
  readonly unavailable: number;
  readonly cacheHits: number;
  /** Aynı istek ikinci kez yapıldığında önbellekten geldi mi (harness doğrulaması). */
  readonly cacheHitOnRepeat: boolean;
  readonly fields: readonly SuggestFieldQuality[];
  /** Toplam alan birimi (beklenen). */
  readonly expected: number;
  /** Üretilen alan birimi (öneride doldurulan). */
  readonly produced: number;
  readonly passed: number;
  readonly passRate: number;
  readonly failures: readonly SuggestFailure[];
}

export interface SuggestQualityOptions {
  /** Test enjeksiyonu; verilmezse deterministik demo mock istemcisiyle önbellekli suggester kurulur. */
  readonly suggester?: Suggester;
  /** Raporda görünecek istemci model adı; varsayılan `mock-demo`. */
  readonly model?: string;
  /** Test için hazır katalog; verilmezse `config`'ten üretilir. */
  readonly catalog?: Catalog;
  /** Test için hazır bulgular; verilmezse katalog denetlenerek elde edilir. */
  readonly findings?: readonly Finding[];
}

function productToSuggest(product: Product): SuggestProduct {
  return {
    id: product.id,
    title: product.title,
    descriptionHtml: product.descriptionHtml,
    seoTitle: product.seo.title,
    seoDescription: product.seo.description,
    productType: product.productType,
    vendor: product.vendor,
    tags: product.tags,
  };
}

/** Bir bulguyu, kapsadığı her öneri alanı için bir `SuggestFinding`'e açar. */
function findingToSuggest(finding: Finding): SuggestFinding[] {
  return fieldsForRule(finding.ruleId).map((field) => ({
    ruleId: finding.ruleId,
    severity: finding.severity,
    field,
    message: finding.message,
    fixHint: finding.fixHint,
    evidence: finding.evidence,
  }));
}

/** Ürünün öneri gerektiren alanları (kararlı sırada). */
function requiredFields(findings: readonly Finding[]): SuggestTarget[] {
  const set = new Set<SuggestTarget>();
  for (const finding of findings) {
    for (const field of fieldsForRule(finding.ruleId)) set.add(field);
  }
  return SUGGEST_QUALITY_FIELDS.filter((field) => set.has(field));
}

function fieldPresent(field: SuggestTarget, fields: SuggestionFields): boolean {
  return fields[field] !== undefined;
}

/** Öneri alanlarını ürüne uygular; verilmeyen alanlar korunur. Ürün mutasyona uğramaz. */
function applyFields(product: Product, fields: SuggestionFields): Product {
  return {
    ...product,
    title: fields.title ?? product.title,
    descriptionHtml: fields.descriptionHtml ?? product.descriptionHtml,
    seo: {
      title: fields.seoTitle ?? product.seo.title,
      description: fields.seoDescription ?? product.seo.description,
    },
  };
}

/**
 * Öneriyi uyguladıktan sonra **yalnızca** ilgili alanın kurallarını çalıştırır.
 * SEO kuralı (`SEO_META_MISSING`) başlık ve açıklamayı birlikte kapsadığı için seoTitle ve
 * seoDescription satırlarında iki SEO alanı birlikte uygulanır; tek yarıyı değerlendirmek
 * gerçekte geçen bir öneriyi haksız yere düşürürdü.
 */
function remainingRuleIds(
  field: SuggestTarget,
  product: Product,
  fields: SuggestionFields,
): string[] {
  const candidate = applyFields(product, fields);
  return auditProduct(candidate, FIELD_RULES[field]).map((finding) => finding.ruleId);
}

function safeRate(passed: number, expected: number): number {
  return expected === 0 ? 1 : passed / expected;
}

/**
 * Düzeltilebilir bulgusu olan ürünler için mock istemciden öneri ister, önerileri ürüne uygular
 * ve ilgili deterministik kurallarla yeniden denetler. Ölçüm: alan bazında ve genel geçme oranı.
 */
export async function runSuggestQuality(
  config: EvalConfig,
  options: SuggestQualityOptions = {},
): Promise<SuggestQualityReport> {
  const catalog =
    options.catalog ??
    generateCatalog({
      seed: config.seed,
      productCount: config.productCount,
      defectsPerKind: config.defectsPerKind,
    }).catalog;
  const findings = options.findings ?? auditCatalog(catalog).findings;
  const suggester = options.suggester ?? createSuggester({ client: createDemoMockClient() });

  const findingsByProduct = new Map<string, Finding[]>();
  for (const finding of findings) {
    if (fieldsForRule(finding.ruleId).length === 0) continue;
    const list = findingsByProduct.get(finding.productId) ?? [];
    list.push(finding);
    findingsByProduct.set(finding.productId, list);
  }

  const productsById = new Map(catalog.products.map((product) => [product.id, product]));
  const counters = new Map<SuggestTarget, { expected: number; produced: number; passed: number }>(
    SUGGEST_QUALITY_FIELDS.map((field) => [field, { expected: 0, produced: 0, passed: 0 }]),
  );
  const failures: SuggestFailure[] = [];
  let requests = 0;
  let suggestions = 0;
  let unavailable = 0;
  let firstRequest: SuggestRequest | null = null;

  // Kararlı sıra: ürün kimliğine göre. Aynı katalog her koşuda aynı sayıları üretir.
  const productIds = [...findingsByProduct.keys()].sort();
  for (const productId of productIds) {
    const product = productsById.get(productId);
    if (product === undefined) continue;

    const productFindings = findingsByProduct.get(productId) ?? [];
    const targets = requiredFields(productFindings);
    const request: SuggestRequest = {
      product: productToSuggest(product),
      findings: productFindings.flatMap(findingToSuggest),
      targets,
    };
    if (firstRequest === null) firstRequest = request;

    requests += 1;
    const outcome = await suggester.suggest(request);
    const fields: SuggestionFields = outcome.status === 'ok' ? outcome.suggestion.fields : {};
    if (outcome.status === 'ok') suggestions += 1;
    else unavailable += 1;

    for (const field of targets) {
      const bucket = counters.get(field);
      if (bucket === undefined) continue;
      bucket.expected += 1;
      const produced = fieldPresent(field, fields);
      const remaining = remainingRuleIds(field, product, fields);
      if (produced && remaining.length === 0) {
        bucket.produced += 1;
        bucket.passed += 1;
      } else {
        if (produced) bucket.produced += 1;
        failures.push({ productId, field, produced, remainingRuleIds: remaining });
      }
    }
  }

  let cacheHitOnRepeat = false;
  if (firstRequest !== null) {
    const repeat = await suggester.suggest(firstRequest);
    cacheHitOnRepeat = repeat.status === 'ok' && repeat.source === 'cache';
  }

  const fieldReports: SuggestFieldQuality[] = SUGGEST_QUALITY_FIELDS.map((field) => {
    const bucket = counters.get(field) ?? { expected: 0, produced: 0, passed: 0 };
    return {
      field,
      rules: FIELD_RULES[field].map((rule) => rule.id),
      expected: bucket.expected,
      produced: bucket.produced,
      passed: bucket.passed,
      passRate: safeRate(bucket.passed, bucket.expected),
    };
  });

  const expected = fieldReports.reduce((sum, entry) => sum + entry.expected, 0);
  const produced = fieldReports.reduce((sum, entry) => sum + entry.produced, 0);
  const passed = fieldReports.reduce((sum, entry) => sum + entry.passed, 0);
  const stats = suggester.stats();

  return {
    mode: 'mock',
    model: options.model ?? 'mock-demo',
    consideredProducts: productIds.length,
    requests,
    suggestions,
    unavailable,
    cacheHits: stats.cacheHits,
    cacheHitOnRepeat,
    fields: fieldReports,
    expected,
    produced,
    passed,
    passRate: safeRate(passed, expected),
    failures,
  };
}

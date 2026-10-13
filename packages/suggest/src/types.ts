/**
 * LLM öneri katmanının sözleşmeleri.
 *
 * Bu paket `core`'a bağımlı DEĞİLDİR: çağıran (MCP sunucusu, web demosu) ürün ve bulguları
 * yapısal olarak bu tiplere eşler. Böylece öneri katmanı saf ve tek başına test edilebilir kalır.
 */

export type Severity = 'critical' | 'major' | 'minor';

/** Öneri üretilecek ürünün öneri katmanının gördüğü kadarı (bilinçli olarak dar). */
export interface SuggestProduct {
  readonly id: string;
  readonly title: string;
  readonly descriptionHtml: string;
  readonly seoTitle?: string | null;
  readonly seoDescription?: string | null;
  readonly productType?: string | null;
  readonly vendor?: string | null;
  readonly tags?: readonly string[];
}

/** Ürüne ait tek bir denetim bulgusu (LLM'e "neyi düzelt" demek için). */
export interface SuggestFinding {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly field: string;
  readonly message: string;
  readonly fixHint: string;
  readonly evidence?: string | null;
}

export interface SuggestRequest {
  readonly product: SuggestProduct;
  readonly findings: readonly SuggestFinding[];
  /** İstenen alanlar; boş bırakılırsa bulguların kapsadığı alanlar istenir. */
  readonly targets?: readonly SuggestTarget[];
}

export type SuggestTarget = 'title' | 'descriptionHtml' | 'seoTitle' | 'seoDescription';

export const ALL_SUGGEST_TARGETS: readonly SuggestTarget[] = [
  'title',
  'descriptionHtml',
  'seoTitle',
  'seoDescription',
];

/** LLM'in döndürmesi gereken alanlar; en az birinin dolu olması şarttır. */
export interface SuggestionFields {
  readonly title?: string;
  readonly descriptionHtml?: string;
  readonly seoTitle?: string;
  readonly seoDescription?: string;
}

export interface Suggestion {
  readonly productId: string;
  readonly model: string;
  readonly fields: SuggestionFields;
  readonly rationale: string;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly addressedRuleIds: readonly string[];
}

/** Önerinin alınamadığı durumlar — hiçbiri denetimi etkilemez, yalnızca öneri eksik kalır. */
export type SuggestUnavailableReason =
  | 'devre-disi' // API anahtarı yok: öneri özelliği kapalı
  | 'kota' // günlük token bütçesi doldu
  | 'llm-hata' // istemci hatası/zaman aşımı (bir yeniden deneme sonrası)
  | 'gecersiz-cikti'; // model geçerli şemada JSON döndürmedi

export type SuggestOutcome =
  | {
      readonly status: 'ok';
      readonly suggestion: Suggestion;
      readonly source: 'cache' | 'llm';
      readonly usage: LlmUsage;
    }
  | {
      readonly status: 'unavailable';
      readonly reason: SuggestUnavailableReason;
      readonly message: string;
    };

export interface LlmUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface LlmCompletionInput {
  readonly system: string;
  readonly user: string;
  readonly maxOutputTokens: number;
}

export type LlmCompletionResult =
  | { readonly ok: true; readonly text: string; readonly usage: LlmUsage }
  | { readonly ok: false; readonly message: string };

/**
 * LLM istemcisi. Üç uygulaması vardır: `anthropic` (gerçek), `mock` (test/demo),
 * `disabled` (anahtar yok — öneri özelliği kapalı).
 */
export interface LlmClient {
  readonly kind: 'anthropic' | 'mock' | 'disabled';
  /** Model adı; `disabled` istemcide `null`. Model adı koda gömülmez, ortamdan gelir. */
  readonly model: string | null;
  /** `disabled` istemcide kullanıcıya gösterilecek gerekçe (ör. eksik ortam değişkeni). */
  readonly disabledReason?: string;
  complete(input: LlmCompletionInput): Promise<LlmCompletionResult>;
}

/** Öneri üretimindeki toplamlar — maliyet gözlemi için (log'a ürün içeriği yazılmaz). */
export interface SuggestStats {
  readonly requests: number;
  readonly cacheHits: number;
  readonly llmCalls: number;
  readonly failures: number;
  readonly invalidOutputs: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

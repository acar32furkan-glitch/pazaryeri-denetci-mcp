/**
 * `suggest` paketi testleri için ortak ürün/istek/istemci fabrikaları.
 *
 * Buradaki yardımcılar yalnızca testleri okunabilir ve tekrar kullanılabilir tutar; paket
 * API'sini büyütmez. Tüm istemciler ağ çağrısı yapmaz (mock / elle kurulmuş sözleşme nesnesi).
 */

import { createMockClient } from '../src/index.ts';
import type {
  LlmClient,
  LlmCompletionInput,
  LlmCompletionResult,
  SuggestFinding,
  SuggestProduct,
  SuggestRequest,
} from '../src/index.ts';

export function makeProduct(overrides: Partial<SuggestProduct> = {}): SuggestProduct {
  return {
    id: 'snt-prd-0001',
    title: 'Antrasit Yün Kazak Kadın Giyim',
    descriptionHtml:
      '<p>Antrasit yün kazak, günlük kullanım için uygundur ve mevsimlik koleksiyonun bir parçasıdır. Yumuşak dokusu ve nefes alan yapısıyla gün boyu rahatlık sağlar.</p>',
    productType: 'Kazak',
    vendor: 'Test Atölye',
    tags: ['sentetik'],
    ...overrides,
  };
}

export function makeFinding(overrides: Partial<SuggestFinding> = {}): SuggestFinding {
  return {
    ruleId: 'TITLE_LENGTH',
    severity: 'major',
    field: 'title',
    message: 'Başlık çok kısa: 12 karakter (en az 15 olmalı).',
    fixHint: 'Başlığı 15 ile 70 karakter aralığına getirin.',
    ...overrides,
  };
}

export function makeRequest(overrides: Partial<SuggestRequest> = {}): SuggestRequest {
  return {
    product: makeProduct(),
    findings: [makeFinding()],
    ...overrides,
  };
}

/** Şemaya uyan öneri JSON'u; testler alan eklemek/bozmak için `overrides` kullanır. */
export function validSuggestionJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    title: 'Antrasit Yün Kazak Kadın Giyim Modeli',
    rationale: 'Başlık uzunluğu kuralına göre yeniden yazıldı.',
    confidence: 'medium',
    ...overrides,
  });
}

export interface TestClient {
  readonly client: LlmClient;
  readonly calls: () => number;
}

export interface CountingClientOptions {
  readonly text: string | ((input: LlmCompletionInput) => string);
  readonly model?: string;
  readonly inputTokensPerCall?: number;
}

/** `createMockClient` üzerine çağrı sayacı ekler (önbellek/kota testleri için). */
export function makeCountingClient(options: CountingClientOptions): TestClient {
  let calls = 0;
  const client = createMockClient({
    model: options.model ?? 'mock-test',
    inputTokensPerCall: options.inputTokensPerCall ?? 0,
    respond: (input: LlmCompletionInput) => {
      calls += 1;
      return typeof options.text === 'function' ? options.text(input) : options.text;
    },
  });
  return { client, calls: () => calls };
}

export type CompletionResponder = (input: LlmCompletionInput) => LlmCompletionResult;

/** Sonucu birebir döndüren (ok:false, fırlatma vb.) elle kurulmuş istemci. */
export function makeResultClient(respond: CompletionResponder, model = 'mock-retry'): TestClient {
  let calls = 0;
  const client: LlmClient = {
    kind: 'mock',
    model,
    complete: (input: LlmCompletionInput): Promise<LlmCompletionResult> => {
      calls += 1;
      return Promise.resolve(respond(input));
    },
  };
  return { client, calls: () => calls };
}

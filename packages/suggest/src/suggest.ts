/**
 * Öneri orkestrasyonu: önbellek → kota → istemci (tek yeniden deneme) → şema doğrulaması.
 *
 * Buradaki hiçbir adım denetim sonuçlarını değiştirmez ve hiçbir yere yazmaz: çıktı **yalnızca
 * öneridir**. Aynı girdi için ikinci çağrı LLM'e gitmez (maliyet kontrolü) ve sonuç kararlıdır.
 */

import { createHash } from 'node:crypto';

import { buildPrompt } from './prompt.ts';
import { parseSuggestion } from './schema.ts';
import type {
  LlmClient,
  LlmUsage,
  SuggestOutcome,
  SuggestRequest,
  SuggestStats,
  Suggestion,
  SuggestionFields,
} from './types.ts';

const ZERO_USAGE: LlmUsage = { inputTokens: 0, outputTokens: 0 };
const RETRY_DELAY_MS = 250;

export const DEFAULT_MAX_TOKENS_PER_REQUEST = 1024;
export const DEFAULT_DAILY_TOKEN_BUDGET = 200_000;
export const DEFAULT_CACHE_LIMIT = 200;

export interface SuggesterOptions {
  readonly client: LlmClient;
  /** İstek başına üst sınır (token). Varsayılan 1024. */
  readonly maxTokensPerRequest?: number;
  /** Günlük toplam token bütçesi. Varsayılan 200.000. */
  readonly dailyTokenBudget?: number;
  /** Önbellekte tutulan en fazla öneri. Varsayılan 200. */
  readonly cacheLimit?: number;
  /** Test edilebilirlik için enjekte edilebilir saat ve bekleme. */
  readonly now?: () => Date;
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface Suggester {
  suggest(request: SuggestRequest): Promise<SuggestOutcome>;
  stats(): SuggestStats;
  /** Önbelleği ve sayaçları sıfırlar (testler için). */
  reset(): void;
}

function emptyStats(): {
  requests: number;
  cacheHits: number;
  llmCalls: number;
  failures: number;
  invalidOutputs: number;
  inputTokens: number;
  outputTokens: number;
} {
  return {
    requests: 0,
    cacheHits: 0,
    llmCalls: 0,
    failures: 0,
    invalidOutputs: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
}

/** Önbellek anahtarı: model + istenen alanlar + veri gövdesi. Zaman içermez (kararlı olmalı). */
export function suggestionCacheKey(dataJson: string, targets: readonly string[], client: LlmClient): string {
  const hash = createHash('sha256');
  hash.update(`${client.kind}:${client.model ?? ''}\u0000${targets.join(',')}\u0000${dataJson}`);
  return hash.digest('hex');
}

export function createSuggester(options: SuggesterOptions): Suggester {
  const maxTokensPerRequest = options.maxTokensPerRequest ?? DEFAULT_MAX_TOKENS_PER_REQUEST;
  const dailyTokenBudget = options.dailyTokenBudget ?? DEFAULT_DAILY_TOKEN_BUDGET;
  const cacheLimit = options.cacheLimit ?? DEFAULT_CACHE_LIMIT;
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const cache = new Map<string, Suggestion>();
  let counters = emptyStats();
  let usageDay = dayKey(now());
  let tokensUsedToday = 0;

  function refreshDay(): void {
    const today = dayKey(now());
    if (today !== usageDay) {
      usageDay = today;
      tokensUsedToday = 0;
    }
  }

  function remember(key: string, suggestion: Suggestion): void {
    if (cache.size >= cacheLimit) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(key, suggestion);
  }

  async function callWithRetry(
    client: LlmClient,
    system: string,
    user: string,
  ): Promise<{ readonly ok: true; readonly text: string; readonly usage: LlmUsage } | { readonly ok: false; readonly message: string }> {
    let lastMessage = 'bilinmeyen LLM hatası';
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const result = await client.complete({ system, user, maxOutputTokens: maxTokensPerRequest });
        if (result.ok) return result;
        lastMessage = result.message;
      } catch (error: unknown) {
        lastMessage = error instanceof Error ? error.message : 'bilinmeyen LLM hatası';
      }
      if (attempt === 1) await sleep(RETRY_DELAY_MS);
    }
    return { ok: false, message: lastMessage };
  }

  return {
    async suggest(request: SuggestRequest): Promise<SuggestOutcome> {
      counters.requests += 1;
      const client = options.client;

      if (client.kind === 'disabled') {
        return {
          status: 'unavailable',
          reason: 'devre-disi',
          message: client.disabledReason ?? 'Öneri özelliği devre dışı.',
        };
      }

      const prompt = buildPrompt(request);
      const key = suggestionCacheKey(prompt.dataJson, prompt.targets, client);
      const cached = cache.get(key);
      if (cached !== undefined) {
        counters.cacheHits += 1;
        return { status: 'ok', suggestion: cached, source: 'cache', usage: ZERO_USAGE };
      }

      refreshDay();
      if (tokensUsedToday >= dailyTokenBudget) {
        return {
          status: 'unavailable',
          reason: 'kota',
          message: `Günlük LLM token bütçesi doldu (${tokensUsedToday}/${dailyTokenBudget}). Öneri üretilmedi.`,
        };
      }

      const completion = await callWithRetry(client, prompt.system, prompt.user);
      if (!completion.ok) {
        counters.failures += 1;
        return {
          status: 'unavailable',
          reason: 'llm-hata',
          message: `Öneri alınamadı (bir yeniden deneme yapıldı): ${completion.message}`,
        };
      }

      counters.llmCalls += 1;
      counters.inputTokens += completion.usage.inputTokens;
      counters.outputTokens += completion.usage.outputTokens;
      tokensUsedToday += completion.usage.inputTokens + completion.usage.outputTokens;

      const parsed = parseSuggestion(completion.text);
      if (!parsed.ok) {
        counters.invalidOutputs += 1;
        return {
          status: 'unavailable',
          reason: 'gecersiz-cikti',
          message: `Model geçerli şemada JSON döndürmedi: ${parsed.message}`,
        };
      }

      const fields: {
        title?: string;
        descriptionHtml?: string;
        seoTitle?: string;
        seoDescription?: string;
      } = {};
      const value = parsed.value;
      if (value.title !== undefined) fields.title = value.title;
      if (value.descriptionHtml !== undefined) fields.descriptionHtml = value.descriptionHtml;
      if (value.seoTitle !== undefined) fields.seoTitle = value.seoTitle;
      if (value.seoDescription !== undefined) fields.seoDescription = value.seoDescription;

      const addressedRuleIds = [...new Set(request.findings.map((finding) => finding.ruleId))].sort();
      const suggestion: Suggestion = {
        productId: request.product.id,
        model: client.model ?? 'bilinmeyen',
        fields: fields satisfies SuggestionFields,
        rationale: value.rationale,
        confidence: value.confidence,
        addressedRuleIds,
      };

      remember(key, suggestion);
      return { status: 'ok', suggestion, source: 'llm', usage: completion.usage };
    },

    stats(): SuggestStats {
      return { ...counters };
    },

    reset(): void {
      cache.clear();
      counters = emptyStats();
      usageDay = dayKey(now());
      tokensUsedToday = 0;
    },
  };
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

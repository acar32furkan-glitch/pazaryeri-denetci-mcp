/**
 * LLM istemcileri.
 *
 * Üç yol var ve hiçbiri denetimi etkilemez:
 * - `anthropic`: gerçek model (model adı `LLM_MODEL` ortam değişkeninden gelir, koda gömülmez),
 * - `mock`: testler ve anahtarsız demo için deterministik sahte istemci,
 * - `disabled`: API anahtarı yok — `suggest_fix` "devre dışı" der, uygulama çalışmaya devam eder.
 */

import Anthropic from '@anthropic-ai/sdk';

import type { LlmClient, LlmCompletionInput, LlmCompletionResult } from './types.ts';

export const DEFAULT_LLM_TIMEOUT_MS = 20_000;

/** Anahtar yok: öneri özelliği kapalı, gerekçe mesajla birlikte döner. */
export function createDisabledClient(message: string): LlmClient {
  return {
    kind: 'disabled',
    model: null,
    disabledReason: message,
    complete: () => Promise.resolve<LlmCompletionResult>({ ok: false, message }),
  };
}

export interface MockClientOptions {
  readonly respond: (input: LlmCompletionInput) => string | Promise<string>;
  readonly model?: string;
  readonly inputTokensPerCall?: number;
}

/** Deterministik sahte istemci: ağ yok, maliyet yok. Testler ve anahtarsız demo bunu kullanır. */
export function createMockClient(options: MockClientOptions): LlmClient {
  const model = options.model ?? 'mock-model';
  const usage = options.inputTokensPerCall ?? 0;
  return {
    kind: 'mock',
    model,
    complete: async (input: LlmCompletionInput): Promise<LlmCompletionResult> => {
      const text = await options.respond(input);
      return {
        ok: true,
        text,
        usage: { inputTokens: usage, outputTokens: Math.ceil(text.length / 4) },
      };
    },
  };
}

export interface AnthropicClientOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs?: number;
}

/** Gerçek istemci. SDK'nın kendi yeniden denemesini kapatıyoruz: tekrar deneme tek yerde (suggest). */
export function createAnthropicClient(options: AnthropicClientOptions): LlmClient {
  const client = new Anthropic({
    apiKey: options.apiKey,
    maxRetries: 0,
    timeout: options.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS,
  });

  return {
    kind: 'anthropic',
    model: options.model,
    complete: async (input: LlmCompletionInput): Promise<LlmCompletionResult> => {
      try {
        const message = await client.messages.create({
          model: options.model,
          max_tokens: input.maxOutputTokens,
          system: input.system,
          messages: [{ role: 'user', content: input.user }],
        });
        const text = message.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('');
        return {
          ok: true,
          text,
          usage: {
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
          },
        };
      } catch (error: unknown) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'bilinmeyen LLM hatası',
        };
      }
    },
  };
}

export interface LlmEnv {
  readonly ANTHROPIC_API_KEY?: string | undefined;
  readonly LLM_MODEL?: string | undefined;
}

/**
 * Ortamdan istemci seçer. Anahtar yoksa veya model adı tanımlı değilse **devre dışı** döner:
 * model adı koda gömülmediği için eksik yapılandırma sessizce varsayılana düşemez.
 */
export function createLlmClientFromEnv(env: LlmEnv, timeoutMs?: number): LlmClient {
  const apiKey = env.ANTHROPIC_API_KEY?.trim() ?? '';
  const model = env.LLM_MODEL?.trim() ?? '';

  if (apiKey === '') {
    return createDisabledClient(
      'Öneri özelliği devre dışı: ANTHROPIC_API_KEY tanımlı değil. Denetim sonuçları bundan etkilenmez.',
    );
  }
  if (model === '') {
    return createDisabledClient(
      'Öneri özelliği devre dışı: LLM_MODEL tanımlı değil (model adı koda gömülmez, ortamdan okunur).',
    );
  }

  return timeoutMs === undefined
    ? createAnthropicClient({ apiKey, model })
    : createAnthropicClient({ apiKey, model, timeoutMs });
}

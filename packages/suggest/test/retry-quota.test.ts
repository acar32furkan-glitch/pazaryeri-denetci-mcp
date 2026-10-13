import { describe, expect, it } from 'vitest';

import { createDisabledClient, createSuggester } from '../src/index.ts';
import type { LlmClient, LlmCompletionResult } from '../src/index.ts';
import {
  makeCountingClient,
  makeProduct,
  makeRequest,
  makeResultClient,
  validSuggestionJson,
} from './factories.ts';

/** Yeniden deneme, kota, devre dışı ve geçersiz çıktı yolları — hiçbiri denetimi etkilemez. */

const noSleep = (): Promise<void> => Promise.resolve();

describe('yeniden deneme (tek deneme sonrası)', () => {
  it('ilk çağrı hatalı, ikinci başarılıysa sonuç ok ve istemci 2 kez çağrılır', async () => {
    let attempt = 0;
    const { client, calls } = makeResultClient(() => {
      attempt += 1;
      if (attempt === 1) return { ok: false, message: 'geçici ağ hatası' };
      return {
        ok: true,
        text: validSuggestionJson(),
        usage: { inputTokens: 10, outputTokens: 5 },
      };
    });
    const suggester = createSuggester({ client, sleep: noSleep });

    const outcome = await suggester.suggest(makeRequest());

    expect(outcome.status).toBe('ok');
    expect(calls()).toBe(2);
    expect(suggester.stats().failures).toBe(0);
  });

  it('her zaman hata veren istemci → llm-hata, 2 deneme, failures=1', async () => {
    const { client, calls } = makeResultClient(() => ({ ok: false, message: 'kalıcı hata' }));
    const suggester = createSuggester({ client, sleep: noSleep });

    const outcome = await suggester.suggest(makeRequest());

    expect(outcome).toMatchObject({ status: 'unavailable', reason: 'llm-hata' });
    expect(calls()).toBe(2);
    expect(suggester.stats().failures).toBe(1);
  });

  it('fırlatan istemci de llm-hata olarak yakalanır', async () => {
    const { client, calls } = makeResultClient(() => {
      throw new Error('patlama');
    });
    const suggester = createSuggester({ client, sleep: noSleep });

    const outcome = await suggester.suggest(makeRequest());

    expect(outcome).toMatchObject({ status: 'unavailable', reason: 'llm-hata' });
    expect(calls()).toBe(2);
  });
});

describe('günlük token kotası', () => {
  it('bütçe dolunca ikinci istek kota, gün değişince sıfırlanır', async () => {
    const { client } = makeCountingClient({
      text: validSuggestionJson(),
      inputTokensPerCall: 100,
    });
    let current = new Date('2026-10-13T09:00:00.000Z');
    const suggester = createSuggester({
      client,
      dailyTokenBudget: 100,
      now: () => current,
      sleep: noSleep,
    });

    const first = makeRequest({ product: makeProduct({ id: 'p-a' }) });
    const second = makeRequest({ product: makeProduct({ id: 'p-b' }) });

    expect((await suggester.suggest(first)).status).toBe('ok');
    expect(await suggester.suggest(second)).toMatchObject({
      status: 'unavailable',
      reason: 'kota',
    });

    // Gün değişti: kota sıfırlanır ve aynı (önbelleğe yazılmamış) istek yeniden başarılı olur.
    current = new Date('2026-10-14T09:00:00.000Z');
    expect((await suggester.suggest(second)).status).toBe('ok');
  });
});

describe('devre dışı istemci', () => {
  it('createDisabledClient → devre-disi ve mesaj korunur', async () => {
    const message = 'Öneri özelliği devre dışı: ANTHROPIC_API_KEY yok.';
    const suggester = createSuggester({ client: createDisabledClient(message), sleep: noSleep });

    const outcome = await suggester.suggest(makeRequest());

    expect(outcome).toMatchObject({ status: 'unavailable', reason: 'devre-disi', message });
  });

  it('devre dışı istemcinin complete metodu çağrılmaz', async () => {
    let calls = 0;
    const client: LlmClient = {
      kind: 'disabled',
      model: null,
      disabledReason: 'kapalı (test)',
      complete: (): Promise<LlmCompletionResult> => {
        calls += 1;
        return Promise.resolve({ ok: false, message: 'kapalı' });
      },
    };
    const suggester = createSuggester({ client, sleep: noSleep });

    const outcome = await suggester.suggest(makeRequest());

    expect(outcome).toMatchObject({ status: 'unavailable', reason: 'devre-disi' });
    expect(calls).toBe(0);
    expect(suggester.stats().llmCalls).toBe(0);
  });
});

describe('geçersiz model çıktısı', () => {
  it('JSON olmayan çıktı gecersiz-cikti ve önbelleğe yazılmaz', async () => {
    const { client, calls } = makeCountingClient({ text: 'merhaba' });
    const suggester = createSuggester({ client, sleep: noSleep });
    const request = makeRequest();

    const first = await suggester.suggest(request);

    expect(first).toMatchObject({ status: 'unavailable', reason: 'gecersiz-cikti' });
    expect(calls()).toBe(1);
    expect(suggester.stats().invalidOutputs).toBe(1);
    expect(suggester.stats().cacheHits).toBe(0);

    // Önbelleğe yazılmadığı için aynı istek yine LLM'e gider.
    const second = await suggester.suggest(request);
    expect(second).toMatchObject({ status: 'unavailable', reason: 'gecersiz-cikti' });
    expect(calls()).toBe(2);
    expect(suggester.stats().cacheHits).toBe(0);
  });
});

describe('denetim bağımsızlığı', () => {
  it('her zaman hata veren istemciyle suggest fırlatmaz, unavailable döner', async () => {
    const { client } = makeResultClient(() => ({ ok: false, message: 'sürekli hata' }));
    const suggester = createSuggester({ client, sleep: noSleep });

    await expect(suggester.suggest(makeRequest())).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'llm-hata',
    });
  });
});

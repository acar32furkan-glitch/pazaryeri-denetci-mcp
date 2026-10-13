import { describe, expect, it } from 'vitest';

import { createMockClient, createSuggester, suggestionCacheKey } from '../src/index.ts';
import { makeCountingClient, makeProduct, makeRequest, validSuggestionJson } from './factories.ts';

/** Önbellek: aynı girdi ikinci kez sorulduğunda LLM'e gidilmez; farklı girdi yeni çağrı üretir. */

const noSleep = (): Promise<void> => Promise.resolve();

describe('önbellek davranışı', () => {
  it('aynı istek ikinci kez istemciyi HİÇ çağırmaz', async () => {
    const { client, calls } = makeCountingClient({ text: validSuggestionJson() });
    const suggester = createSuggester({ client, sleep: noSleep });
    const request = makeRequest();

    const first = await suggester.suggest(request);
    const second = await suggester.suggest(request);

    expect(first.status).toBe('ok');
    expect(first).toMatchObject({ source: 'llm' });
    expect(second.status).toBe('ok');
    expect(second).toMatchObject({ source: 'cache' });
    if (second.status === 'ok') {
      expect(second.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    }
    expect(calls()).toBe(1);
    const stats = suggester.stats();
    expect(stats.requests).toBe(2);
    expect(stats.cacheHits).toBe(1);
    expect(stats.llmCalls).toBe(1);
  });

  it('farklı ürün için ikinci LLM çağrısı yapılır', async () => {
    const { client, calls } = makeCountingClient({ text: validSuggestionJson() });
    const suggester = createSuggester({ client, sleep: noSleep });

    await suggester.suggest(makeRequest({ product: makeProduct({ id: 'p-bir' }) }));
    await suggester.suggest(makeRequest({ product: makeProduct({ id: 'p-iki' }) }));

    expect(calls()).toBe(2);
    expect(suggester.stats().cacheHits).toBe(0);
  });

  it('cacheLimit aşıldığında en eski kayıt düşer ve o istek yeniden sorulur', async () => {
    const { client, calls } = makeCountingClient({ text: validSuggestionJson() });
    const suggester = createSuggester({ client, cacheLimit: 2, sleep: noSleep });

    const first = makeRequest({ product: makeProduct({ id: 'p-a' }) });
    const second = makeRequest({ product: makeProduct({ id: 'p-b' }) });
    const third = makeRequest({ product: makeProduct({ id: 'p-c' }) });

    await suggester.suggest(first);
    await suggester.suggest(second);
    await suggester.suggest(third);
    expect(calls()).toBe(3);

    // 3. istek eklenirken en eski (p-a) düştü → aynı istek yeniden LLM'e gider.
    const again = await suggester.suggest(first);
    expect(calls()).toBe(4);
    expect(again).toMatchObject({ source: 'llm' });
    expect(suggester.stats().cacheHits).toBe(0);
  });
});

describe('suggestionCacheKey determinizm', () => {
  it('aynı girdi için aynı, farklı model için farklı anahtar üretir', () => {
    const clientA = createMockClient({ respond: () => '', model: 'model-a' });
    const clientB = createMockClient({ respond: () => '', model: 'model-b' });
    const dataJson = '{"id":"p-1","title":"örnek"}';
    const targets = ['title'];

    expect(suggestionCacheKey(dataJson, targets, clientA)).toBe(
      suggestionCacheKey(dataJson, targets, clientA),
    );
    expect(suggestionCacheKey(dataJson, targets, clientA)).not.toBe(
      suggestionCacheKey(dataJson, targets, clientB),
    );
  });
});

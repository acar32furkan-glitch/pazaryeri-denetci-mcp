import { describe, expect, it } from 'vitest';

import { buildPrompt, createDemoMockClient, parseSuggestion } from '../src/index.ts';
import type { LlmClient, SuggestRequest } from '../src/index.ts';
import { makeFinding, makeProduct, makeRequest } from './factories.ts';

/**
 * Demo mock istemci: gerçek model çağırmadan, bulgulara uyan ve kurallara (başlık 15–70,
 * açıklama ≥120 düz metin, yalnızca güvenli etiketler) uyan deterministik öneri üretir.
 */

const demoClient: LlmClient = createDemoMockClient();

async function runDemo(request: SuggestRequest): Promise<string> {
  const prompt = buildPrompt(request);
  const result = await demoClient.complete({
    system: prompt.system,
    user: prompt.user,
    maxOutputTokens: 1024,
  });
  if (!result.ok) throw new Error('demo istemci başarısız sonuç döndü');
  return result.text;
}

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

describe('createDemoMockClient', () => {
  it('title bulgusunda şemaya uyan ve 15–70 karakter başlık üretir', async () => {
    const request = makeRequest({
      product: makeProduct({ id: 'demo-title', title: 'kısa başlık' }),
      findings: [makeFinding({ ruleId: 'TITLE_LENGTH', field: 'title', severity: 'major' })],
    });

    const parsed = parseSuggestion(await runDemo(request));

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const title = parsed.value.title;
      expect(title).toBeDefined();
      if (title !== undefined) {
        expect(title.length).toBeGreaterThanOrEqual(15);
        expect(title.length).toBeLessThanOrEqual(70);
      }
    }
  });

  it('descriptionHtml hedeflendiğinde ≥120 düz metin ve güvenli etiketler üretir', async () => {
    const request = makeRequest({
      product: makeProduct({ id: 'demo-desc', title: 'Antrasit Yün Kazak' }),
      findings: [
        makeFinding({
          ruleId: 'DESC_TOO_SHORT',
          field: 'descriptionHtml',
          severity: 'major',
          message: 'Açıklama çok kısa: 20 karakter.',
          fixHint: 'Açıklamayı en az 120 karaktere çıkarın.',
        }),
      ],
    });

    const parsed = parseSuggestion(await runDemo(request));

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const html = parsed.value.descriptionHtml;
      expect(html).toBeDefined();
      if (html !== undefined) {
        expect(plainText(html).length).toBeGreaterThanOrEqual(120);
        expect(html).not.toMatch(/<script/iu);
        expect(html).not.toMatch(/<iframe/iu);
        expect(html).not.toMatch(/on[a-z]+\s*=/iu);
        expect(html).not.toMatch(/javascript:/iu);
      }
    }
  });

  it('aynı girdi iki kez sorulduğunda birebir aynı çıktıyı üretir (determinizm)', async () => {
    const request = makeRequest({
      product: makeProduct({ id: 'demo-det', title: 'Antrasit Yün Kazak Kadın Giyim' }),
    });

    const first = await runDemo(request);
    const second = await runDemo(request);

    expect(first).toBe(second);
    expect(parseSuggestion(first).ok).toBe(true);
  });
});

/**
 * Demo/test için deterministik sahte istemci.
 *
 * DİKKAT: Bu istemci **gerçek model çağırmaz**. Anahtarsız demoda ve testlerde kullanılır; ürettiği
 * metin bulgulara bakılarak kurallara uyacak biçimde şablonla üretilir. Araç çıktısında model adı
 * `mock-demo` görünür, böylece "bu bir öneri mi, sahte mi" karışıklığı olmaz.
 */

import { z } from 'zod';

import { createMockClient } from './clients.ts';
import { FENCE_END, FENCE_START } from './prompt.ts';
import type { LlmClient } from './types.ts';

/** core'daki eşiklerle aynı olmalı (drift olursa eval kalite kontrolü yakalar). */
const TITLE_MIN = 15;
const TITLE_MAX = 70;
const DESC_MIN = 120;

const DemoPayloadSchema = z.object({
  id: z.string(),
  title: z.string(),
  descriptionHtml: z.string(),
  productType: z.string(),
  vendor: z.string(),
  tags: z.array(z.string()),
  findings: z.array(z.object({ ruleId: z.string(), field: z.string() })).max(50),
});

type DemoPayload = z.infer<typeof DemoPayloadSchema>;

export interface DemoMockOptions {
  readonly model?: string;
  /** Prompt'taki veri bloğu okunamazsa kullanılacak ürün kimliği. */
  readonly fallbackProductId?: string;
}

/** Prompt'un veri bloğunu çıkarır (mock, kendi kurduğumuz zarfı bilir). */
function readPayload(user: string): DemoPayload | null {
  const start = user.indexOf(FENCE_START);
  const end = user.indexOf(FENCE_END);
  if (start === -1 || end === -1 || end <= start) return null;
  const raw = user.slice(start + FENCE_START.length, end).trim();
  try {
    const parsed = DemoPayloadSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function words(text: string): string[] {
  return text
    .replace(/<[^>]*>/gu, ' ')
    .split(/\s+/u)
    .filter((word) => word.length > 0);
}

/** Başlığı kural sınırlarına getirir: en az 20, en fazla 70 karakter, kelime ortasından kesmez. */
function fixTitle(title: string, suffix: string): string {
  const parts = words(title);
  if (parts.length === 0) return `Sentetik Ürün ${suffix}`.slice(0, TITLE_MAX);

  let out = '';
  for (const part of parts) {
    const candidate = out === '' ? part : `${out} ${part}`;
    if (candidate.length > TITLE_MAX) break;
    out = candidate;
    if (out.length >= 25) break;
  }
  if (out.length < TITLE_MIN) out = `${out} ${suffix}`.trim();
  return out.length > TITLE_MAX ? out.slice(0, TITLE_MAX).trim() : out;
}

/** Açıklamayı kural sınırının (120 karakter düz metin) üstüne çıkarır; yalnızca güvenli etiketler. */
function fixDescription(payload: DemoPayload): string {
  const type = payload.productType === '' ? 'ürün' : payload.productType;
  const tagLine = payload.tags.length > 0 ? payload.tags.slice(0, 5).join(', ') : 'sentetik katalog';
  return [
    `<p><strong>${fixTitle(payload.title, type)}</strong> — ${type} kategorisinde, günlük kullanıma`,
    'uygun sentetik demo ürünü. Bu metin örnek veri üzerinde çalışan denetim aracı için üretilmiştir.</p>',
    `<ul><li>Kategori: ${type}</li><li>Etiketler: ${tagLine}</li>`,
    `<li>Satıcı: ${payload.vendor === '' ? 'Sentetik Satıcı' : payload.vendor}</li></ul>`,
  ].join('');
}

/** Hedef alanları bulgulardan türetir (yalnızca düzeltme istenen alanlar doldurulur). */
function targetsFromFindings(payload: DemoPayload): ReadonlySet<string> {
  return new Set(payload.findings.map((finding) => finding.field));
}

export function createDemoMockClient(options: DemoMockOptions = {}): LlmClient {
  const model = options.model ?? 'mock-demo';
  return createMockClient({
    model,
    inputTokensPerCall: 800,
    respond: (input) => {
      const payload = readPayload(input.user);
      if (payload === null) {
        return JSON.stringify({
          rationale: 'Veri bloğu okunamadı (mock istemci).',
          confidence: 'low',
        });
      }

      const targets = targetsFromFindings(payload);
      const suffix = payload.productType === '' ? 'Sentetik Ürün' : payload.productType;
      const suggestion: Record<string, string> = {};

      if (targets.has('title') || targets.size === 0) {
        suggestion['title'] = fixTitle(payload.title, suffix);
      }
      if (targets.has('descriptionHtml') || targets.has('description')) {
        suggestion['descriptionHtml'] = fixDescription(payload);
      }
      if (targets.has('seoTitle')) {
        suggestion['seoTitle'] = fixTitle(payload.title, suffix).slice(0, 60);
      }
      if (targets.has('seoDescription')) {
        suggestion['seoDescription'] = `${fixTitle(payload.title, suffix)} — ${suffix} kategorisinde sentetik demo ürünü.`.slice(
          0,
          160,
        );
      }

      return JSON.stringify({
        ...suggestion,
        rationale:
          'Mock istemci: bulgularda geçen alanlar Türkçe metin kurallarına göre yeniden yazıldı.',
        confidence: 'medium',
      });
    },
  });
}

/** Test/demo varsayılanları — `DESC_MIN` burada yalnızca belgeleme amaçlıdır. */
export const DEMO_MOCK_LIMITS = { TITLE_MIN, TITLE_MAX, DESC_MIN } as const;

/**
 * LLM çıktısının şema doğrulaması.
 *
 * Model geçerli JSON döndürmediyse öneri **sessizce kabul edilmez**: doğrulama başarısız olur ve
 * çağıran `gecersiz-cikti` durumunu görür. Denetim sonuçları bu katmandan bağımsızdır.
 */

import { z } from 'zod';

/** Çıktıda kabul edilen en fazla uzunluklar — model abartılı metin döndürürse reddedilir. */
export const LLM_MAX = {
  title: 300,
  descriptionHtml: 20000,
  seoTitle: 300,
  seoDescription: 500,
  rationale: 2000,
} as const;

/** Önerilen açıklamada asla kabul edilmeyen diziler (savunma katmanı; asıl temizlik core'da). */
const UNSAFE_HTML = /<\s*script|<\s*iframe|javascript:|on[a-z]+\s*=/iu;

export const LlmSuggestionSchema = z
  .object({
    title: z.string().min(1).max(LLM_MAX.title).optional(),
    descriptionHtml: z.string().min(1).max(LLM_MAX.descriptionHtml).optional(),
    seoTitle: z.string().min(1).max(LLM_MAX.seoTitle).optional(),
    seoDescription: z.string().min(1).max(LLM_MAX.seoDescription).optional(),
    rationale: z.string().min(1).max(LLM_MAX.rationale),
    confidence: z.enum(['low', 'medium', 'high']),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.descriptionHtml !== undefined ||
      value.seoTitle !== undefined ||
      value.seoDescription !== undefined,
    { message: 'En az bir öneri alanı (title/descriptionHtml/seoTitle/seoDescription) dolu olmalı' },
  )
  .refine(
    (value) => value.descriptionHtml === undefined || !UNSAFE_HTML.test(value.descriptionHtml),
    { message: 'Önerilen açıklama güvensiz HTML içeriyor (script/iframe/javascript:/olay işleyicisi)' },
  );

export type LlmSuggestion = z.infer<typeof LlmSuggestionSchema>;

/**
 * Metinden ilk JSON nesnesini çıkarır: kod bloğu çitlerini soyar, ilk `{` ile son `}` arasını alır.
 * Model JSON'un etrafına açıklama yazmışsa bu yine de kurtarılır; JSON yoksa `null`.
 */
export function extractJsonObject(text: string): string | null {
  const withoutFences = text.replace(/```(?:json)?/giu, '');
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return withoutFences.slice(start, end + 1);
}

export type ParseResult =
  | { readonly ok: true; readonly value: LlmSuggestion }
  | { readonly ok: false; readonly message: string };

/** Model çıktısını doğrular. Geçersizse güvenli biçimde reddeder (asla yarım veri döndürmez). */
export function parseSuggestion(raw: string): ParseResult {
  const json = extractJsonObject(raw);
  if (json === null) {
    return { ok: false, message: 'Çıktıda JSON nesnesi bulunamadı' };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(json);
  } catch {
    return { ok: false, message: 'Çıktıdaki JSON çözümlenemedi' };
  }

  const result = LlmSuggestionSchema.safeParse(decoded);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 4)
      .map((issue) => `${issue.path.join('.') || '(kök)'}: ${issue.message}`)
      .join('; ');
    return { ok: false, message: `Şema doğrulaması başarısız — ${issues}` };
  }

  return { ok: true, value: result.data };
}

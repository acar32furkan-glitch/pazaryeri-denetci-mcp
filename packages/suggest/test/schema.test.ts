import { describe, expect, it } from 'vitest';

import { LLM_MAX, parseSuggestion } from '../src/index.ts';

/**
 * Şema doğrulaması: model geçersiz çıktı döndürdüğünde öneri sessizce kabul edilmez ve
 * kullanıcıya Türkçe bir ret mesajı döner.
 */

const VALID_VALUE = {
  title: 'Antrasit Yün Kazak Kadın Giyim Modeli',
  rationale: 'Başlık uzunluğu kuralına göre yeniden yazıldı.',
  confidence: 'medium',
} as const;

describe('parseSuggestion — şema doğrulaması', () => {
  it('geçerli düz JSON kabul edilir', () => {
    const result = parseSuggestion(JSON.stringify(VALID_VALUE));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.title).toBe(VALID_VALUE.title);
  });

  it('```json çiti içindeki çıktı kabul edilir', () => {
    const text = '```json\n' + JSON.stringify(VALID_VALUE) + '\n```';
    expect(parseSuggestion(text).ok).toBe(true);
  });

  it('JSON etrafında açıklama metni olsa da kabul edilir', () => {
    const text = `İşte önerilen düzeltme:\n${JSON.stringify(VALID_VALUE)}\nBaşka açıklama yok.`;
    expect(parseSuggestion(text).ok).toBe(true);
  });

  it('eksik rationale reddedilir ve Türkçe mesaj döner', () => {
    const result = parseSuggestion(
      JSON.stringify({ title: 'Geçerli uzunlukta bir başlık', confidence: 'low' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/Şema doğrulaması başarısız/);
  });

  it('<script> içeren descriptionHtml reddedilir', () => {
    const result = parseSuggestion(
      JSON.stringify({
        ...VALID_VALUE,
        descriptionHtml: '<p>Geçerli metin</p><script>alert(1)</script>',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('güvensiz HTML');
  });

  it('onclick= olay işleyicisi içeren descriptionHtml reddedilir', () => {
    const result = parseSuggestion(
      JSON.stringify({
        ...VALID_VALUE,
        descriptionHtml: '<p onclick="sizinti()">tıkla</p>',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('güvensiz HTML');
  });

  it('300+ karakter başlık reddedilir', () => {
    const result = parseSuggestion(
      JSON.stringify({ ...VALID_VALUE, title: 'x'.repeat(LLM_MAX.title + 1) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('title');
  });

  it('hiçbir öneri alanı dolu değilse reddedilir', () => {
    const result = parseSuggestion(
      JSON.stringify({ rationale: 'Yalnızca gerekçe var, öneri yok.', confidence: 'low' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('En az bir öneri alanı');
  });

  it('JSON yoksa reddedilir ve Türkçe mesaj döner', () => {
    const result = parseSuggestion('merhaba, burada hiç JSON yok');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('JSON nesnesi bulunamadı');
  });
});

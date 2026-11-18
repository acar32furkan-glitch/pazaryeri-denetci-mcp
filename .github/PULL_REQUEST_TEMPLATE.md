## Ne değişti?

<!-- Kısa özet. Örnek: "SKU çakışma kuralı artık varyant barkodlarını da karşılaştırıyor" -->

## Neden?

<!-- Hangi sorunu çözüyor / hangi issue'yu kapatıyor: Closes #12 -->

## Nasıl test edildi?

- [ ] `pnpm run gates` (yeni test eklendi: evet/hayır)
- [ ] `pnpm run eval:check` (kural eklendiyse/değiştiyse)
- [ ] Gerekliyse `pnpm run mcp:stdio` ile elle denendi

## Kontrol listesi

- [ ] Kurallar deterministik kaldı; LLM bulgu üretmiyor (ADR-002)
- [ ] Salt-okunur ilke korundu (satıcı hesabında yazma yok)
- [ ] Kullanıcıya dönük metinler Türkçe ve eylem odaklı
- [ ] `CHANGELOG.md` güncellendi
- [ ] Gizli bilgi, gerçek müşteri/mağaza verisi eklenmedi

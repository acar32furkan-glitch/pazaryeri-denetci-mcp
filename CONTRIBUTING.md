# Katkı Rehberi

Teşekkürler! Bu proje, pazaryeri kataloglarını **deterministik kurallarla** denetleyen ve bunu salt-okunur
bir MCP sunucusu olarak sunan bir TypeScript monorepodur. Katkıların bu ilkelere uyması gerekir
(gerekçeler: [`docs/DECISIONS.md`](docs/DECISIONS.md)).

## Hızlı kurulum

Gereksinimler: Node.js 20+ ve pnpm.

```bash
git clone https://github.com/acar32furkan-glitch/pazaryeri-denetci-mcp
cd pazaryeri-denetci-mcp
pnpm install
pnpm run gates          # lint · biçim · tip denetimi · test
pnpm run eval:check     # kural bazlı precision/recall eşik kapısı
pnpm run mcp:stdio      # MCP sunucusunu yerelde başlatır (kimlik bilgisi gerekmez)
```

## Kalite kapısı (PR öncesi hepsi yeşil olmalı)

```bash
pnpm run lint
pnpm run format:check   # düzeltmek için: pnpm run format
pnpm run typecheck
pnpm run test
pnpm run eval:check     # kural eklediyseniz veya değiştirdiyseniz
```

CI aynı kapıları çalıştırır; yeşil olmayan PR birleştirilmez.

## Tasarım ilkeleri

1. **Kurallar deterministiktir, LLM yalnızca öneri üretir** (ADR-002). Bulgu üretimine LLM karıştırmayın;
   aynı girdi her zaman aynı bulguyu vermelidir. Aksi halde precision/recall ölçülemez.
2. **Mock-first ve sentetik veri** (ADR-003). Depoya gerçek mağaza, ürün, müşteri verisi veya kimlik
   bilgisi eklemeyin. Örnek veriler seed'li üreticiden gelir ve her enjekte edilen hata etiketlidir.
3. **Salt-okunur.** MCP araçları satıcı hesabında değişiklik yapmaz. Yazma gerektiren bir özellik
   önermeden önce `docs/DECISIONS.md` altında bir karar kaydı (ADR) açın.
4. **Yeni kural = test + eval.** Kuralı saf fonksiyon olarak `packages/core/src/rules/` altında yazın ve `rules/index.ts` içinde kaydedin; hem birim testini hem de `packages/eval` içindeki enjekte-hata kapsamını ekleyin. Eval eşikleri `packages/eval/src/thresholds.ts` içindedir; bir eşiği gevşetmek için gerekçeyi PR açıklamasına yazın.
5. **Ölçülmemiş sayı yok.** Belgelerde bir performans/doğruluk sayısı veriyorsanız yanına nasıl
   ölçüldüğünü yazın (`docs/PERFORMANS.md` ve `docs/EVAL.md` örnek).

## Kullanıcıya dönük metin

Bulgular Türkçe ve eylem odaklı yazılır: ne bulundu, hangi ürünü etkiliyor, bugün ne yapılmalı.
Yeni kural eklerken mevcut mesajların tonunu koruyun.

## Commit ve PR

- Conventional Commits: `feat(kural):`, `fix(mcp):`, `docs:`, `test:`, `chore:`.
- Her PR tek bir konuyu ele alır; açıklamada "ne / neden / nasıl test edildi" bulunur.
- `CHANGELOG.md` aynı PR içinde güncellenir ([Keep a Changelog](https://keepachangelog.com/tr/1.1.0/)).
- `docs/EVAL.md` üreticiden gelir; elle düzenlemeyin (`pnpm run eval` ile yeniden üretilir).
- PR şablonundaki kontrol listesini doldurun.

## Veri ve gizlilik

- **Gerçek API anahtarı, müşteri adı, sipariş numarası veya mağaza verisi eklemeyin.**
- `.env` dosyaları depoya girmez; yalnızca `.env.example` bulunur.
- Herkese açık demo yalnızca sentetik veri kullanır.

## Lisans

Katkılarınız MIT lisansı altında yayınlanır.

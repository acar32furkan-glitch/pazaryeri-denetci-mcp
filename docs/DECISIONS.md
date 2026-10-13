# Teknik Kararlar (DECISIONS)

Bu dosya, alınan mimari kararların **gerekçesini** ve bilinçli olarak alınan varsayımları tutar.
Biçim: her karar bir ADR kaydı; "neden" sorusunu ve reddedilen alternatifleri içerir.

Yazım kuralı: ölçülmüş bir olgu iddia ediliyorsa yanına **nasıl ölçüldüğü** yazılır. Ölçülmemiş
hiçbir sayı buraya girmez.

---

## ADR-001 — Denetimi neden MCP sunucusu olarak sunuyoruz?

**Karar:** Denetim çekirdeği saf TypeScript fonksiyonlarıdır; üzerine MCP SDK v2 ile bir sunucu
eklenir ve ajanlar araçları stdio (yerel) / Streamable HTTP (canlı) üzerinden çağırır.

**Neden:** Bu bir kütüphane olsaydı kullanıcı yine elle rapor okurdu. MCP, "kataloğu denetle, en
kritik 10 bulguyu getir, şu ürünün başlığını nasıl düzeltirim" gibi **konuşma içi** iş akışını
mümkün kılar ve araç sözleşmesi (girdi/çıktı şeması) ajana doğru seçimi yaptırır.

**Reddedilen alternatifler:** (a) CLI-only — ajan entegrasyonu yok; (b) REST API — ajan tarafı
keşfi elle yapılmalı, araç açıklamaları taşınmaz.

## ADR-002 — Kurallar deterministik, LLM yalnızca öneri

**Karar:** Bulguların tamamı saf fonksiyonlarla üretilir. LLM yalnızca `suggest_fix` aracında metin
önerisi üretir; denetim sonucunu **değiştirmez**.

**Neden:** LLM bulgu üretirse aynı girdi farklı sonuç verir; precision/recall ölçülemez, CI'da
regresyon kapısı kurulamaz, test yazılamaz. Ölçülebilirlik bu projenin ayırt edici iddiasıdır.

**Sonuç:** LLM anahtarı yokken uygulama tüm denetim işlevini eksiksiz yerine getirir.

## ADR-003 — Mock-first ve sentetik veri

**Karar:** Gerçek Shopify/pazaryeri kimlik bilgisi kullanılmaz. Katalog, seed'li deterministik bir
üretici ile üretilir ve **her enjekte edilen hata etiketlenir** (`injectedDefects`).

**Neden:** (a) Gerçek müşteri/ürün verisi depoda bulunamaz — hem gizlilik hem portföy etiği;
(b) eval için "gerçek doğruluk" verisi gerekiyor, etiketler bu yüzden üreticinin çıktısıdır.

## ADR-004 — Teknoloji yığını ve **ölçülmüş** sürümler

**Karar:** TypeScript (strict) + pnpm workspaces + MCP TS SDK v2 + Zod v4 + Vitest + Next.js (Faz 4).

**Ölçüm (2026-10-13, `npm view <paket> version`)**: `@modelcontextprotocol/server` **2.3.1**
(`latest`, spec revizyonu **2026-07-28**), `client` 2.3.1, `node` 2.1.1, `express` 2.0.2,
`zod` 4.6.7, `vitest` 5.0.4, `next` 16.4.0, `csv-parse` 7.0.3, `@anthropic-ai/sdk` 0.133.0,
`typescript` 7.0.2 (`latest`), `typescript-eslint` 8.71.2.

**Neden v2:** v1 paketi (`@modelcontextprotocol/sdk`) artık bakım hattı; v2 stabil sürüm çizgisi.
v2'nin API farkları koda yansıtılır: `server.registerTool(...)`, `StdioServerTransport`
`@modelcontextprotocol/server/stdio` alt yolundan, HTTP taşıması
`NodeStreamableHTTPServerTransport` (`@modelcontextprotocol/node`).

## ADR-005 — TypeScript 7 değil, 5.9.3'e sabit

**Ölçüm:** `npm view typescript-eslint peerDependencies` → `typescript: '>=4.8.4 <6.1.0'`.
`npm view typescript version` → 7.0.2 (`latest`).

**Karar:** `typescript@5.9.3` sabitlenir. Tipli lint (type-checked kurallar) zinciri TS 7'yi
desteklemiyor; lint kalitesinden vazgeçmek yerine tip sürümü geriye alınır. Yeniden değerlendirme
koşulu: `typescript-eslint` peer aralığı TS 7'yi kapsadığında.

## ADR-006 — Uçtan uca tipli, kurulum sırasına bağımlı olmayan test çözümlemesi

**Karar:** Paketler derlenmeden (kaynak TS) tüketilir; `vitest.config.ts` paket adlarını doğrudan
`packages/<ad>/src/index.ts` yoluna bağlar. Böylece `pnpm test` ve `pnpm typecheck` için build adımı
gerekmez, kırılgan symlink çözümlemesine güvenilmez. Build Faz 3'te (MCP sunucusunun çalıştırılabilir
girdisi için) eklenir.

## ADR-007 — Bulgu sıralaması kararlı olmalı

**Karar:** Bulgular `(severity ağırlığı, ruleId, productId, variantSku)` sırasına göre sıralanır;
eşitlikte alan adına göre. Kural kayıt defteri sabit sırada yürütülür.

**Neden:** Deterministik olmayan sıralama eval'i ve snapshot testlerini güvenilmez kılar
(bkz. Bölüm "uç durumlar").

## ADR-008 — Kurallar "örnek ve yapılandırılabilir" kümedir

**Karar:** Kural kimlikleri, şiddet seviyeleri, mesajlar ve `appliesTo` kanalları bir kural
kataloğunda tanımlanır; kodda "resmî pazaryeri kuralı" gibi sunulmaz. README'de "örnek kurallar;
resmî dokümandan doğrulanmalı" uyarısı bulunur.

**Neden:** Kategori bazlı zorunlu alanlar ve uyarı metinleri pazaryerine ve zamana göre değişir;
yanlış kuralı "gerçek" diye sunmak kullanıcıyı yanıltır.

---

## Varsayımlar (soru sorulmadan alınan kararlar)

1. Arayüz ve rapor metinleri **Türkçe**; kod, teknik tanımlayıcılar ve README İngilizce bölümüyle
   birlikte iki dilli.
2. Yazma niteliğinde hiçbir araç yok; ileride eklenirse `dryRun` + açık onay parametresi + denetim
   kaydı zorunludur.
3. `CHANNEL_MISMATCH` kuralı, kardeş proje `marketplace-sentinel` (Python, kanal çakışması nöbetçisi)
   ile kavramsal olarak örtüşür; burada **katalog ↔ feed tutarlılığı** alt-kapsamı olarak konumlanır
   ve README'de kardeş proje olarak anılır.
4. LLM öneri katmanı, API anahtarı olmadan da uçtan uca test edilebilir olmalıdır (mock sağlayıcı);
   gerçek API ölçümü bu ortamda yapılmaz (kullanıcı kararı).
5. Demo katalogları depoda statik ve sentetiktir; canlı demo da bunları sunar.
6. Paket adı kapsamı `@pazaryeri-denetci/*`.

## Sapmalar / ertelenenler (kayıt altında)

1. **`apps/web` Faz 4'te workspace'e girer.** Faz 0–3'te Next.js bağımlılıkları kurulmaz (indirme
   boyutu ve disk); klasör yer tutucu README ile durur. Disk durumu: C: sürücüsünde ~54 GB boş.
2. **CI'nin yeşil koşusu ilk push'ta doğrulanır.** Yerel kapılar (`pnpm gates`) tam çalışır; ancak
   yerel `gh` token'ının kapsamları `gist, read:org, repo` — **`workflow` kapsamı yok**, yani
   `.github/workflows/` içeren bir push GitHub tarafından reddedilir. İlk yayın öncesi
   `gh auth refresh -s workflow` gerekiyor.
3. **corepack bu ortamda kırık** (Node kurulum yolu MSYS ile bozuluyor: `C:\c\Program Files\...`);
   pnpm global kuruldu (`npm i -g pnpm` → 12.11.2) ve `packageManager` alanı sürümü sabitliyor.
4. **Kapsam eşiği henüz yok.** Yüzde eşiği, gerçek ölçüm alındıktan sonra (Faz 2/6) konur; uydurma
   eşik konmaz.

## Neler denenip bırakıldı

| Denenen                                                    | Sonuç / neden bırakıldı                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `corepack` ile pnpm sürüm yönetimi                         | Kırık (yol çözümlemesi) → global pnpm kurulumu                                                               |
| TypeScript 7.0.2 (`latest`)                                | `typescript-eslint` peer aralığı dışı (ölçüldü) → 5.9.3                                                      |
| Paketleri `tsc -b` proje referanslarıyla derleyip tüketmek | Faz 0–2'de build artefaktı ve tüketim karmaşası getirir; kaynak TS + vitest alias daha az kırılgan (ADR-006) |

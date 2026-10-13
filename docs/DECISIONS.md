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

## ADR-009 — Eval eşleşme anahtarı ve eşik politikası

**Karar:** Etiket ↔ bulgu eşleşmesi `(kural, ürün, varyant SKU)` üçlüsü üzerinden yapılır; alan
(`field`) anahtara **dâhil edilmez**. Eşikler başlangıçta precision ve recall için %100'dür ve CI'da
kapıdır (`pnpm run eval:check`).

**Alan neden anahtarda değil:** Aynı kural aynı varyantta birden çok alanı işaret edebilir (ör. bir
üründe iki görselin alt metni eksik). Bu, kuralın hatayı bulup bulmadığını değiştirmez; alan bilgisi
raporun "nerede" sütununda yaşar ve precision'ı yapay olarak düşürmez.

**Neden %100 eşik:** Sentetik üretici her ürüne en fazla **bir** hata enjekte eder ve etiketler ile
kurallar aynı sözleşmeyi paylaşır; dolayısıyla %100 ulaşılabilir bir hedeftir ve her sapma gerçek bir
regresyondur. Eşik düşürülecekse gerekçesi buraya yazılır — sessizce gevşetilmez.

**Rapor = üretici çıktısı:** `docs/EVAL.md` elle düzenlenmez; `pnpm run eval` yazar. Bu yüzden
prettier onu biçimlendirmez (`.prettierignore`) ve CI üretilen içerikle birebir karşılaştırır.

## ADR-010 — Her sorunun **tek sahibi** kural vardır (çift raporlama yasağı)

**Karar:** Aynı veri sorunu iki kural tarafından raporlanmaz; kapsam sınırları kodda ve yorumlarda
yazılıdır. Örnekler:

- `VARIANT_MISSING_PRICE_OR_STOCK` fiyatı/stoku eksik varyantın sahibidir → `CHANNEL_MISMATCH` ve
  `PRICE_COMPARE_AT_INVALID` o varyant için susar.
- SKU'su tekrar eden varyantın sahibi `SKU_DUPLICATE`'tir → `CHANNEL_MISMATCH` o SKU'yu atlar
  (SKU tek bir varyantı işaret etmiyorsa "kanal verisi uyuşmuyor" demek anlamsızdır).
- Boş açıklamanın sahibi `DESC_MISSING`'dir → `DESC_TOO_SHORT` yalnızca **dolu ama kısa** metinde
  bağırır.
- `DESC_UNSAFE_HTML` bir ürün için tek bulgu üretir (ilk bozuk alan), `SEO_META_MISSING` eksik
  alanların hepsini tek bulguda sayar.

**Neden:** Çift raporlama (a) kullanıcıya aynı hatayı iki kez gösterir, (b) eval'de yapay yanlış
pozitif üretir ve precision'ı düşürür, (c) "kaç sorun var" sorusunu cevaplanamaz hâle getirir.
Bu ilke ihlal edilirse `pnpm run eval:check` kırılır.

## ADR-011 — `catalog-io` paketi ve kodlama kararı

**Karar:** CSV/JSON içe-dışa aktarma `core`'dan ayrı bir pakete (`packages/catalog-io`) konuldu;
`core` saf fonksiyon kalır (dosya sistemi yok).

**Kodlama:** `TextDecoder('windows-1254')` kullanıldı; `iconv-lite` bağımlılığı **kaldırıldı**
(0.7.x CJS `export =` biçiminde ve `verbatimModuleSyntax` + `nodenext` altında gereksiz sürtünme
yaratıyor; Node'un ICU destekli `TextDecoder` aynı çözümü veriyor — testler `0xFD→ı`, `0xFE→ş`,
`0xE7→ç` eşlemelerini doğruluyor).

**CSV şeması:** satır = varyant; aynı `handle` tekrar eden satırlar tek ürünün varyantları olur
(gerçek dışa aktarmalarda en sık görülen biçim). Zorunlu kolonlar `MINIMAL_CSV_COLUMNS` içinde.

**`Product.id = handle`:** CSV şemasında ayrı bir kimlik kolonu yok; `handle` gruplamadan sonra
benzersiz olduğu için kimlik olarak kullanılır.

## ADR-012 — Performans bütçesi ve sayfalama

**Karar:** `paginate`/`pageFindings` sayfa üst sınırı 500; MCP araçları liste dönerken sayfalama
kullanır. Ölçüm `pnpm run eval:bench` ile alınır ve `docs/PERFORMANS.md`'ye yazılır.

**Ölçüm (10.000 ürün, 17 kural):** denetim 1358,7 ms (7360 ürün/sn), üretim 365,4 ms, sayfalama
0,1 ms, RSS 223,1 MB. Akış tabanlı (streaming) içe aktarma kapsam dışı; `maxRows` ile üst sınır var.

## ADR-013 — MCP yüzeyi: salt-okunur araçlar ve yapılandırılmış hata sözleşmesi

**Karar:** Araçlar (`list_products`, `get_product`, `audit_product`, `audit_catalog`,
`compare_channels`, `export_report`) yalnızca okur; hiçbiri yazmaz. Sonuçlar tek bir JSON
nesnesinin **metin bloğu** olarak döndürülür (ajan tarafından okunabilir, insan tarafından
görülebilir). Beklenen hatalar (`Ürün bulunamadı`, `Bilinmeyen kural kimliği`) `isError: true` ile
döner; beklenmeyen hatalar `guarded()` sarmalayıcısında yakalanır.

**Neden:** MCP istemcileri araç hatasını protokol hatası olarak görürse oturum düşebilir. Hata
mesajını **veri** olarak döndürmek, ajanın kullanıcıya düzgün açıklama yapmasını sağlar ve sunucu
sürecini ayakta tutar. Bu davranış testlidir: hatalı çağrıdan sonraki çağrı yine yanıt verir
(`stdio-integration.test.ts`).

**Sayfalama:** `list_products` en fazla 200, `audit_catalog` en fazla 100 satır döner; `hasMore`
alanı istemciye devam edip etmeyeceğini söyler (bağlam penceresini tek araç çağrısıyla doldurmamak
için).

**Çıktı tipi:** SDK'nın kendi `CallToolResult` tipi kullanılır (elle yazılmış bir arayüz değil);
böylece SDK sürüm yükseltmelerinde sözleşme kayması derleme zamanında yakalanır.

## ADR-014 — Sunucu **derlenmiş** tek dosyadan çalışır

**Karar:** `packages/mcp-server` esbuild ile paketlenir: `dist/bin.js` (bağımlılıklar
`--packages=external` ile dışarıda). Kullanıcı istemci yapılandırmasında bu dosyayı gösterir;
CI derlemeyi testlerden **önce** çalıştırır ve derlenmiş girişe karşı ayrı bir entegrasyon testi
koşar.

**Neden:** stdio istemcileri sunucuyu kendileri başlatır; `tsx` gibi bir çalıştırıcıya bağımlı olmak
kurulumu kırılgan yapar. Ayrıca MCP Inspector'ı `node --import tsx ...` biçiminde çağırmak
**çalışmıyor** — Inspector, Node'a geçirilen bayrakları ayrıştırırken standart girdiyi script sanıp
şu hatayı veriyor: `SyntaxError: Unexpected token ':'` (JSON-RPC mesajı Node'a script olarak
veriliyordu). Düz `node dist/bin.js` ile Inspector sorunsuz bağlanıyor (doğrulandı).

**Ölçüldü:** `--bundle` bayrağı olmadan esbuild yalnızca dönüştürme yapar ve göreli içe aktarmalar
(`./config.ts`) çalışma zamanında `ERR_MODULE_NOT_FOUND` verir; paketleme şarttır.

## ADR-015 — HTTP taşımasında güvenlik: token zorunlu, savunma katmanlı

**Karar:** Streamable HTTP uç noktası (`/mcp`) yalnızca `MCP_HTTP_TOKEN` tanımlıysa başlar; token
yoksa süreç **başlatılmaz**. Üstüne sırayla: zamanlama güvenli token karşılaştırması, Host izin
listesi (DNS rebinding), Origin izin listesi + sınırlı CORS, gövde boyutu sınırı (256 KB; hem
`Content-Length` hem akan sayaç) ve istemci başına hız sınırı (120 istek/dk). Kimlik doğrulaması
istemeyen tek uç `/healthz`'dir ve hiçbir hassas veri döndürmez.

**Neden "varsayılan kapalı" değil "token yoksa başlamaz":** Varsayılan olarak dinleyen ama kimlik
doğrulaması yapmayan bir uç nokta, fark edilmeden açık kalır. Yapılandırma hatasını **başlangıçta ve
gürültülü** biçimde durdurmak, çalışma zamanında sessiz bir güvenlik açığından iyidir.

**Neden hız sınırı ve gövde sınırı:** stdio taşımasında istemci tek süreçtir; HTTP'de değildir. Tek
bir istemci sunucuyu doldurabilir (bellek/CPU). Sınırlar sabit ve belgelenmiştir; üretimde ters
proxy arkasında da uygulanmalıdır (ör. nginx `client_max_body_size`).

**Sunucusuz ortam:** Bu sunucu kalıcı süreç varsayar. Vercel gibi ortamlarda araçlar
`createMcpHandler` + web-standard `Request`/`Response` ile bir Next.js route'unda açılmalıdır —
bilinçli olarak ertelendi (bkz. "Sapmalar").

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

1. **`apps/web` Faz 4'te workspace'e alındı** (`pnpm-workspace.yaml → apps/*`). Faz 0–3'te Next.js
   bağımlılıkları kurulmadı (indirme boyutu/disk); kurulum artık yapıldı.
2. **MCP'nin sunucusuz (serverless) HTTP karşılığı ertelendi.** Kalıcı süreç HTTP sunucusu vardır ve
   testlidir; Vercel gibi ortamlar için `createMcpHandler` + web-standard `Request`/`Response` tabanlı
   bir Next.js route'u gerekiyor. Bu, portföyde "bilinçli kapsam sınırı" olarak belgelenmiştir.
3. **CI'nin yeşil koşusu ilk push'ta doğrulanır.** Yerel kapılar (`pnpm gates`) tam çalışır; ancak
   yerel `gh` token'ının kapsamları `gist, read:org, repo` — **`workflow` kapsamı yok**, yani
   `.github/workflows/` içeren bir push GitHub tarafından reddedilir. İlk yayın öncesi
   `gh auth refresh -s workflow` gerekiyor.
4. **corepack bu ortamda kırık** (Node kurulum yolu MSYS ile bozuluyor: `C:\c\Program Files\...`);
   pnpm global kuruldu (`npm i -g pnpm` → 12.11.2) ve `packageManager` alanı sürümü sabitliyor.
5. **Kapsam eşiği henüz yok.** Yüzde eşiği, gerçek ölçüm alındıktan sonra (Faz 2/6) konur; uydurma
   eşik konmaz.

## Neler denenip bırakıldı

| Denenen                                                    | Sonuç / neden bırakıldı                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `corepack` ile pnpm sürüm yönetimi                         | Kırık (yol çözümlemesi) → global pnpm kurulumu                                                               |
| TypeScript 7.0.2 (`latest`)                                | `typescript-eslint` peer aralığı dışı (ölçüldü) → 5.9.3                                                      |
| Paketleri `tsc -b` proje referanslarıyla derleyip tüketmek | Faz 0–2'de build artefaktı ve tüketim karmaşası getirir; kaynak TS + vitest alias daha az kırılgan (ADR-006) |

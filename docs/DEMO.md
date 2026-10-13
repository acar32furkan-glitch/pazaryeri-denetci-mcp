# 60–90 saniyelik demo senaryosu (ekran kaydı)

Bu belge, `pazaryeri-denetci-mcp` için **60–90 saniyelik** bir ekran kaydının sahne sahne
senaryosudur: her sahnede zaman aralığı, ekranda ne görüneceği, yazılacak/tıklanacak komut ve
okunacak anlatım metni vardır.

Buradaki bütün komutlar ve çıktılar bu depoda **gerçekten çalıştırıldı**; belgede geçen sayılar o
koşulardan alınmıştır (kaynak: `docs/EVAL.md`, `docs/PERFORMANS.md` ve bu belgedeki doğrulama
notları). Demo **sentetik veriyle** ve öneri tarafında **sahte (mock) istemciyle** koşar — canlı
model çağrılmaz (aşağıdaki "Bu demoda ne YOK" bölümü).

## Kayıttan önce (hazırlık)

```bash
pnpm install                                   # bağımlılıklar
pnpm run build                                 # MCP sunucusunun derlenmiş girdisi (dist/bin.js)
pnpm --filter @pazaryeri-denetci/web build      # Next.js üretim derlemesi (önceden ısıtılmış olsun)
```

> **Port uyarısı:** Windows'ta `3111` rezerve aralıkta (`3041–3140`) olduğu için `next start -p 3111`
> `EACCES` verir. Demo **`-p 3220`** ile koşar. Ayrıca `pnpm … run start -- -p N` biçimi çalışmaz
> (argüman Next'e bozuk geçer); doğru biçim aşağıdaki `exec` çağrısıdır
> (bkz. `docs/DECISIONS.md` → Sapmalar/6).

Hazırlık olarak kayıttan hemen önce şu iki komutu bir kez koşturup önbelleği ısıtın (kayıt sırasında
soğuk derleme/ilk istek gecikmesi görünmesin):

```bash
pnpm run audit:csv -- examples/ornek-katalog.csv
pnpm --filter @pazaryeri-denetci/web exec next start -p 3220   # sonra Ctrl+C ile kapatın
```

## Zaman bütçesi

| #   | Aralık    | Sahne                                  | Süre  |
| --- | --------- | -------------------------------------- | ----- |
| 1   | 0:00–0:08 | Problem cümlesi                        | 8 sn  |
| 2   | 0:08–0:24 | CSV'den denetim                        | 16 sn |
| 3   | 0:24–0:46 | Web demosu (profil + özet + bulgular)  | 22 sn |
| 4   | 0:46–1:04 | MCP'ye bağlanma + `audit_catalog`      | 18 sn |
| 5   | 1:04–1:20 | `suggest_fix` (mock öneri)             | 16 sn |
| 6   | 1:20–1:30 | Eval tablosu + 10.000 ürün benchmark'ı | 10 sn |

Toplam **90 sn**. Daha kısa bir kesim (≈60 sn) için sahne 2 ile sahne 5 atlanabilir; sahne 1, 3, 4
ve 6 çekirdek akışı taşır.

---

## Sahne 1 — Problem cümlesi (0:00–0:08)

**Ekranda:** Terminal, boş istem. Mümkünse `README.md`'nin ilk paragrafı görünür olsun.

**Komut:** yok (yalnızca anlatım).

**Anlatım:**

> "Pazaryeri ürün katalogları sessizce satış kaybediyor: eksik barkod, boş açıklama, tutarsız varyant,
> bozuk Türkçe karakter. Bu araç kataloğu **deterministik kurallarla** denetler, bulguları önem
> sırasına dizer ve hepsini bir **MCP sunucusu** üzerinden AI ajanlarına açar."

---

## Sahne 2 — CSV'den denetim (0:08–0:24)

**Ekranda:** Terminal. Markdown raporu akarken özet tablosu ve ilk kritik bulgular görünür.

**Komut:**

```bash
pnpm run audit:csv -- examples/ornek-katalog.csv
```

**Gerçek çıktı (bu depoda koşuldu, kısaltıldı):**

```text
# Katalog Denetim Raporu — examples/ornek-katalog.csv
Bu raporda **3** ürün denetlendi ve toplam **10** bulgu bulundu.

| Şiddet | Bulgu |
| kritik | 3 |
| orta   | 6 |
| düşük  | 1 |
| Toplam | 10 |

| Kural | Bulgu |
| BARCODE_INVALID | 2 |  DESC_MISSING | 1 |  DESC_TOO_SHORT | 1 |
| IMAGE_ALT_MISSING | 1 |  IMAGE_COUNT_LOW | 1 |  METAFIELD_MISSING | 1 |
| PRICE_COMPARE_AT_INVALID | 1 |  SEO_META_MISSING | 1 |  VARIANT_OPTION_INCONSISTENT | 1 |
```

**Anlatım:**

> "Dosya CSV; Excel'in Türkçe kodlaması **Windows-1254** ve `1.299,90` gibi **Türkçe sayı biçimi**
> otomatik çözülür. 3 üründe 10 bulgu: 3 kritik, 6 orta, 1 düşük. Her bulgu kural, alan, kanıt ve
> tek satırlık düzeltme önerisiyle gelir — deterministik, yani aynı girdi her koşuda aynı çıktı."

---

## Sahne 3 — Web demosu (0:24–0:46)

**Ekranda:** Tarayıcı. Ana sayfada profil seçici (Küçük / Orta / Büyük), özet kartları, "En sık
görülen 5 kural" tablosu, "En kritik 20 bulgu" listesi ve iki indirme bağlantısı.

**Komut (ayrı bir terminal):**

```bash
pnpm --filter @pazaryeri-denetci/web exec next start -p 3220
# tarayıcı: http://localhost:3220/?profil=orta
```

**Tıklama akışı:** `Orta` profil → özet kartları → "En sık 5 kural" tablosu → aşağı kaydırıp
"En kritik 20 bulgu" → `Markdown raporunu indir` bağlantısına hover.

**Doğrulanmış sayılar:**

| Profil  | Ürün | Etiketli hata | Bulgu | kritik / orta / düşük |
| ------- | ---- | ------------- | ----- | --------------------- |
| `kucuk` | 40   | 40            | 40    | 12 / 26 / 2           |
| `orta`  | 200  | 105           | 105   | 30 / 70 / 5           |

(Hepsi sabit seed `20261013`; `orta` profili için değerler `/api/denetim?profil=orta` uç noktasından
alınmıştır. Üretim derlemesi `next build` **4 rota** üretir: `/`, `/_not-found`, `/api/denetim`,
`/api/rapor`.)

**Anlatım:**

> "Aynı motor bir Next.js demosunda. Profil seçildiğinde sentetik katalog sunucuda üretilir, 17 kural
> tek geçişte koşar ve sonuç sunucu bileşenlerinde işlenir — istemci tarafında hesap yok. Özet kartları
> 30 kritik / 70 orta / 5 düşük diyor; altında en sık kural ve en kritik bulgular var. Rapor Markdown
> olarak da indirilebiliyor."

---

## Sahne 4 — MCP'ye bağlanma ve `audit_catalog` (0:46–1:04)

**Ekranda:** MCP Inspector (veya Claude Desktop) çıktısı. Önce araç listesi, sonra bir `audit_catalog`
yanıtı.

**Komut:**

```bash
# 1) Araçları, kaynakları ve prompt'ları listele
npx -y @modelcontextprotocol/inspector --cli node packages/mcp-server/dist/bin.js --method tools/list
npx -y @modelcontextprotocol/inspector --cli node packages/mcp-server/dist/bin.js --method resources/list
npx -y @modelcontextprotocol/inspector --cli node packages/mcp-server/dist/bin.js --method prompts/list

# 2) Kataloğu denetle, en kritik bulguyu getir
npx -y @modelcontextprotocol/inspector --cli node packages/mcp-server/dist/bin.js \
  --method tools/call --tool-name audit_catalog --tool-arg topN=1
```

**Gerçek çıktı (özet):** `tools/list` **7 araç** döndürür — `list_products`, `get_product`,
`audit_product`, `audit_catalog`, `compare_channels`, `export_report`, `suggest_fix`.
`resources/list` **2 kaynak** (`catalog://rules`, `catalog://summary`), `prompts/list` **2 prompt**
(`katalog-saglik-denetimi`, `tek-urun-iyilestirme`). `audit_catalog topN=1` çağrısı varsayılan
200 ürünlük sentetik katalogda:

```json
{
  "summary": {
    "productCount": 200,
    "findingCount": 105,
    "bySeverity": { "critical": 30, "major": 70, "minor": 5 }
  },
  "page": { "offset": 0, "limit": 1, "total": 105, "hasMore": true },
  "findings": [
    {
      "ruleId": "BARCODE_INVALID",
      "severity": "critical",
      "productId": "snt-prd-0012",
      "variantSku": "SNT-0012-02",
      "field": "variants[1].barcode",
      "message": "Barkod geçersiz: sağlama basamağı hatalı (beklenen 1).",
      "evidence": "8699524155322"
    }
  ]
}
```

**Anlatım:**

> "Aynı çekirdek şimdi bir MCP sunucusu: 7 salt-okunur araç, 2 kaynak ve 2 prompt şablonu, stdio ve
> Streamable HTTP taşımaları. Bir ajan `audit_catalog` çağırdığında özet ve sayfalanmış bulgular
> makine tarafından okunabilir JSON olarak döner. Hiçbir araç yazmaz; hepsi salt-okunur."

> **Claude Desktop alternatifi:** `docs/MCP.md` içindeki `claude_desktop_config.json` bloğunu
> kullanın (derlenmiş giriş: `packages/mcp-server/dist/bin.js`).

---

## Sahne 5 — `suggest_fix` (mock öneri) (1:04–1:20)

**Ekranda:** `suggest_fix` çağrısının JSON yanıtı: `mode: "mock"`, `model: "mock-demo"`, önerilen
açıklama ve uyarı mesajı.

**Komut (mock modda — ağa çıkılmaz, maliyet yoktur):**

```bash
npx -y @modelcontextprotocol/inspector --cli node packages/mcp-server/dist/bin.js \
  -e MCP_LLM_MODE=mock \
  --method tools/call --tool-name suggest_fix --tool-arg id=snt-prd-0010 --tool-arg topFindings=3
```

> `-e KEY=VALUE` bayrağı **hedef komuttan sonra** yazılmalıdır; başta verilirse Inspector hedefi
> bulamaz. Ortam değişkenini `export` etmek yetmez — Inspector sunucuyu süzülmüş bir ortamla başlatır.

**Gerçek çıktı (bu depoda koşuldu, kısaltıldı):**

```json
{
  "productId": "snt-prd-0010",
  "mode": "mock",
  "model": "mock-demo",
  "status": "ok",
  "source": "llm",
  "findingsConsidered": 1,
  "fields": {
    "descriptionHtml": "<p><strong>Lacivert Seramik Etek Erkek</strong> — … </p><ul>…</ul>"
  },
  "rationale": "Mock istemci: bulgularda geçen alanlar Türkçe metin kurallarına göre yeniden yazıldı.",
  "confidence": "medium",
  "addressedRuleIds": ["DESC_MISSING"],
  "message": "Uyarı: sahte/demo istemci kullanıldı, gerçek model çağrılmadı. Çıktı yalnızca öneridir."
}
```

**Anlatım:**

> "Öneri katmanı üç modda çalışır: `auto`, `mock`, `off`. Anahtar yoksa araç gerekçeli bir
> 'devre dışı' yanıtı verir ve sunucu çalışmaya devam eder; burada `mock` anahtarsız demoda çalışan
> **sahte** istemcidir ve çıktı bunu açıkça söyler. Öneri hiçbir alanı **yazmaz** — yalnızca metin
> döner ve uygulanmadan önce insan onayı bekler."

> **İsteğe bağlı karşı örnek (anahtarsız auto mod):** `-e MCP_LLM_MODE=off` ile aynı çağrı
> `"mode": "devre-disi"`, `"status": "unavailable"` ve
> `"Öneri özelliği devre dışı: ANTHROPIC_API_KEY tanımlı değil. Denetim sonuçları bundan etkilenmez."`
> döner — denetimin LLM'e bağımlı olmadığının kanıtı.

---

## Sahne 6 — Eval tablosu + 10.000 ürün benchmark'ı (1:20–1:30)

**Ekranda:** Önce `pnpm run eval` çıktısı, sonra `pnpm run eval:bench` tablosu. `docs/EVAL.md` ve
`docs/PERFORMANS.md` ikinci sekmede açık dursun.

**Komut:**

```bash
pnpm run eval

pnpm run eval:bench
```

**Gerçek çıktı (eval):**

```text
Ürün: 1000 · etiketli hata: 420 · bulgu: 420
Genel precision 100.0% · recall 100.0% · F1 100.0%
Öneri kalite (mock): 140/140 öneri · genel geçme 100.0% (160/160)
Rapor yazıldı: docs/EVAL.md
```

**Gerçek çıktı (bench — bu makinede tek koşu):** 10.000 ürün · 17 kural · üretim 318 ms · denetim
1175,3 ms (8508 ürün/sn) · sayfalama 0,1 ms · heap/RSS 82,8 MB / 222,5 MB.

> `docs/PERFORMANS.md`'de kayıtlı önceki koşu aynı komutla **1358,7 ms (7360 ürün/sn)**, üretim
> 365,4 ms, RSS 223,1 MB verdi. İkisi de tek koşu / tek makine ölçümüdür, ortalama değildir; koşular
> arasındaki fark normaldir. Kayıtta hangisi ekrana gelirse **onu** okuyun.

**Anlatım:**

> "Kalite ölçülüyor: üretici hata enjekte ederken her hatayı etiketler, harness etiketleri bulgularla
> eşleştirir — 1000 üründe 420 etiketli hata, precision ve recall yüzde 100. Öneri hattı da uçtan uca
> doğrulanıyor, ama **mock istemciyle**: 160/160. 10.000 ürünlük katalog ise tek geçişte yaklaşık
> 1,2 saniyede denetleniyor; ürün sayısıyla doğrusal büyüyor."

> **Dürüstlük notu (sözlü olarak belirtin):** "%100 sentetik veri üzerinde ölçüldü; etiketlerle kurallar
> aynı sözleşmeyi paylaştığı için beklenen sonuçtur, gerçek dünya doğruluk iddiası **değildir**.
> Öneri tarafındaki 160/160 de **model kalitesini ölçmez** — sahte istemciyle hattın doğru
> kurulduğunu doğrular."

---

## Kayıt ipuçları

- **Çözünürlük:** 1920×1080 kayıt; gerekiyorsa 1440p render edip ölçekleyin. Tarayıcı zoom'u
  %110–125 (kart ve tablo yazıları okunsun).
- **Yazı tipi:** terminal yazı tipi **≥16–18 pt**, satır aralığı rahat; tema açık/koyu tutarlı olsun
  (koyu tema, kod bloklarıyla uyumlu).
- **Önceden ısıtılmış derleme:** `next build` ve `pnpm run build` kayıttan **önce** çalışsın; kayıt
  sırasında `dev`/ilk istek gecikmesi görünmesin. Web sunucusunu kayıttan önce bir kez başlatıp
  sayfayı `?profil=orta` ile açın (soğuk derleme atlanır).
- **Komutları önceden prova edin:** `pnpm run audit:csv -- examples/ornek-katalog.csv`,
  `pnpm run eval`, Inspector çağrıları. Yazım hatası olan komut kareyi bozar.
- **Ortamı sabitleyin:** `MOCK_CATALOG_SEED=20261013` ve `MOCK_CATALOG_PRODUCTS=200` (varsayılan) ile
  aynı sayılar her koşuda birebir tekrarlanır — kayıt boyunca rakamlar tutarlı görünür.
- **Port:** `3220` kullanın (`3111` bu makinede rezerve aralıkta). Gerekirse
  `netstat -ano | findstr 3220` ile boş olduğunu doğrulayın.
- **Temizlik:** gereksiz sekme/bildirim kapalı; terminal `clear` ile temiz başlasın; imleç yanıp
  sönmesi sorun değil.
- **Hız:** uzun çıktıları (Inspector'ın tam JSON'u) 1–1,5× hızda oynatıp kısaltın; kritik satırları
  (`mode`, `findingCount`, `7350` benzeri metrikleri) durdurup gösterin.

## Bu demoda ne YOK

- **Canlı model ölçümü yok.** `suggest_fix` gösterimi **mock (sahte) istemci** ile koşar; çıktıda model
  adı `mock-demo` görünür ve yanıtın `message` alanı bunun sahte olduğunu söyler. Gerçek model
  (`anthropic`) koşusu bu ortamda **yapılmadı** (API anahtarı yok) — bkz. `docs/LLM.md` ve
  `docs/EVAL.md`.
- **Gerçek marka/mağaza verisi yok.** Bütün katalog **sentetiktir** (seed'li üretici); gerçek bir
  markanın ürün, fiyat veya stok verisi kullanılmaz (ADR-003).
- **Gerçek pazaryeri entegrasyonu yok.** Veri yükleme CSV/JSON veya sentetik üretici iledir; canlı
  pazaryeri API'sine bağlanılmaz, kimlik doğrulaması yapılmaz.
- **Yazma işlemi yok.** `suggest_fix` dahil hiçbir araç ürünü, dosyayı ya da dış sistemi değiştirmez;
  yalnızca öneri döner.
- **Sunucusuz (serverless) MCP yok.** HTTP taşıması kalıcı bir Node süreci olarak çalışır; Vercel
  benzeri ortamlar için `createMcpHandler` + web-standard `Request`/`Response` tabanlı route
  **ertelendi** (bkz. `docs/DECISIONS.md` → Sapmalar/2).
- **Kural kümesi kesin değil.** 17 kural **örnek ve yapılandırılabilir** bir kümedir; resmî pazaryeri
  zorunlu alanları/kuralları değişir ve kullanmadan önce resmî dokümandan doğrulanmalıdır.

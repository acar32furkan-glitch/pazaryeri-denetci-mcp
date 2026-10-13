# pazaryeri-denetci-mcp

**Pazaryeri ürün kataloğunu deterministik kurallarla denetleyen, bulguları önem sırasına göre
raporlayan ve bunu bir MCP sunucusu üzerinden AI ajanlarına açan açık kaynak araç.**

![durum](https://img.shields.io/badge/durum-geli%C5%9Ftirme%20s%C3%BCr%C3%BCyor-orange)
![lisans](https://img.shields.io/badge/lisans-MIT-blue)
![node](https://img.shields.io/badge/node-%3E%3D20-informational)

> 🚧 **Durum: Faz 2 tamamlandı** — 17 denetim kuralı, CSV içe aktarma, Türkçe/JSON rapor üreticileri
> ve eval harness'ı çalışıyor (ölçülmüş sonuçlar aşağıda). Bu README Faz 6'da tamamlanır: canlı demo
> linki, 60–90
> saniyelik ekran kaydı, mimari diyagramı ve **ölçülmüş** eval tablosu o bölümde yer alacak.

Bu depodaki tüm katalog verisi **sentetiktir**; gerçek bir markanın ürün, fiyat veya stok verisi
içermez (bkz. `docs/DECISIONS.md`, ADR-003).

## Ne yapar

Bir AI ajanı (ör. Claude) MCP üzerinden şunları sorabilir:

- "Kataloğu denetle, en kritik 10 sorunu getir."
- "Şu ürünün başlığını düzelt." (yalnızca **öneri** döner; hiçbir araç dış sisteme yazmaz)

Denetim kuralları deterministiktir (test ve eval güvenilir olsun diye); LLM yalnızca düzeltme önerisi
üretir ve anahtar yoksa uygulama önerisiz de çalışır.

## Yol haritası

| Faz | İçerik                                         | Durum       |
| --- | ---------------------------------------------- | ----------- |
| 0   | Monorepo iskeleti, kapılar, CI, DECISIONS.md   | ✅ tamam    |
| 1   | Sentetik katalog üretici + çekirdek + 6 kural  | ✅ tamam    |
| 2   | Kalan kurallar, rapor, CSV, uç durumlar        | ✅ tamam    |
| 3   | MCP sunucusu (stdio) + entegrasyon testleri    | ⬜ bekliyor |
| 4   | Web demo + Streamable HTTP + güvenlik + deploy | ⬜ bekliyor |
| 5   | LLM öneri katmanı (mock ile doğrulanır)        | ⬜ bekliyor |
| 6   | Eval harness, doküman, yayın                   | ⬜ bekliyor |

## Ölçülmüş sonuçlar (Faz 1)

Sentetik üretici hata enjekte ederken her hatayı etiketler; eval harness'ı etiketleri bulgularla
`(kural, ürün, varyant SKU)` anahtarı üzerinden eşleştirip kural bazlı precision/recall üretir.
**Aşağıdaki rakamlar gerçek bir koşudan gelir**; tam tablo `docs/EVAL.md` içindedir ve
`pnpm run eval` ile yeniden üretilir (CI bunu `pnpm run eval:check` ile kapı yapar).

| Koşu          | Kural | Ürün | Etiketli hata | Bulgu | Precision | Recall |
| ------------- | ----- | ---- | ------------- | ----- | --------- | ------ |
| seed 20261013 | 17    | 1000 | 420           | 420   | %100,0    | %100,0 |

Bu %100 **sentetik veri üzerinde** ölçülmüştür: etiketler ile kurallar aynı sözleşmeyi paylaşır, bu
yüzden beklenen sonuçtur — gerçek dünya kataloglarındaki doğruluk oranı iddiası **değildir**
(bkz. Sınırlılıklar).

### Büyük katalog (10.000 ürün)

`pnpm run eval:bench` ile ölçüldü: denetim **1358,7 ms** (7360 ürün/sn), üretim 365,4 ms,
200'lük dilimlerle tam sayfalama 0,1 ms, RSS 223,1 MB. Ayrıntı: `docs/PERFORMANS.md`.

### CSV'den denetim

```bash
pnpm run audit:csv -- examples/ornek-katalog.csv          # Türkçe Markdown raporu
pnpm run audit:csv -- examples/ornek-katalog.csv --json   # özet + satır bazlı içe aktarma uyarıları
```

## Geliştirme

```bash
pnpm install
pnpm gates       # lint + format:check + typecheck + test
pnpm run eval    # docs/EVAL.md dosyasını gerçek koşuyla yeniden üretir
```

## Sınırlılıklar (dürüstçe)

- Denetim kuralları **örnek ve yapılandırılabilir** bir kümedir; pazaryerlerinin resmî zorunlu alan
  listeleri ve uyarı metinleri değişir. Üretimde kullanmadan önce resmî dokümandan doğrulanmalıdır.
- Gerçek pazaryeri/Shopify entegrasyonu (kimlik doğrulama, API çağrıları) bu projenin kapsamı
  **dışındadır**; veri yükleme CSV veya sentetik üretici iledir.
- Yazma niteliğinde hiçbir araç yoktur; tüm araçlar salt-okunur ya da `dryRun`'dır.

---

## English

**An open-source toolkit that audits marketplace product catalogs with deterministic rules, ranks the
findings by severity, and exposes all of it to AI agents through an MCP server.**

🚧 Status: phase 0 (skeleton) done — the full README (live demo link, screen recording, architecture
diagram and a _measured_ eval table) ships in phase 6. All catalog data is **synthetic**; no real
merchant data is included. Audit rules are a **configurable sample set** and must be verified against
official marketplace docs before production use. Real marketplace/Shopify integration is explicitly
out of scope.

MIT licensed.

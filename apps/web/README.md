# apps/web — Next.js demosu

Pazaryeri katalog denetçisinin **çalışan demosu**: üç sentetik katalog profilinden birini seçer,
17 deterministik kuralı katalog genelinde koşturur ve sonucu özet + önem sıralı bulgu listesi +
indirilebilir rapor olarak gösterir. Tüm kullanıcıya görünen metin Türkçedir.

- Next.js 16 (App Router, sunucu bileşenleri) + React 19 + Tailwind CSS v4 (`@tailwindcss/postcss`).
- **CDN yok**: dış font, ikon veya script çağrısı yoktur; CSS derlenmiş dosyadan gelir.
- Denetim çekirdeği `@pazaryeri-denetci/core`, sentetik katalog `@pazaryeri-denetci/mock-data`
  (workspace paketleri TS kaynağından tüketilir → `next.config.ts` → `transpilePackages`).

## Çalıştırma

```bash
pnpm --filter @pazaryeri-denetci/web dev      # geliştirme (http://localhost:3000)
pnpm --filter @pazaryeri-denetci/web build    # üretim derlemesi
pnpm --filter @pazaryeri-denetci/web start    # üretim sunucusu (http://localhost:3000)
pnpm --filter @pazaryeri-denetci/web typecheck
```

> `start` betiği `next start -p 3000` çalıştırır. Farklı bir port için doğrudan çağırın:
> `pnpm --filter @pazaryeri-denetci/web exec next start -p <port>`.
> (`pnpm run start -- -p 3111` **çalışmaz**: pnpm `--` sonrasını `next start -p 3000 -- -p 3111`
> olarak ekler ve Next `--`'ı proje dizini sanıp `Invalid project directory` ile durur.)

## Rotalar

| Rota                               | Ne döner                                                                                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` (`?profil=kucuk\|orta\|buyuk`) | Özet kartları, en sık 5 kural tablosu, en kritik 20 bulgu, indirme bağlantıları. Geçersiz/eksik profilde varsayılan **orta** profili gösterilir ve uyarı çıkar.                     |
| `/api/denetim?profil=…`            | JSON: `{ profil, seed, productCount, injectedDefectCount, summary, findings }`. Geçersiz/eksik profilde **400** + Türkçe hata mesajı (`{ hata, alinan, gecerliProfiller, ornek }`). |
| `/api/rapor?profil=…`              | `text/markdown; charset=utf-8` + `Content-Disposition: attachment; filename="katalog-denetim-raporu-<profil>.md"`. Geçersiz/eksik profilde **400** + Türkçe düz metin.              |

İki API rotası da `dynamic = 'force-dynamic'`; ana sayfa `searchParams` kullandığı için sunucuda
üretilir.

## Profiller (`lib/catalog-profiles.ts`)

| Profil  | Ürün | Hata türü başına enjeksiyon | Etiketli hata |
| ------- | ---- | --------------------------- | ------------- |
| `kucuk` | 40   | 2 (20 tür)                  | 40            |
| `orta`  | 200  | 5 (21 tür)                  | 105           |
| `buyuk` | 500  | 10 (21 tür)                 | 210           |

Hepsi **sabit seed** (`20261013`) kullanır: aynı profil her koşuda birebir aynı kataloğu ve aynı
bulgu listesini üretir.

Küçük profilde 21 tür × 2 = 42 hata 40 ürüne sığmadığı için (üretici, etiket–bulgu eşleşmesi
bozulmasın diye ürün başına **en fazla bir** hata yazar) son tür (`TR_LOCALE_CASING`) dışarıda
bırakılır.

## Veri ve kural uyarısı

> Katalog **tamamen sentetiktir** (seed'li üreticiden gelir; gerçek mağaza/müşteri verisi yoktur).
> Kurallar, eşikler ve zorunlu alanlar **örnek ve yapılandırılabilirdir** ve **resmî pazaryeri
> dokümantasyonundan doğrulanmalıdır**. Demo hiçbir uygunluk/uyumluluk garantisi vermez.

Aynı uyarı ana sayfada görünür; indirilen Markdown raporunun sonunda da yer alır (çekirdeğin
`renderFindingsMarkdown` çıktısı).

## Dosya düzeni

```
apps/web/
  next.config.ts           # transpilePackages (workspace paketleri TS kaynağından)
  postcss.config.mjs       # Tailwind v4
  tsconfig.json            # Next'in kendi tsconfig'i (kök tsconfig.base.json'u extend etmez)
  app/layout.tsx           # <html lang="tr">, metadata, globals.css
  app/page.tsx             # sunucu bileşeni: profil seçici + özet + tablolar + bulgular
  app/globals.css          # @import "tailwindcss";
  app/api/denetim/route.ts # JSON denetim çıktısı
  app/api/rapor/route.ts   # Markdown rapor indirme
  lib/catalog-profiles.ts  # üç profil tanımı (seed, ürün sayısı, hata türleri)
  lib/audit.ts             # runDemoAudit + ürün başlığı/kural haritaları
```

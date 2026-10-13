# LLM öneri katmanı

`packages/suggest` — başlık, açıklama ve SEO metinleri için **Türkçe düzeltme önerisi** üretir.

## Ne yapar, ne yapmaz

| Yapar                                                | Yapmaz                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| Bulgulara bakarak düzeltilmiş metin **önerir**       | Hiçbir alanı yazmaz, hiçbir değişikliği uygulamaz                |
| Model adını ortamdan okur (`LLM_MODEL`)              | Model adını koda gömmez, varsayılan model seçmez                 |
| Çıktıyı şemaya ve uzunluk sınırlarına göre doğrular  | Doğrulanmamış metni "öneri" diye döndürmez                       |
| Aynı girdi için ikinci kez model çağırmaz (önbellek) | Önbelleği diske yazmaz (süreç belleğinde kalır)                  |
| Günlük token bütçesini aşmaz                         | Bütçe dolduğunda denetimi durdurmaz (yalnızca öneri eksik kalır) |

Denetim sonuçlarının **tek kaynağı** deterministik kurallardır; bu katman bulgu üretmez ve bulguları
değiştirmez.

## Üç mod

| Mod                     | Nasıl seçilir                                           | Davranış                                                                                                    |
| ----------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Kapalı (devre dışı)** | `ANTHROPIC_API_KEY` veya `LLM_MODEL` boş                | Araç `devre-disi` döner, gerekçe mesajda görünür. Uygulama çalışmaya devam eder.                            |
| **Mock**                | `MCP_LLM_MODE=mock`                                     | **Sahte** istemci: ağa çıkmaz, maliyet yoktur, çıktıda mod `mock` olarak işaretlenir. Demo ve testler için. |
| **Gerçek**              | `ANTHROPIC_API_KEY` + `LLM_MODEL` + `MCP_LLM_MODE=auto` | Anthropic API'sine tek istek (gerekirse bir yeniden deneme).                                                |

```bash
# Anahtarsız demo (gerçek model çağrılmaz)
MCP_LLM_MODE=mock node packages/mcp-server/dist/bin.js

# Kapalı mod: araç "devre dışı" der
MCP_LLM_MODE=off node packages/mcp-server/dist/bin.js

# Gerçek mod (anahtar ve model adı ortamdan gelir)
ANTHROPIC_API_KEY=… LLM_MODEL=… MCP_LLM_MODE=auto node packages/mcp-server/dist/bin.js
```

## Ortam değişkenleri

| Değişken                     | Varsayılan | Açıklama                                      |
| ---------------------------- | ---------- | --------------------------------------------- |
| `ANTHROPIC_API_KEY`          | —          | Boşsa katman devre dışıdır                    |
| `LLM_MODEL`                  | —          | Model adı; **zorunlu** (koda gömülmez)        |
| `LLM_MAX_TOKENS_PER_REQUEST` | `1024`     | İstek başına çıktı token tavanı               |
| `LLM_DAILY_TOKEN_BUDGET`     | `200000`   | Günlük toplam token bütçesi (aşılırsa `kota`) |
| `MCP_LLM_MODE`               | `auto`     | `auto` \| `mock` \| `off`                     |

## Akış

```
ürün + bulgular
   → prompt kurulumu (envelope + etkisizleştirilmiş veri bloğu)
   → önbellek (sha256: model + alanlar + veri)  ── isabet → LLM'e gitmez
   → günlük bütçe kontrolü                      ── dolu   → 'kota'
   → istemci çağrısı (hata olursa 1 yeniden deneme)
   → Zod doğrulaması (uzunluklar, en az bir alan, güvensiz HTML yasağı)
   → Suggestion (öneri) veya gerekçeli 'unavailable'
```

## Prompt injection savunması

Ürün başlığı/açıklaması **güvenilmeyen veri** sayılır; içinde "önceki talimatları unut" gibi ifadeler
bulunabilir. Savunma katmanları ve gerekçeleri `docs/DECISIONS.md` **ADR-016**'da; özetle:

1. Görev ve kurallar yalnızca sabit system metnindedir; veri ayrı bir blokta durur.
2. Veri içindeki `<<<` / `>>>` dizileri tek karaktere indirilir, görünmez karakterler ayıklanır —
   model veri içinde sınır işareti taklit edemez.
3. Alanlar kısaltılır (1200 / bulgu metni 400 karakter).
4. Model çıktısı şemaya göre doğrulanır; güvensiz HTML reddedilir, geçersiz çıktı önbelleğe yazılmaz.
5. Yazma yetkisi olmadığı için zarar yüzeyi yoktur: en kötü durum "kullanılmayan bir öneri".

Bu davranışlar test altındadır: `packages/suggest/test/` (fence etkisizleştirme, enjeksiyon metninin
veri bloğunda kalması, geçersiz/şema dışı çıktının reddi, önbellek ve kota davranışı).

## Maliyet

- İstek başına token tavanı; `max_tokens` olarak API'ye geçilir.
- Aynı girdi (model + alanlar + veri) ikinci kez sorulduğunda **çağrı yapılmaz** (`source: 'cache'`).
- Günlük bütçe aşıldığında çağrı yapılmaz (`reason: 'kota'`).
- Loglara ürün içeriği yazılmaz; istatistikler yalnızca sayaç ve token toplamlarıdır.

## Sınırlılıklar (dürüstçe)

- Bu depoda **canlı model ölçümü yapılmadı**: ortamda API anahtarı yok. Testler ve eval bölümü sahte
  (mock) istemciyle koşar; ölçülen şey model kalitesi değil, hattın uçtan uca çalışmasıdır.
- Öneriler **insan onayı** gerektirir: kurallara uygunluk otomatik denetlenir, ticari doğruluk
  (ürünün gerçekten ne olduğu, fiyat/stok) insan tarafından kontrol edilmelidir.
- Önbellek süreç içindedir: süreç yeniden başlarsa ilk istek yine modele gider.
- Kota ve hız sınırı süreç başına sayılır; çok örnekli dağıtımda ortak bir sayaç için dış depo gerekir
  (kapsam dışı, bkz. `docs/DECISIONS.md` "Neler denenip bırakıldı").

# Değerlendirme (EVAL)

Bu dosya `pnpm run eval` komutuyla **üretilir**; tablodaki bütün sayılar gerçek bir koşudan
gelir (uydurma/elle girilmiş rakam yoktur). Kaynak: sentetik üretici hata enjekte ederken her
hatayı etiketler; harness etiketleri bulgularla `(kural, ürün, varyant SKU)` anahtarı üzerinden
eşleştirir.

## Koşu parametreleri

- Seed: `20261013`
- Ürün sayısı: **1000**
- Etiketli hata: **420** (tür başına 20)
- Kural sayısı: 17

## Etiketli hata türleri

| Tür | Açıklama | Adet |
| --- | --- | --- |
| `TITLE_TOO_SHORT` | başlık çok kısa | 20 |
| `TITLE_TOO_LONG` | başlık çok uzun | 20 |
| `DESC_EMPTY` | açıklama boş | 20 |
| `SEO_META_NULL` | SEO meta yok | 20 |
| `IMAGE_ALT_NULL` | görsel alt metni yok | 20 |
| `SKU_NULL` | SKU yok | 20 |
| `BARCODE_CHECKSUM_BROKEN` | barkod sağlama basamağı bozuk | 20 |
| `TITLE_REPEATED_WORDS` | başlıkta kelime tekrarı | 20 |
| `DESC_SHORT` | açıklama çok kısa | 20 |
| `DESC_SCRIPT` | açıklamada <script> | 20 |
| `IMAGE_COUNT_LOW` | görsel sayısı yetersiz | 20 |
| `VARIANT_OPTION_CASE_MISMATCH` | seçenek değerinde harf farkı | 20 |
| `VARIANT_PRICE_NULL` | varyantta fiyat yok | 20 |
| `SKU_DUPLICATE_IN_PRODUCT` | ürün içinde SKU tekrarı | 20 |
| `SKU_DUPLICATE_ACROSS_PRODUCTS` | ürünler arası SKU tekrarı | 20 |
| `COMPARE_AT_BELOW_PRICE` | karşılaştırma fiyatı düşük | 20 |
| `METAFIELD_REMOVED` | zorunlu alan kaldırıldı | 20 |
| `METAFIELD_INVALID_VALUE` | zorunlu alanda geçersiz değer | 20 |
| `LISTING_PRICE_MISMATCH` | kanal fiyatı uyuşmuyor | 20 |
| `TR_MOJIBAKE` | Türkçe karakter bozulması | 20 |
| `TR_LOCALE_CASING` | yanlış yerelde harf dönüşümü | 20 |

## Kural bazlı doğruluk

| Kural | Şiddet | Beklenen | Bulunan | TP | FP | FN | Precision | Recall | F1 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `BARCODE_INVALID` | critical | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `CHANNEL_MISMATCH` | critical | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `DESC_MISSING` | critical | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `DESC_TOO_SHORT` | major | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `DESC_UNSAFE_HTML` | critical | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `IMAGE_ALT_MISSING` | minor | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `IMAGE_COUNT_LOW` | major | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `METAFIELD_MISSING` | major | 40 | 40 | 40 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `PRICE_COMPARE_AT_INVALID` | major | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `SEO_META_MISSING` | major | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `SKU_DUPLICATE` | major | 40 | 40 | 40 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `SKU_MISSING` | critical | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `TITLE_KEYWORD_STUFFING` | major | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `TITLE_LENGTH` | major | 40 | 40 | 40 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `TR_TEXT_QUALITY` | major | 40 | 40 | 40 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `VARIANT_MISSING_PRICE_OR_STOCK` | critical | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `VARIANT_OPTION_INCONSISTENT` | major | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| **GENEL** | — | 420 | 420 | 420 | 0 | 0 | 100.0% | 100.0% | 100.0% |

## Kaçırılan etiketli hatalar (recall kaybı)

- Yok.

## Yanlış pozitif bulgular (precision kaybı)

- Yok.

## CI eşiği

- Eşik ihlali yok: tüm kurallar precision %100 ve recall %100.

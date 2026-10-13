# Değerlendirme (EVAL)

Bu dosya `pnpm run eval` komutuyla **üretilir**; tablodaki bütün sayılar gerçek bir koşudan
gelir (uydurma/elle girilmiş rakam yoktur). Kaynak: sentetik üretici hata enjekte ederken her
hatayı etiketler; harness etiketleri bulgularla `(kural, ürün, varyant SKU)` anahtarı üzerinden
eşleştirir.

## Koşu parametreleri

- Seed: `20261013`
- Ürün sayısı: **500**
- Etiketli hata: **140** (tür başına 20)
- Kural sayısı: 6

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

## Kural bazlı doğruluk

| Kural | Şiddet | Beklenen | Bulunan | TP | FP | FN | Precision | Recall | F1 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `BARCODE_INVALID` | critical | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `DESC_MISSING` | critical | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `IMAGE_ALT_MISSING` | minor | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `SEO_META_MISSING` | major | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `SKU_MISSING` | critical | 20 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `TITLE_LENGTH` | major | 40 | 40 | 40 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| **GENEL** | — | 140 | 140 | 140 | 0 | 0 | 100.0% | 100.0% | 100.0% |

## Kaçırılan etiketli hatalar (recall kaybı)

- Yok.

## Yanlış pozitif bulgular (precision kaybı)

- Yok.

## CI eşiği

- Eşik ihlali yok: tüm kurallar precision %100 ve recall %100.

# Performans

Bu dosyadaki sayılar **gerçek koşudan** alınmıştır; üretici bir betik tarafından yazılmaz, bu yüzden
`pnpm run eval:bench` çıktısıyla birlikte okunmalıdır. Tek koşu, tek makine (Windows 11, Node 26.7,
`tsx` üzerinden) — ortalama alınmış bir kıyas değildir, büyüklük mertebesi göstergesidir.

## Koşu komutu

```bash
pnpm run eval:bench                  # 10.000 ürün
pnpm run eval:bench -- --products 50000
```

## Ölçüm (10.000 ürün, 17 kural, 21 hata türü, seed 7)

| Ölçüm                                      | Değer                    |
| ------------------------------------------ | ------------------------ |
| Ürün sayısı                                | 10000                    |
| Etiketli hata                              | 420                      |
| Bulgu                                      | 420                      |
| Kural sayısı                               | 17                       |
| Üretim süresi (seed'li sentetik katalog)   | 365,4 ms                 |
| Denetim süresi (tüm kurallar, tek geçiş)   | 1358,7 ms (7360 ürün/sn) |
| Sayfalama (200'lük dilimlerle tam gezinme) | 0,1 ms                   |
| Bellek (heap / RSS)                        | 82,7 MB / 223,1 MB       |

## Yorum

- **Denetim süresi ürün sayısıyla doğrusal** büyür; 10.000 ürün ~1,4 saniyede bitiyor, yani tek
  istekte büyük katalog da işlenebilir. Yine de MCP araçları sonuç dönerken sayfalama kullanır
  (varsayılan sayfa üst sınırı 500, `paginate`/`pageFindings`).
- **Sayfalama maliyeti ölçülemez düzeyde** (0,1 ms): bulgular bellekte sıralı tutulduğu için sayfa
  almak kopyalama maliyetinden ibarettir.
- **Bellek**: katalog tamamen bellekte tutulduğu için RSS ~223 MB. Ürün başına yaklaşık 22 KB;
  100.000 ürünlük bir katalogda bu 2 GB'a yaklaşır — akış (stream) tabanlı içe aktarma Faz 2
  kapsamı dışında bırakıldı ve `CsvImportOptions.maxRows` ile üst sınır kondu.
- Ölçüm yalnızca **kural motorunu** kapsar; LLM öneri katmanı bu tabloda yoktur (ağ gecikmesine
  bağlıdır ve mock ile ölçülür, bkz. `docs/EVAL.md`).

# MCP Sunucusu

`pazaryeri-denetci-mcp`, denetim çekirdeğini **Model Context Protocol** üzerinden AI ajanlarına açar.
Tüm araçlar **salt-okunurdur**: hiçbiri dış sisteme yazmaz, hiçbiri veri değiştirmez.

## Hızlı başlangıç

```bash
pnpm install
pnpm run build                     # packages/mcp-server/dist/bin.js üretir
node packages/mcp-server/dist/bin.js   # stdio üzerinden MCP sunucusu
```

Varsayılan veri kaynağı **sentetik katalogdur** (gerçek kimlik bilgisi gerekmez). Katalog `stderr`'e
yazılan tek satırla bildirilir; `stdout` yalnızca protokol içindir.

## Bir istemciye bağlama (Claude Desktop örneği)

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pazaryeri-denetci": {
      "command": "node",
      "args": [
        "C:\\Users\\<kullanıcı>\\projects\\pazaryeri-denetci-mcp\\packages\\mcp-server\\dist\\bin.js"
      ],
      "env": {
        "MOCK_CATALOG_PRODUCTS": "500",
        "MOCK_CATALOG_DEFECTS_PER_KIND": "5"
      }
    }
  }
}
```

Kendi katalogunuzu (sentetik olmalı) okutmak için `CATALOG_PATH` verin:

```json
"env": { "CATALOG_PATH": "C:\\yol\\katalog.json" }
```

## Ortam değişkenleri

| Değişken                        | Varsayılan | Açıklama                                                        |
| ------------------------------- | ---------- | --------------------------------------------------------------- |
| `CATALOG_PATH`                  | —          | JSON katalog dosyası; verilirse sentetik üretici kullanılmaz    |
| `MOCK_CATALOG_PRODUCTS`         | `200`      | Sentetik katalogdaki ürün sayısı                                |
| `MOCK_CATALOG_SEED`             | `20261013` | Seed (aynı seed = aynı katalog)                                 |
| `MOCK_CATALOG_DEFECTS_PER_KIND` | `5`        | Her hata türü için enjekte edilecek hata sayısı (`0` = hatasız) |

## Araçlar

| Araç               | Ne zaman kullanılır                          | Girdi                                                                |
| ------------------ | -------------------------------------------- | -------------------------------------------------------------------- |
| `list_products`    | Kataloğu gezmek/aramak (sayfalı)             | `offset`, `limit` (≤200), `status`, `productType`, `vendor`, `query` |
| `get_product`      | Tek ürünün tam kaydı                         | `id` veya `handle`                                                   |
| `audit_product`    | Bir ürünü düzeltmeye başlamadan önce         | `id`/`handle`, `ruleIds?`                                            |
| `audit_catalog`    | "Kataloğu denetle, en kritik N sorunu getir" | `topN` (≤100), `ruleIds?`, `severity?`, `offset?`                    |
| `compare_channels` | SKU bazlı fiyat/stok tutarlılığı             | `sku?`, `limit?`                                                     |
| `export_report`    | Kullanıcıya rapor sunmak                     | `format` (`json`\|`markdown`), `maxFindings?`                        |

Tüm araçlar tek bir JSON nesnesini metin bloğu olarak döner (makine tarafından okunabilir). Hatalar
`isError: true` ile **yapılandırılmış** döner; sunucu çökmez ve hata sonrası çağrılar çalışmaya devam
eder.

## Kaynaklar ve prompt'lar

| Tür    | Ad                        | İçerik                                                                        |
| ------ | ------------------------- | ----------------------------------------------------------------------------- |
| Kaynak | `catalog://rules`         | 17 kuralın kimliği, şiddeti, Türkçe başlığı, açıklaması, uygulandığı kanallar |
| Kaynak | `catalog://summary`       | Kaynak bilgisi, ürün/varyant/kanal sayıları, bulgu özeti                      |
| Prompt | `katalog-saglik-denetimi` | Denetim + önceliklendirme çalışma akışı                                       |
| Prompt | `tek-urun-iyilestirme`    | Tek ürün için düzeltme planı (`productId` argümanı)                           |

## Doğrulama (MCP Inspector)

```bash
pnpm run build
npx -y @modelcontextprotocol/inspector --cli node packages/mcp-server/dist/bin.js --method tools/list
npx -y @modelcontextprotocol/inspector --cli node packages/mcp-server/dist/bin.js --method resources/list
npx -y @modelcontextprotocol/inspector --cli node packages/mcp-server/dist/bin.js \
  --method tools/call --tool-name audit_catalog --tool-arg topN=2
```

Bu komutlar bu depoda **çalıştırıldı** ve doğrulandı: `tools/list` altı aracı, `resources/list` iki
kaynağı döndü, `audit_catalog` çağrısı 200 ürünlük sentetik katalogda 105 bulguyu (30 kritik / 70
orta / 5 düşük) getirdi.

Otomatik doğrulama CI'dadır: `packages/mcp-server/test/stdio-integration.test.ts` sunucuyu **ayrı bir
süreç** olarak başlatır, resmî `@modelcontextprotocol/client` ile bağlanır ve araçları, kaynakları,
prompt'ları ve hata yolunu uçtan uca çağırır.

> Not: Inspector'ı `node --import tsx ...` biçiminde çağırmak çalışmaz (Inspector, Node'a geçirilen
> bayrakları ayrıştırırken standart girdiyi script sanıyor). Bu yüzden derlenmiş tek dosya girişi
> (`dist/bin.js`) kullanılır — kullanıcıların istemci yapılandırmasında da aynı giriş vardır.

## Güvenlik ve sınırlar

- **Yazma yok:** araç yüzeyinde yazma niteliğinde tek bir araç bulunmaz; ileride eklenirse `dryRun` +
  açık onay parametresi + denetim kaydı zorunludur (bkz. `docs/DECISIONS.md`).
- **Prompt injection:** ürün başlığı/açıklaması gibi alanlar **veri**dir. Araç çıktısı bir ajana
  "talimat" gibi görünse de uygulanmamalıdır; prompt şablonları bu uyarıyı açıkça taşır. İçerikte
  `<script>` ve satır içi olay işleyicileri `DESC_UNSAFE_HTML` kuralıyla raporlanır, temizleme için
  `sanitizeHtml` vardır.
- **Ağ yok:** stdio taşıması dışında bağlantı kurulmaz; LLM katmanı (Faz 5) yalnızca anahtar
  verildiğinde ve yalnızca öneri üretmek için çağrı yapar.
- **Kurallar örnektir:** resmî pazaryeri zorunlu alanları/kuralları değişir; kullanmadan önce resmî
  dokümandan doğrulanmalıdır.

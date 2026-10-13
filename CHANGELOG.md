# Değişiklik Günlüğü

Bu proje [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) biçimini ve
[Anlamsal Sürümleme](https://semver.org/lang/tr/)'yi izler.

## [Yayınlanmadı]

### Eklendi

- Faz 0: pnpm workspaces iskeleti (`core`, `mock-data`, `mcp-server`, `eval`), TypeScript strict
  kapıları, ESLint + Prettier, Vitest, GitHub Actions CI, `docs/DECISIONS.md` ilk taslak.
- Faz 1: denetim çekirdeği (`TITLE_LENGTH`, `DESC_MISSING`, `SEO_META_MISSING`, `IMAGE_ALT_MISSING`,
  `SKU_MISSING`, `BARCODE_INVALID`), GTIN/EAN sağlama toplamı doğrulaması, seed'li sentetik katalog
  üreticisi (her hatayı etiketleyen hata enjeksiyonu) ve kural bazlı precision/recall üreten eval
  harness'ı (`pnpm run eval`, CI kapısı `pnpm run eval:check`).
- Faz 2: kalan 11 kural (toplam **17**), katalog indeksi (ürünler arası SKU çakışması), sayfalama
  (`pageFindings`), XSS tespiti ve temizleyici (`containsUnsafeHtml`/`sanitizeHtml`), Türkçe
  Markdown + deterministik JSON rapor üreticisi, `packages/catalog-io` (CSV: BOM ve Windows-1254
  kodlama, `1.299,90` biçiminde TR sayılar, satır bazlı uyarılar; JSON dışa/içe aktarma) ve
  10.000 ürünlük performans ölçümü (`pnpm run eval:bench`).
- Faz 3: MCP sunucusu (SDK v2, stdio) — 6 salt-okunur araç, 2 kaynak, 2 prompt şablonu, sayfalama
  sınırları ve yapılandırılmış hata sözleşmesi; `@modelcontextprotocol/client` ile **ayrı süreçte**
  çalışan gerçek stdio entegrasyon testleri; esbuild paketlemesiyle tek dosya çalıştırılabilir giriş
  (`dist/bin.js`); MCP Inspector ile elle doğrulama (`docs/MCP.md`).

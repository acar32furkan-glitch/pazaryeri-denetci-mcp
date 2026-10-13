# Değişiklik Günlüğü

Bu proje [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) biçimini ve
[Anlamsal Sürümleme](https://semver.org/lang/tr/)'yi izler.

## [0.1.0] - 2026-10-13

İlk yayın. Pazaryeri kataloglarını **17 deterministik kural** ile denetleyen bir motor, seed'li
sentetik veri üreticisi ve ölçülmüş precision/recall üreten bir eval harness'ı, denetimi
salt-okunur araç/kaynak/prompt olarak sunan stdio + Streamable HTTP taşımalı bir MCP sunucusu,
isteğe bağlı ve öneri-only bir LLM düzeltme katmanı ile Next.js denetim demosunu içerir.

### Eklendi

- **Faz 0 — İskele:** pnpm workspaces monorepo (`core`, `mock-data`, `mcp-server`, `eval`),
  TypeScript `strict` kapıları, ESLint (flat config) + Prettier, Vitest, GitHub Actions CI
  (lint / biçim / typecheck / test) ve `docs/DECISIONS.md` ilk taslağı (ADR-001..008).
- **Faz 1 — Denetim çekirdeği:** denetim modeli, kural motoru ve ilk 6 kural (`TITLE_LENGTH`,
  `DESC_MISSING`, `SEO_META_MISSING`, `IMAGE_ALT_MISSING`, `SKU_MISSING`, `BARCODE_INVALID`);
  GTIN/EAN sağlama toplamı doğrulaması; seed'li sentetik katalog üreticisi ve her hatayı
  etiketleyen hata enjeksiyonu; kural bazlı precision/recall üreten eval harness'ı, eşik kapısı
  ve rapor üreticisi (`pnpm run eval`, `pnpm run eval:check`).
- **Faz 2 — Kural seti ve çıktı:** kalan 11 kural ile toplam **17** kural; ürünler arası SKU
  çakışmasını yakalayan katalog indeksi ve sayfalama (`pageFindings`); XSS tespiti ve temizleyici
  (`containsUnsafeHtml`/`sanitizeHtml`); Türkçe Markdown ve deterministik JSON rapor üreticisi.
- **Faz 2 — `catalog-io` paketi:** CSV içe/dışa aktarma (BOM ve Windows-1254 kodlama,
  `1.299,90` biçiminde TR sayılar, satır bazlı uyarılar) ve JSON dışa/içe aktarma; CSV denetim
  CLI'i (`pnpm run audit:csv`).
- **Faz 2 — Eval ve performans:** 17 kural için eval konfigürasyonu, 10.000 ürünlük performans
  ölçümü (`pnpm run eval:bench`) ve ölçülmüş sonuçların dokümantasyonu.
- **Faz 3 — MCP sunucusu (stdio):** SDK v2 üzerinde 6 salt-okunur araç, 2 kaynak ve 2 prompt
  şablonu; sayfalama sınırları ve yapılandırılmış hata sözleşmesi; `@modelcontextprotocol/client`
  ile ayrı süreçte çalışan gerçek stdio entegrasyon testleri; esbuild ile tek dosya
  çalıştırılabilir giriş (`dist/bin.js`); MCP Inspector ile elle doğrulama (`docs/MCP.md`).
- **Faz 3 — Streamable HTTP taşıması:** bearer token, `Host`/`Origin` doğrulama ile istek hızı ve
  gövde boyutu sınırları (ADR-015).
- **Faz 4 — `apps/web`:** Next.js + Tailwind denetim demosu (3 katalog profili, JSON ve Markdown
  rotaları).
- **Faz 5 — LLM öneri katmanı (`suggest`):** istemci soyutlaması, prompt sınırlama, şema
  doğrulama, önbellek ve kota; MCP `suggest_fix` aracı (salt-öneri; `MCP_LLM_MODE=auto|mock|off`)
  ve eval tarafında öneri kalite kontrolü (mock istemci, eşik 1.0).

### Değişen

- Paketler `core` ve `mock-data`'ya `workspace:*` bağımlılıklarıyla bağlandı; `suggest` paketi
  `mcp-server` ve `eval` bağımlılıklarına eklendi; `apps/web` workspace'e alındı.
- `mcp-server` derlemesi esbuild bundle'a taşındı, HTTP girişi derlemeye eklendi ve CI'a derleme
  adımı eklendi.
- Next.js'in ürettiği dosyalar biçim denetiminden çıkarıldı; kod ve dokümanlarda Prettier biçim
  düzeltmeleri uygulandı.
- MCP SDK v2 gereksinimi olan `zod` 4.6.7 için minimum yayın yaşı istisnası eklendi.

### Düzeltilen

- LLM öneri katmanında kontrol karakteri taraması `no-control-regex` kuralına uygun olacak
  şekilde regex'siz yapıldı; mock başlık üretimi başlık kuralı sınırlarına (`TITLE_MIN`) taşındı.

### Güvenlik

- Katalog HTML içeriğinde XSS tespiti ve temizleme (`containsUnsafeHtml`/`sanitizeHtml`).
- MCP HTTP taşımasında bearer token doğrulama, `Host`/`Origin` kontrolü ile istek hızı ve gövde
  boyutu sınırları (ADR-015).
- LLM öneri katmanında prompt injection savunması: girdi sınırlama ve şema doğrulama (ADR-016).

### Belgeler

- `README.md` yol haritası ve `docs/DECISIONS.md` karar kayıtları (ADR-001..016).
- `docs/MCP.md` kurulum ve istemci kılavuzu, `docs/EVAL.md` ölçülmüş eval sonuçları,
  `docs/PERFORMANS.md` performans ölçümleri ve `docs/LLM.md` öneri katmanı belgesi.
- `docs/DURUM-RAPORU.html` durum raporu (ölçülmüş rakamlarla tek dosya); Windows rezerve port
  aralığı ve demo profil davranışı kayda geçirildi.

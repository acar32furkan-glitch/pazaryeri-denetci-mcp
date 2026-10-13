/**
 * Büyük katalog ölçümü (Bölüm 10: "çok büyük katalog: sayfalama, toplu işleme, bellek tüketimi").
 *
 * Kural: burada **ölçülen** değerler yazdırılır, tahmin yok. Çıktı docs/PERFORMANS.md'ye elle
 * taşınır (uydurabilmesin diye tablo üretici tarafından yazılmaz).
 */
import { performance } from 'node:perf_hooks';

import { RULE_CATALOG, auditCatalog, pageFindings } from '@pazaryeri-denetci/core';
import { generateCatalog } from '@pazaryeri-denetci/mock-data';

export interface BenchOptions {
  readonly productCount: number;
  readonly defectsPerKind: number;
  readonly seed: number;
}

export interface BenchResult {
  readonly productCount: number;
  readonly injectedDefects: number;
  readonly findings: number;
  readonly rules: number;
  readonly generateMs: number;
  readonly auditMs: number;
  readonly pageMs: number;
  readonly heapUsedMb: number;
  readonly rssMb: number;
  readonly productsPerSecond: number;
}

const DEFAULT_BENCH: BenchOptions = { productCount: 10_000, defectsPerKind: 20, seed: 7 };

function megabytes(bytes: number): number {
  return Number((bytes / 1024 / 1024).toFixed(1));
}

export function runBench(options: BenchOptions = DEFAULT_BENCH): BenchResult {
  const start = performance.now();
  const generated = generateCatalog({
    seed: options.seed,
    productCount: options.productCount,
    defectsPerKind: options.defectsPerKind,
  });
  const generateMs = performance.now() - start;

  const auditStart = performance.now();
  const audit = auditCatalog(generated.catalog);
  const auditMs = performance.now() - auditStart;

  const pageStart = performance.now();
  let seen = 0;
  let page = pageFindings(audit.findings, { offset: 0, limit: 200 });
  seen += page.items.length;
  while (page.hasMore) {
    page = pageFindings(audit.findings, { offset: page.offset + page.limit, limit: 200 });
    seen += page.items.length;
  }
  const pageMs = performance.now() - pageStart;
  if (seen !== audit.findings.length) {
    throw new Error(
      `Sayfalama tüm bulguları gezmedi: ${String(seen)} / ${String(audit.findings.length)}`,
    );
  }

  const memory = process.memoryUsage();
  return {
    productCount: generated.meta.productCount,
    injectedDefects: generated.meta.injectedCount,
    findings: audit.findings.length,
    rules: RULE_CATALOG.length,
    generateMs: Number(generateMs.toFixed(1)),
    auditMs: Number(auditMs.toFixed(1)),
    pageMs: Number(pageMs.toFixed(1)),
    heapUsedMb: megabytes(memory.heapUsed),
    rssMb: megabytes(memory.rss),
    productsPerSecond: Math.round((options.productCount / auditMs) * 1000),
  };
}

export function formatBenchTable(result: BenchResult): string {
  const rows: readonly (readonly [string, string])[] = [
    ['Ürün sayısı', String(result.productCount)],
    ['Etiketli hata', String(result.injectedDefects)],
    ['Bulgu', String(result.findings)],
    ['Kural sayısı', String(result.rules)],
    ['Üretim süresi', `${String(result.generateMs)} ms`],
    [
      'Denetim süresi',
      `${String(result.auditMs)} ms (${String(result.productsPerSecond)} ürün/sn)`,
    ],
    ["Sayfalama (200'lük dilimlerle tam gezinme)", `${String(result.pageMs)} ms`],
    ['Bellek (heap / RSS)', `${String(result.heapUsedMb)} MB / ${String(result.rssMb)} MB`],
  ];
  return rows.map(([label, value]) => `| ${label} | ${value} |`).join('\n');
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const countIndex = argv.indexOf('--products');
  const productCount = countIndex >= 0 ? Number(argv[countIndex + 1]) : DEFAULT_BENCH.productCount;
  if (!Number.isInteger(productCount) || productCount <= 0) {
    process.stderr.write('--products pozitif bir tam sayı olmalı.\n');
    return 2;
  }

  const result = runBench({ ...DEFAULT_BENCH, productCount });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`\n| Ölçüm | Değer |\n| --- | --- |\n${formatBenchTable(result)}\n`);
  return 0;
}

if (process.argv[1]?.includes('bench') ?? false) {
  process.exitCode = main();
}

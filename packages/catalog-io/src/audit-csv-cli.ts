/**
 * CSV → denetim → rapor CLI'ı.
 *
 * `pnpm run audit:csv -- examples/ornek-katalog.csv [--out rapor.md] [--max-findings 20]`
 *
 * Tek geçişte: kodlama tespiti (BOM/Windows-1254), TR sayı biçimi ayrıştırma, satır bazlı
 * uyarılar, denetim ve Türkçe Markdown rapor. Salt-okunur: dosyayı yalnızca okur.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { auditCatalog, renderFindingsMarkdown } from '@pazaryeri-denetci/core';

import { importCsv } from './csv-import.ts';

interface CliOptions {
  readonly file: string;
  readonly out: string | null;
  readonly maxFindings: number | undefined;
  readonly json: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions | string {
  const positional = argv.filter((argument) => !argument.startsWith('--'));
  const file = positional[0];
  if (file === undefined) {
    return 'Kullanım: pnpm run audit:csv -- <dosya.csv> [--out rapor.md] [--max-findings 20] [--json]';
  }
  const outIndex = argv.indexOf('--out');
  const maxIndex = argv.indexOf('--max-findings');
  const maxRaw = maxIndex >= 0 ? argv[maxIndex + 1] : undefined;
  const parsedMax = maxRaw === undefined ? undefined : Number(maxRaw);
  if (parsedMax !== undefined && (!Number.isInteger(parsedMax) || parsedMax < 0)) {
    return '--max-findings negatif olmayan bir tam sayı olmalı.';
  }
  return {
    file,
    out: outIndex >= 0 ? (argv[outIndex + 1] ?? null) : null,
    maxFindings: parsedMax,
    json: argv.includes('--json'),
  };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const parsed = parseArgs(argv);
  if (typeof parsed === 'string') {
    process.stderr.write(`${parsed}\n`);
    return 2;
  }

  const path = resolve(process.cwd(), parsed.file);
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch (error) {
    process.stderr.write(
      `Dosya okunamadı: ${path} (${error instanceof Error ? error.message : String(error)})\n`,
    );
    return 2;
  }

  const imported = importCsv(bytes);
  const result = auditCatalog(imported.catalog);
  const markdown = renderFindingsMarkdown(result, {
    title: `Katalog Denetim Raporu — ${parsed.file}`,
    ...(parsed.maxFindings === undefined ? {} : { maxFindings: parsed.maxFindings }),
  });

  if (parsed.out !== null) {
    writeFileSync(resolve(process.cwd(), parsed.out), markdown, 'utf8');
  } else {
    process.stdout.write(`${markdown}\n`);
  }

  const summary = [
    `Satır: ${String(imported.rowCount)} · ürün: ${String(imported.productCount)} · atlanan satır: ${String(imported.skippedRows)}`,
    `Bulgu: ${String(result.summary.findingCount)} (kritik ${String(result.summary.bySeverity.critical)}, orta ${String(result.summary.bySeverity.major)}, düşük ${String(result.summary.bySeverity.minor)})`,
    `İçe aktarma uyarısı: ${String(imported.warnings.length)}`,
  ];
  if (parsed.json) {
    process.stdout.write(
      `${JSON.stringify({ summary: result.summary, warnings: imported.warnings }, null, 2)}\n`,
    );
  }
  for (const line of summary) process.stderr.write(`${line}\n`);
  for (const warning of imported.warnings.slice(0, 5)) {
    process.stderr.write(`  - satır ${String(warning.row)} [${warning.code}] ${warning.message}\n`);
  }
  return 0;
}

if (process.argv[1]?.includes('audit-csv') ?? false) {
  process.exitCode = main();
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { DEFAULT_EVAL_CONFIG, runEvalFull } from './harness.ts';
import { formatPercent } from './metrics.ts';

import type { EvalConfig } from './harness.ts';

interface CliOptions {
  readonly config: EvalConfig;
  readonly out: string;
  readonly check: boolean;
  readonly json: boolean;
  readonly help: boolean;
}

const DEFAULT_OUT = 'docs/EVAL.md';

function parseNumber(value: string | undefined, flag: string, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} pozitif bir tam sayı olmalı, alınan: "${value}"`);
  }
  return parsed;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  let config: EvalConfig = DEFAULT_EVAL_CONFIG;
  let out = DEFAULT_OUT;
  let check = false;
  let json = false;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    switch (flag) {
      case '--seed':
        config = { ...config, seed: parseNumber(argv[index + 1], '--seed', config.seed) };
        index += 1;
        break;
      case '--products':
        config = {
          ...config,
          productCount: parseNumber(argv[index + 1], '--products', config.productCount),
        };
        index += 1;
        break;
      case '--defects-per-kind':
        config = {
          ...config,
          defectsPerKind: parseNumber(argv[index + 1], '--defects-per-kind', config.defectsPerKind),
        };
        index += 1;
        break;
      case '--out':
        out = argv[index + 1] ?? out;
        index += 1;
        break;
      case '--check':
        check = true;
        break;
      case '--json':
        json = true;
        break;
      case '--help':
      case '-h':
        help = true;
        break;
      default:
        if (flag !== undefined && flag.startsWith('--')) {
          throw new Error(`Bilinmeyen bayrak: ${flag}`);
        }
    }
  }

  return { config, out, check, json, help };
}

function printHelp(): void {
  process.stdout.write(
    [
      'Kullanım: pnpm run eval [-- --seed N] [--products N] [--defects-per-kind N] [--out YOL] [--check] [--json]',
      '',
      '  --seed              sentetik katalog seed değeri',
      '  --products          üretilecek ürün sayısı',
      '  --defects-per-kind  her hata türü için hata enjekte edilecek ürün sayısı',
      '  --out               raporun yazılacağı dosya (varsayılan: docs/EVAL.md)',
      '  --check             dosyayı yazmaz; mevcut içerikle karşılaştırır ve eşik ihlalinde çıkış kodu 1 verir',
      "  --json              özet metrikleri JSON olarak stdout'a yazar",
    ].join('\n') + '\n',
  );
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }

  if (options.help) {
    printHelp();
    return 0;
  }

  const run = await runEvalFull(options.config);
  const totals = run.report.totals;
  const summary = [
    `Ürün: ${totals.productCount} · etiketli hata: ${totals.injectedDefects} · bulgu: ${totals.findings}`,
    `Genel precision ${formatPercent(totals.precision)} · recall ${formatPercent(totals.recall)} · F1 ${formatPercent(totals.f1)}`,
    `Öneri kalite (mock): ${run.suggest.suggestions}/${run.suggest.requests} öneri · genel geçme ${formatPercent(run.suggest.passRate)} (${run.suggest.passed}/${run.suggest.expected})`,
  ];

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({ config: run.config, totals, rules: run.report.rules, suggest: run.suggest }, null, 2)}\n`,
    );
  }

  if (options.check) {
    const path = resolve(process.cwd(), options.out);
    if (!existsSync(path)) {
      process.stderr.write(`Rapor dosyası yok: ${path}\nÖnce "pnpm run eval" çalıştırın.\n`);
      return 1;
    }
    const current = readFileSync(path, 'utf8');
    const stale = current !== run.markdown;
    for (const line of summary) process.stdout.write(`${line}\n`);
    if (stale) {
      process.stderr.write(
        `${options.out} güncel değil: "pnpm run eval" ile yeniden üretip commit edin.\n`,
      );
    }
    if (run.violations.length > 0) {
      process.stderr.write(
        `Eşik ihlalleri:\n${run.violations.map((v) => `  - ${v}`).join('\n')}\n`,
      );
    }
    if (!stale && run.violations.length === 0) {
      process.stdout.write(`${options.out} güncel ve eşikler sağlanıyor.\n`);
      return 0;
    }
    return 1;
  }

  const path = resolve(process.cwd(), options.out);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, run.markdown, 'utf8');
  for (const line of summary) process.stdout.write(`${line}\n`);
  process.stdout.write(`Rapor yazıldı: ${options.out}\n`);
  if (run.violations.length > 0) {
    process.stderr.write(`Eşik ihlalleri:\n${run.violations.map((v) => `  - ${v}`).join('\n')}\n`);
    return 1;
  }
  return 0;
}

const invokedDirectly = process.argv[1]?.includes('cli') ?? false;
if (invokedDirectly) {
  void main().then((code) => {
    process.exitCode = code;
  });
}

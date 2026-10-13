/**
 * MCP sunucusunun veri kaynağı.
 *
 * Mock-first ilkesi gereği varsayılan kaynak **sentetik katalogdur**; gerçek kimlik bilgisi
 * gerekmez. İstenirse `CATALOG_PATH` ile JSON katalog okunur (yine sentetik olmalı: gerçek marka
 * verisi depoya/oturuma girmez — bkz. docs/DECISIONS.md, ADR-003).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { importCatalogJson } from '@pazaryeri-denetci/catalog-io';
import { generateCatalog } from '@pazaryeri-denetci/mock-data';

import type { Catalog } from '@pazaryeri-denetci/core';

export interface ServerConfig {
  readonly catalog: Catalog;
  /** Katalog nereden geldi — araç çıktılarında şeffaflık için raporlanır. */
  readonly source: 'synthetic' | 'file';
  readonly sourceDetail: string;
}

export interface ConfigEnv {
  readonly CATALOG_PATH?: string | undefined;
  readonly MOCK_CATALOG_PRODUCTS?: string | undefined;
  readonly MOCK_CATALOG_SEED?: string | undefined;
  readonly MOCK_CATALOG_DEFECTS_PER_KIND?: string | undefined;
}

const DEFAULT_PRODUCTS = 200;
const DEFAULT_SEED = 20261013;
const DEFAULT_DEFECTS_PER_KIND = 5;

function positiveInteger(raw: string | undefined, fallback: number, label: string): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} pozitif bir tam sayı olmalı, alınan: "${raw}"`);
  }
  return parsed;
}

function nonNegativeInteger(raw: string | undefined, fallback: number, label: string): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} negatif olmayan bir tam sayı olmalı, alınan: "${raw}"`);
  }
  return parsed;
}

export function createServerConfig(env: ConfigEnv = process.env): ServerConfig {
  const catalogPath = env.CATALOG_PATH?.trim();
  if (catalogPath !== undefined && catalogPath !== '') {
    const path = resolve(process.cwd(), catalogPath);
    const json = readFileSync(path, 'utf8');
    return {
      catalog: importCatalogJson(json),
      source: 'file',
      sourceDetail: path,
    };
  }

  const productCount = positiveInteger(
    env.MOCK_CATALOG_PRODUCTS,
    DEFAULT_PRODUCTS,
    'MOCK_CATALOG_PRODUCTS',
  );
  const seed = positiveInteger(env.MOCK_CATALOG_SEED, DEFAULT_SEED, 'MOCK_CATALOG_SEED');
  const defectsPerKind = nonNegativeInteger(
    env.MOCK_CATALOG_DEFECTS_PER_KIND,
    DEFAULT_DEFECTS_PER_KIND,
    'MOCK_CATALOG_DEFECTS_PER_KIND',
  );

  const generated = generateCatalog({ seed, productCount, defectsPerKind });
  return {
    catalog: generated.catalog,
    source: 'synthetic',
    sourceDetail: `seed=${String(seed)}, ürün=${String(productCount)}, tür başına hata=${String(defectsPerKind)}`,
  };
}

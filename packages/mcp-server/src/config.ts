/**
 * MCP sunucusunun veri kaynağı ve öneri (LLM) yapılandırması.
 *
 * Mock-first ilkesi gereği varsayılan kaynak **sentetik katalogdur**; gerçek kimlik bilgisi
 * gerekmez. İstenirse `CATALOG_PATH` ile JSON katalog okunur (yine sentetik olmalı: gerçek marka
 * verisi depoya/oturuma girmez — bkz. docs/DECISIONS.md, ADR-003).
 *
 * Öneri katmanı **isteğe bağlıdır**: yapılandırma eksikse istemci `disabled` döner, sunucu normal
 * çalışır ve `suggest_fix` yapılandırılmış "devre dışı" yanıtı verir (hiçbir şey yazılmaz).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { importCatalogJson } from '@pazaryeri-denetci/catalog-io';
import { generateCatalog } from '@pazaryeri-denetci/mock-data';
import {
  DEFAULT_DAILY_TOKEN_BUDGET,
  DEFAULT_MAX_TOKENS_PER_REQUEST,
  createDemoMockClient,
  createDisabledClient,
  createLlmClientFromEnv,
  createSuggester,
} from '@pazaryeri-denetci/suggest';

import type { Catalog } from '@pazaryeri-denetci/core';
import type { LlmClient, Suggester } from '@pazaryeri-denetci/suggest';

/** Öneri yolunun çıktıda görünen modu: gerçek model, sahte (demo) istemci ya da kapalı. */
export type LlmMode = 'llm' | 'mock' | 'devre-disi';

/** Hazır öneri katmanı: istemci + önbellek/kota sarmalayıcısı. Süreç başına tek kez kurulur. */
export interface LlmPlan {
  readonly mode: LlmMode;
  readonly client: LlmClient;
  readonly suggester: Suggester;
  readonly maxTokensPerRequest: number;
  readonly dailyTokenBudget: number;
}

export interface ServerConfig {
  readonly catalog: Catalog;
  /** Katalog nereden geldi — araç çıktılarında şeffaflık için raporlanır. */
  readonly source: 'synthetic' | 'file';
  readonly sourceDetail: string;
  /** Öneri katmanı; yapılandırma yoksa `devre-disi` (sunucu yine çalışır). */
  readonly llm: LlmPlan;
}

export interface ConfigEnv {
  readonly CATALOG_PATH?: string | undefined;
  readonly MOCK_CATALOG_PRODUCTS?: string | undefined;
  readonly MOCK_CATALOG_SEED?: string | undefined;
  readonly MOCK_CATALOG_DEFECTS_PER_KIND?: string | undefined;
  /** `off` | `mock` | `auto` (tanımsız = auto). */
  readonly MCP_LLM_MODE?: string | undefined;
  readonly ANTHROPIC_API_KEY?: string | undefined;
  readonly LLM_MODEL?: string | undefined;
  readonly LLM_MAX_TOKENS_PER_REQUEST?: string | undefined;
  readonly LLM_DAILY_TOKEN_BUDGET?: string | undefined;
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
  const llm = createLlmPlan(env);
  const catalogPath = env.CATALOG_PATH?.trim();
  if (catalogPath !== undefined && catalogPath !== '') {
    const path = resolve(process.cwd(), catalogPath);
    const json = readFileSync(path, 'utf8');
    return {
      catalog: importCatalogJson(json),
      source: 'file',
      sourceDetail: path,
      llm,
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
    llm,
  };
}

/**
 * `MCP_LLM_MODE` ile öneri istemcisini seçer:
 * - `off` → devre dışı istemci (hiçbir çağrı yapılmaz, `suggest_fix` "devre-disi" der),
 * - `mock` → `createDemoMockClient()` (SAHTE istemci: gerçek model çağrılmaz, çıktıda `mock` görünür),
 * - `auto` ya da tanımsız → `createLlmClientFromEnv(env)`; anahtar/model yoksa **devre dışı** döner
 *   ve sunucu çökmez.
 *
 * `mock` dışındaki her yol gerçek ortam değişkenlerine bakar; yani anahtarsız bir kurulum asla
 * sessizce öneri üretmez.
 */
export function createLlmPlan(env: ConfigEnv): LlmPlan {
  const rawMode = (env.MCP_LLM_MODE ?? '').trim().toLowerCase();
  const maxTokensPerRequest = positiveInteger(
    env.LLM_MAX_TOKENS_PER_REQUEST,
    DEFAULT_MAX_TOKENS_PER_REQUEST,
    'LLM_MAX_TOKENS_PER_REQUEST',
  );
  const dailyTokenBudget = positiveInteger(
    env.LLM_DAILY_TOKEN_BUDGET,
    DEFAULT_DAILY_TOKEN_BUDGET,
    'LLM_DAILY_TOKEN_BUDGET',
  );

  let client: LlmClient;
  if (rawMode === 'off') {
    client = createDisabledClient(
      'Öneri özelliği devre dışı: MCP_LLM_MODE=off. Denetim sonuçları bundan etkilenmez.',
    );
  } else if (rawMode === 'mock') {
    client = createDemoMockClient();
  } else if (rawMode === '' || rawMode === 'auto') {
    client = createLlmClientFromEnv({
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      LLM_MODEL: env.LLM_MODEL,
    });
  } else {
    throw new Error(`MCP_LLM_MODE geçersiz: "${rawMode}" (beklenen: auto | mock | off)`);
  }

  const mode: LlmMode =
    client.kind === 'anthropic' ? 'llm' : client.kind === 'mock' ? 'mock' : 'devre-disi';

  return {
    mode,
    client,
    suggester: createSuggester({ client, maxTokensPerRequest, dailyTokenBudget }),
    maxTokensPerRequest,
    dailyTokenBudget,
  };
}

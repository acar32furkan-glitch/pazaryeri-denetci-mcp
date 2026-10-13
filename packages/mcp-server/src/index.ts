/**
 * MCP sunucusu (Faz 3'te dolacak): araçlar, kaynaklar ve prompt şablonları.
 *
 * Faz 0 yalnızca iskeleti kurar; bu dosya paketin çözümlendiğini kanıtlar.
 */
export const PACKAGE_NAME = '@pazaryeri-denetci/mcp-server';

export { createServerConfig, createLlmPlan } from './config.ts';
export type { ConfigEnv, LlmMode, LlmPlan, ServerConfig } from './config.ts';

export { createServer, ruleCatalogJson } from './server.ts';

export { createHttpServer, listen } from './http.ts';
export type { HttpServerOptions, RateLimitOptions, RunningHttpServer } from './http.ts';

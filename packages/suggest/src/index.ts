export const PACKAGE_NAME = '@pazaryeri-denetci/suggest';

export {
  ALL_SUGGEST_TARGETS,
} from './types.ts';
export type {
  LlmClient,
  LlmCompletionInput,
  LlmCompletionResult,
  LlmUsage,
  Severity,
  SuggestFinding,
  SuggestOutcome,
  SuggestProduct,
  SuggestRequest,
  SuggestStats,
  SuggestTarget,
  SuggestUnavailableReason,
  Suggestion,
  SuggestionFields,
} from './types.ts';

export {
  buildDataPayload,
  buildPrompt,
  buildSystemPrompt,
  cleanField,
  FENCE_END,
  FENCE_START,
  FIELD_MAX_CHARS,
  MAX_FINDINGS_IN_PROMPT,
  neutralizeFence,
  resolveTargets,
} from './prompt.ts';
export type { BuiltPrompt } from './prompt.ts';

export {
  extractJsonObject,
  LLM_MAX,
  LlmSuggestionSchema,
  parseSuggestion,
} from './schema.ts';
export type { LlmSuggestion, ParseResult } from './schema.ts';

export {
  createAnthropicClient,
  createDisabledClient,
  createLlmClientFromEnv,
  createMockClient,
  DEFAULT_LLM_TIMEOUT_MS,
} from './clients.ts';
export type { AnthropicClientOptions, LlmEnv, MockClientOptions } from './clients.ts';

export { createDemoMockClient, DEMO_MOCK_LIMITS } from './demo-client.ts';
export type { DemoMockOptions } from './demo-client.ts';

export {
  createSuggester,
  DEFAULT_CACHE_LIMIT,
  DEFAULT_DAILY_TOKEN_BUDGET,
  DEFAULT_MAX_TOKENS_PER_REQUEST,
  suggestionCacheKey,
} from './suggest.ts';
export type { Suggester, SuggesterOptions } from './suggest.ts';

/**
 * LLM ARCHITECTURE OPTIONS
 * ========================
 *
 * CURRENT (baseline):
 * - Classifier has store overview, responder gets full pretty-printed result
 * - ~3,650 tokens, 2 LLM calls, ~13-15s
 * - No optimizations, for comparison only
 *
 * ENHANCED (recommended):
 * - Same flow as Current
 * - + Slim function results (remove imageURL, tags)
 * - + No JSON pretty-printing
 * - + Reasoning disabled
 * - ~2,250 tokens, 2 LLM calls, ~6-9s
 *
 * LEAN (experimental):
 * - Classifier has NO store data (only function names)
 * - Smallest prompts, fastest classification
 * - Risk: may misclassify without semantic context
 * - ~1,100 tokens, 2 LLM calls, ~4-6s
 *
 * COMBINED (native tools):
 * - Single LLM call with native tool calling
 * - Uses existing chat-completion-test endpoint
 * - Limited to 1 function call per message
 * - ~1,800 tokens, 1 LLM call, ~4-6s
 */

export type ArchitectureMode = 'current' | 'enhanced' | 'lean' | 'combined';

export interface ArchitectureConfig {
  mode: ArchitectureMode;
  slimResults: boolean;
  prettyPrint: boolean;
  reasoningEnabled: boolean;
  classifierHasData: boolean;
  endpoint: string;
}

export const ARCHITECTURE_CONFIGS: Record<ArchitectureMode, ArchitectureConfig> = {
  current: {
    mode: 'current',
    slimResults: false,
    prettyPrint: true,
    reasoningEnabled: true, // Not explicitly disabled
    classifierHasData: true,
    endpoint: 'chat-completion',
  },
  enhanced: {
    mode: 'enhanced',
    slimResults: true,
    prettyPrint: false,
    reasoningEnabled: false,
    classifierHasData: true,
    endpoint: 'chat-completion',
  },
  lean: {
    mode: 'lean',
    slimResults: true,
    prettyPrint: false,
    reasoningEnabled: false,
    classifierHasData: false,
    endpoint: 'chat-completion',
  },
  combined: {
    mode: 'combined',
    slimResults: true,
    prettyPrint: false,
    reasoningEnabled: false,
    classifierHasData: false, // N/A - uses tools array
    endpoint: 'chat-completion-native',
  },
};

export function getArchitectureConfig(mode: ArchitectureMode): ArchitectureConfig {
  return ARCHITECTURE_CONFIGS[mode] || ARCHITECTURE_CONFIGS.enhanced;
}

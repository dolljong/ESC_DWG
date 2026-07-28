/**
 * The single model this app uses.
 *
 * Chosen for cost: $0.14/M in, $0.28/M out on OpenRouter — the same base rate
 * DeepSeek charges directly — which works out to about $0.27 per 1,000
 * requests of the size this app makes (~1,200 prompt + ~350 output tokens).
 *
 * Kept as .mjs so the Vite config (Node) and the browser can share it, and
 * so the proxy's allowlist can never drift from what the client asks for.
 */
export const MODEL_ID = 'deepseek/deepseek-v4-flash'
export const MODEL_LABEL = 'DeepSeek V4 Flash'

// ─── Anthropic model selection ───────────────────────────────────────────────
// Models are read from env vars at request time (not module load) so the
// same build can switch models without a redeploy. Fallbacks match the
// historical hardcoded values.

const DEFAULT_CHAT_MODEL     = 'claude-sonnet-4-6'
const DEFAULT_INSIGHTS_MODEL = 'claude-haiku-4-5-20251001'

/** Model used for longer-form chat / proposal generation (sonnet by default). */
export function anthropicChatModel(): string {
  return process.env.ANTHROPIC_MODEL_CHAT || DEFAULT_CHAT_MODEL
}

/** Model used for fast, cheaper inference (haiku by default). */
export function anthropicInsightsModel(): string {
  return process.env.ANTHROPIC_MODEL_INSIGHTS || DEFAULT_INSIGHTS_MODEL
}

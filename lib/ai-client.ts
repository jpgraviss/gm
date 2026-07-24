// Unified AI client — Ollama (local) → Groq (free cloud) → Gemini (free
// cloud) → Cerebras (free cloud) → template fallback. All 4 real providers
// use the OpenAI-compatible chat completions format.
import { createServiceClient } from '@/lib/supabase'

// ── Config ──────────────────────────────────────────────────────────────────

function ollamaUrl(): string {
  return process.env.OLLAMA_URL || 'http://localhost:11434'
}
function ollamaModel(): string {
  return process.env.OLLAMA_MODEL || 'llama3.1'
}
function groqKey(): string | undefined {
  return process.env.GROQ_API_KEY
}
function groqChatModel(): string {
  return process.env.GROQ_MODEL_CHAT || 'llama-3.3-70b-versatile'
}
function groqFastModel(): string {
  return process.env.GROQ_MODEL_FAST || 'llama-3.1-8b-instant'
}
function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY
}
function geminiModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-2.0-flash'
}
function geminiFastModel(): string {
  return process.env.GEMINI_MODEL_FAST || 'gemini-2.0-flash-lite'
}
function cerebrasKey(): string | undefined {
  return process.env.CEREBRAS_API_KEY
}
function cerebrasChatModel(): string {
  return process.env.CEREBRAS_MODEL_CHAT || 'llama-3.3-70b'
}
function cerebrasFastModel(): string {
  return process.env.CEREBRAS_MODEL_FAST || 'llama3.1-8b'
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: AiToolCall[]
  tool_call_id?: string
  // The function name a 'tool' message is responding to. OpenAI/Groq/
  // Cerebras don't require this (they key off tool_call_id), but Gemini's
  // OpenAI-compat layer rejects a tool-result message that omits it
  // ("function_response.name empty") — always populating it is harmless
  // for every other provider and required for this one.
  name?: string
}

export interface AiToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface AiToolDef {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

interface OpenAiToolDef {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export interface AiResponse {
  text: string
  toolCalls: { id: string; name: string; args: Record<string, unknown> }[]
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error'
  source: 'ollama' | 'groq' | 'gemini' | 'cerebras' | 'none'
}

interface ChatOpts {
  messages: AiMessage[]
  system?: string
  tools?: AiToolDef[]
  maxTokens?: number
  fast?: boolean // use the smaller/faster model
  timeoutMs?: number
  // Short label identifying the calling feature (e.g. 'proposal_generator',
  // 'crm_enrich') — logged to ai_usage_log so Settings > AI Usage can show
  // a per-feature breakdown. Neither Ollama nor Groq expose a usage-query
  // API this app can call, so this local log is the only way to see real
  // call volume/provider split.
  feature?: string
  // Absolute timestamp (Date.now()-comparable) after which chatCompletion
  // should stop trying further provider tiers and fall straight to the
  // template. Without this, a caller's own wall-clock budget (e.g.
  // app/api/ai/chat/route.ts's agentic loop) only gets checked BETWEEN
  // chatCompletion() calls — but a single call can itself try up to 4
  // providers sequentially, each with its own full timeoutMs, so one call
  // could internally run far longer than any per-call timeout suggests.
  deadlineAt?: number
}

// ── Format converters ───────────────────────────────────────────────────────

function toOpenAiTools(tools: AiToolDef[]): OpenAiToolDef[] {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }))
}

function buildMessages(system: string | undefined, messages: AiMessage[]): AiMessage[] {
  const out: AiMessage[] = []
  if (system) out.push({ role: 'system', content: system })
  out.push(...messages)
  return out
}

// ── Provider calls ──────────────────────────────────────────────────────────

interface OpenAiChoice {
  message: {
    role: string
    content: string | null
    tool_calls?: AiToolCall[]
  }
  finish_reason: string
}

interface OpenAiUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

interface OpenAiResponse {
  choices: OpenAiChoice[]
  usage?: OpenAiUsage
}

async function callProvider(
  url: string,
  headers: Record<string, string>,
  model: string,
  msgs: AiMessage[],
  tools: OpenAiToolDef[] | undefined,
  maxTokens: number,
  timeoutMs: number,
  // Cerebras' chat completions endpoint is strict and rejects `max_tokens`
  // outright — it wants `max_completion_tokens`. Every other provider here
  // accepts the OpenAI-standard `max_tokens`.
  tokenParam: 'max_tokens' | 'max_completion_tokens' = 'max_tokens',
): Promise<Omit<AiResponse, 'source'> & { raw: OpenAiResponse }> {
  const body: Record<string, unknown> = {
    model,
    messages: msgs.map(m => {
      const out: Record<string, unknown> = { role: m.role, content: m.content }
      if (m.tool_calls) out.tool_calls = m.tool_calls
      if (m.tool_call_id) out.tool_call_id = m.tool_call_id
      if (m.name) out.name = m.name
      return out
    }),
    [tokenParam]: maxTokens,
  }
  if (tools?.length) body.tools = tools

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${errText}`)
  }

  const data = (await res.json()) as OpenAiResponse
  const choice = data.choices?.[0]
  if (!choice) throw new Error('No choices in response')

  const text = choice.message.content ?? ''
  const toolCalls = (choice.message.tool_calls ?? []).map(tc => ({
    id: tc.id,
    name: tc.function.name,
    args: JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>,
  }))

  const finishReason = choice.finish_reason === 'tool_calls' ? 'tool_calls' as const
    : choice.finish_reason === 'length' ? 'length' as const
    : 'stop' as const

  return { text, toolCalls, finishReason, raw: data }
}

// ── Usage logging ────────────────────────────────────────────────────────
// Fire-and-forget insert so a logging hiccup never affects the caller.
// Neither Ollama nor Groq expose a usage-query API this app can call, so
// this local log is the only way to see real call volume / provider split
// (Settings > AI Usage reads it).
function logUsage(entry: {
  source: 'ollama' | 'groq' | 'gemini' | 'cerebras' | 'none'
  feature: string
  model: string | null
  usage: OpenAiUsage | null
  durationMs: number
  success: boolean
  errorMessage?: string
}) {
  const db = createServiceClient()
  db.from('ai_usage_log').insert({
    id: `ailog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: entry.source,
    feature: entry.feature,
    model: entry.model,
    prompt_tokens: entry.usage?.prompt_tokens ?? null,
    completion_tokens: entry.usage?.completion_tokens ?? null,
    total_tokens: entry.usage?.total_tokens ?? null,
    duration_ms: entry.durationMs,
    success: entry.success,
    error_message: entry.errorMessage ?? null,
  }).then(({ error }) => {
    if (error) console.error('[ai-client] Failed to log AI usage:', error)
  })
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function chatCompletion(opts: ChatOpts): Promise<AiResponse> {
  const msgs = buildMessages(opts.system, opts.messages)
  const openAiTools = opts.tools?.length ? toOpenAiTools(opts.tools) : undefined
  const maxTokens = opts.maxTokens ?? 4096
  const timeoutMs = opts.timeoutMs ?? 60_000
  const model = opts.fast ? groqFastModel() : groqChatModel()
  const feature = opts.feature ?? 'unlabeled'
  const startedAt = Date.now()
  const deadlineAt = opts.deadlineAt

  const anyConfigured = !!(process.env.OLLAMA_URL || groqKey() || geminiKey() || cerebrasKey())

  // Past the deadline: skip straight to the template rather than starting
  // (or continuing) a chain of provider attempts a caller's own wall-clock
  // budget has no way to interrupt once started.
  function pastDeadline(): boolean {
    return deadlineAt !== undefined && Date.now() >= deadlineAt
  }

  // 1. Try Ollama (only if explicitly configured — localhost won't work in production)
  if (process.env.OLLAMA_URL && !pastDeadline()) {
    try {
      const result = await callProvider(
        `${ollamaUrl()}/v1/chat/completions`,
        {},
        ollamaModel(),
        msgs,
        openAiTools,
        maxTokens,
        timeoutMs,
      )
      logUsage({ source: 'ollama', feature, model: ollamaModel(), usage: result.raw.usage ?? null, durationMs: Date.now() - startedAt, success: true })
      return { ...result, source: 'ollama' }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logUsage({ source: 'ollama', feature, model: ollamaModel(), usage: null, durationMs: Date.now() - startedAt, success: false, errorMessage: message })
      // Ollama unavailable, fall through to Groq
    }
  }

  // 2. Try Groq
  const groqApiKey = groqKey()
  if (groqApiKey && !pastDeadline()) {
    try {
      const result = await callProvider(
        'https://api.groq.com/openai/v1/chat/completions',
        { Authorization: `Bearer ${groqApiKey}` },
        model,
        msgs,
        openAiTools,
        maxTokens,
        timeoutMs,
      )
      logUsage({ source: 'groq', feature, model, usage: result.raw.usage ?? null, durationMs: Date.now() - startedAt, success: true })
      return { ...result, source: 'groq' }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[ai-client] Groq call failed, falling through:', err)
      logUsage({ source: 'groq', feature, model, usage: null, durationMs: Date.now() - startedAt, success: false, errorMessage: message })
    }
  }

  // 3. Try Gemini (free tier, OpenAI-compatible endpoint)
  const geminiApiKey = geminiKey()
  if (geminiApiKey && !pastDeadline()) {
    const geminiModelToUse = opts.fast ? geminiFastModel() : geminiModel()
    try {
      const result = await callProvider(
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        { Authorization: `Bearer ${geminiApiKey}` },
        geminiModelToUse,
        msgs,
        openAiTools,
        maxTokens,
        timeoutMs,
      )
      logUsage({ source: 'gemini', feature, model: geminiModelToUse, usage: result.raw.usage ?? null, durationMs: Date.now() - startedAt, success: true })
      return { ...result, source: 'gemini' }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[ai-client] Gemini call failed, falling through:', err)
      logUsage({ source: 'gemini', feature, model: geminiModelToUse, usage: null, durationMs: Date.now() - startedAt, success: false, errorMessage: message })
    }
  }

  // 4. Try Cerebras (free tier, OpenAI-compatible endpoint)
  const cerebrasApiKey = cerebrasKey()
  if (cerebrasApiKey && !pastDeadline()) {
    const cerebrasModel = opts.fast ? cerebrasFastModel() : cerebrasChatModel()
    try {
      const result = await callProvider(
        'https://api.cerebras.ai/v1/chat/completions',
        { Authorization: `Bearer ${cerebrasApiKey}` },
        cerebrasModel,
        msgs,
        openAiTools,
        maxTokens,
        timeoutMs,
        'max_completion_tokens',
      )
      logUsage({ source: 'cerebras', feature, model: cerebrasModel, usage: result.raw.usage ?? null, durationMs: Date.now() - startedAt, success: true })
      return { ...result, source: 'cerebras' }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[ai-client] Cerebras call failed, no fallback left:', err)
      logUsage({ source: 'cerebras', feature, model: cerebrasModel, usage: null, durationMs: Date.now() - startedAt, success: false, errorMessage: message })
    }
  }

  // 5. No provider configured, none reachable, or the deadline was hit
  //    before any tier got a chance to run.
  const noneReason = !anyConfigured ? 'No AI provider configured' : pastDeadline() ? 'Deadline exceeded before a provider succeeded' : undefined
  logUsage({ source: 'none', feature, model: null, usage: null, durationMs: Date.now() - startedAt, success: false, errorMessage: noneReason })
  return {
    text: '',
    toolCalls: [],
    finishReason: 'error',
    source: 'none',
  }
}

export function buildToolResultMessage(toolCallId: string, content: string, name?: string): AiMessage {
  return { role: 'tool', content, tool_call_id: toolCallId, name }
}

export function buildAssistantMessage(
  text: string | null,
  toolCalls?: AiToolCall[],
): AiMessage {
  return { role: 'assistant', content: text, tool_calls: toolCalls?.length ? toolCalls : undefined }
}

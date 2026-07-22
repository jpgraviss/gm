// Unified AI client — Ollama (local) → Groq (free cloud) → template fallback.
// Both providers use the OpenAI-compatible chat completions format.
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

// ── Types ───────────────────────────────────────────────────────────────────

export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: AiToolCall[]
  tool_call_id?: string
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
  source: 'ollama' | 'groq' | 'none'
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
): Promise<AiResponse & { raw: OpenAiResponse }> {
  const body: Record<string, unknown> = {
    model,
    messages: msgs.map(m => {
      const out: Record<string, unknown> = { role: m.role, content: m.content }
      if (m.tool_calls) out.tool_calls = m.tool_calls
      if (m.tool_call_id) out.tool_call_id = m.tool_call_id
      return out
    }),
    max_tokens: maxTokens,
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

  return { text, toolCalls, finishReason, source: 'ollama', raw: data }
}

// ── Usage logging ────────────────────────────────────────────────────────
// Fire-and-forget insert so a logging hiccup never affects the caller.
// Neither Ollama nor Groq expose a usage-query API this app can call, so
// this local log is the only way to see real call volume / provider split
// (Settings > AI Usage reads it).
function logUsage(entry: {
  source: 'ollama' | 'groq' | 'none'
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

  // 1. Try Ollama (only if explicitly configured — localhost won't work in production)
  if (process.env.OLLAMA_URL) {
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
    } catch {
      // Ollama unavailable, fall through to Groq
    }
  }

  // 2. Try Groq
  const key = groqKey()
  if (key) {
    try {
      const result = await callProvider(
        'https://api.groq.com/openai/v1/chat/completions',
        { Authorization: `Bearer ${key}` },
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
      console.error('[ai-client] Groq call failed, no fallback:', err)
      logUsage({ source: 'groq', feature, model, usage: null, durationMs: Date.now() - startedAt, success: false, errorMessage: message })
    }
  }

  // 3. No provider configured (or Ollama unavailable and no Groq key)
  logUsage({ source: 'none', feature, model: null, usage: null, durationMs: Date.now() - startedAt, success: false, errorMessage: key ? undefined : 'No AI provider configured' })
  return {
    text: '',
    toolCalls: [],
    finishReason: 'error',
    source: 'none',
  }
}

export function buildToolResultMessage(toolCallId: string, content: string): AiMessage {
  return { role: 'tool', content, tool_call_id: toolCallId }
}

export function buildAssistantMessage(
  text: string | null,
  toolCalls?: AiToolCall[],
): AiMessage {
  return { role: 'assistant', content: text, tool_calls: toolCalls?.length ? toolCalls : undefined }
}

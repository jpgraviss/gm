// DEPRECATED — AI provider config has moved to lib/ai-client.ts
// This file is kept only for backwards compatibility. All new code
// should import from '@/lib/ai-client' directly.

export function anthropicChatModel(): string {
  return process.env.GROQ_MODEL_CHAT || 'llama-3.3-70b-versatile'
}

export function anthropicInsightsModel(): string {
  return process.env.GROQ_MODEL_FAST || 'llama-3.1-8b-instant'
}

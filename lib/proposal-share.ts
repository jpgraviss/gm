import type { SupabaseClient } from '@supabase/supabase-js'

// Shared by app/api/proposals/[id]/share/route.ts (the original, explicit
// "generate a share link" action) and app/api/email/send-proposal/route.ts
// (the "mark as Sent" flow, AUDIT.md #153 — its CTA used to link to the bare
// app root instead of this public token viewer). Both need the exact same
// "reuse the existing token, mint one only if missing" behavior so that
// re-sending a proposal never orphans a link the client may have already
// bookmarked or mints a second live token for the same proposal.
export async function getOrCreateProposalToken(
  db: SupabaseClient,
  proposal: { id: string; token?: string | null }
): Promise<string> {
  if (proposal.token) return proposal.token

  const token = crypto.randomUUID()
  const { error } = await db.from('proposals').update({ token }).eq('id', proposal.id)
  if (error) throw new Error(error.message || 'Failed to generate proposal share token')
  return token
}

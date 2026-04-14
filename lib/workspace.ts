import { NextRequest } from 'next/server'

/**
 * The single default workspace for the current Graviss Marketing deployment.
 * When we flip to multi-tenant SaaS, this helper becomes the only thing that
 * needs to change — it will read from the JWT claim, subdomain, or cookie
 * instead of returning the hardcoded default.
 */
export const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Get the current workspace ID for a request. Currently always returns the
 * default Graviss workspace. Keep all query-scoping code flowing through this
 * helper so the multi-tenant migration is a one-function change.
 */
export function currentWorkspaceId(_req?: NextRequest): string {
  // Future: extract from JWT claim → workspace_members lookup → subdomain fallback
  return DEFAULT_WORKSPACE_ID
}

/**
 * Typed workspace tier. Used by feature-flags to decide what's unlocked.
 */
export type WorkspaceTier = 'starter' | 'pro' | 'agency' | 'agency_plus'

export interface Workspace {
  id: string
  name: string
  slug: string
  tier: WorkspaceTier
  logoUrl?: string
  primaryColor?: string
}

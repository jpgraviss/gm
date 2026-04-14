import type { WorkspaceTier } from './workspace'

/**
 * Features that can be gated behind a subscription tier.
 * When we flip to SaaS, each tier unlocks a superset of features.
 */
export type Feature =
  | 'crm'
  | 'pipeline'
  | 'proposals'
  | 'contracts'
  | 'projects'
  | 'time_tracking'
  | 'sequences'
  | 'tasks'
  | 'tickets'
  | 'client_portal'
  | 'reputation'
  | 'forms'
  | 'email_marketing'
  | 'social_scheduler'
  | 'unified_inbox'
  | 'funnels'
  | 'landing_pages'
  | 'lms'
  | 'sales_enablement'
  | 'ads_integration'
  | 'seo_tools'
  | 'white_label'
  | 'api_access'
  | 'mobile_app'
  | 'custom_reports'
  | 'advanced_automation'

const TIER_FEATURES: Record<WorkspaceTier, Feature[]> = {
  starter: [
    'crm',
    'pipeline',
    'proposals',
    'tasks',
  ],
  pro: [
    'crm',
    'pipeline',
    'proposals',
    'contracts',
    'projects',
    'time_tracking',
    'sequences',
    'tasks',
    'tickets',
  ],
  agency: [
    'crm',
    'pipeline',
    'proposals',
    'contracts',
    'projects',
    'time_tracking',
    'sequences',
    'tasks',
    'tickets',
    'client_portal',
    'reputation',
    'forms',
    'email_marketing',
    'social_scheduler',
    'unified_inbox',
    'seo_tools',
    'ads_integration',
    'sales_enablement',
    'advanced_automation',
  ],
  agency_plus: [
    'crm',
    'pipeline',
    'proposals',
    'contracts',
    'projects',
    'time_tracking',
    'sequences',
    'tasks',
    'tickets',
    'client_portal',
    'reputation',
    'forms',
    'email_marketing',
    'social_scheduler',
    'unified_inbox',
    'seo_tools',
    'ads_integration',
    'sales_enablement',
    'advanced_automation',
    'funnels',
    'landing_pages',
    'lms',
    'white_label',
    'api_access',
    'mobile_app',
    'custom_reports',
  ],
}

/**
 * Check if a given workspace tier has access to a feature.
 */
export function tierHasFeature(tier: WorkspaceTier, feature: Feature): boolean {
  return TIER_FEATURES[tier]?.includes(feature) ?? false
}

/**
 * Return all features for a tier (useful for client-side gating).
 */
export function featuresForTier(tier: WorkspaceTier): Feature[] {
  return TIER_FEATURES[tier] ?? []
}

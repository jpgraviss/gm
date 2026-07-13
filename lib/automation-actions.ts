// Shared by app/api/automations/route.ts and app/api/automations/[id]/route.ts.
// automations.actions is stored as jsonb: an array of {type, config}
// objects (AUDIT.md #12). Any caller — old or new — can still POST/PATCH
// bare action-label strings (e.g. components/crm/SequenceAutomateTab.tsx,
// which has no reason to ever need per-action config); this normalizes
// either shape to the one actually persisted, so no caller needs to change.
export function normalizeActionsForStorage(actions: unknown[]): { type: string; config: Record<string, unknown> }[] {
  return actions.map((a) =>
    typeof a === 'string'
      ? { type: a, config: {} }
      : { type: String((a as { type?: unknown })?.type ?? ''), config: (a as { config?: Record<string, unknown> })?.config ?? {} },
  )
}

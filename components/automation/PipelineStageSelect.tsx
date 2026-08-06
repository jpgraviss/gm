'use client'

import { useState, useEffect } from 'react'
import { DEFAULT_PIPELINES } from '@/lib/pipelines'

/**
 * Picks a real pipeline stage by name (AUDIT #516).
 *
 * Both stage dropdowns in the automation builder used to hardcode a list
 * that included 'Negotiation' — a stage that doesn't exist in this
 * codebase's pipeline. `app/crm/pipeline/page.tsx` groups deals strictly by
 * `d.stage === s.name`, so a deal auto-created on that stage disappeared
 * from the board entirely. #516 replaced the list with a live fetch of
 * `/api/pipelines`.
 *
 * Extracted here for two reasons. First, the fetch had no fallback: on a
 * network failure `stages` stayed `[]` and the `<select>` rendered with no
 * options at all, so the "Create Deal" action's stage field became an
 * unusable blank box — trading a wrong list for no list is not obviously the
 * better failure. Second, the behaviour that matters (never offer a stage
 * the board can't show) is worth testing, and a component that fetches on
 * mount can be tested here but not inside a 1,800-line page.
 *
 * `DEFAULT_PIPELINES` is the honest fallback: it is the same constant
 * `GET /api/pipelines` itself returns when an org has no custom pipelines
 * stored, so falling back to it can't invent a stage the server wouldn't
 * have offered.
 */

/** Stage names from the deal pipeline, matching the route's own preference order. */
export function stageNamesFrom(
  pipelines: Array<{ id: string; stages?: Array<{ name: string }> }>,
): string[] {
  const pipeline = pipelines.find(p => p.id === 'client-acquisition') ?? pipelines[0]
  return pipeline?.stages?.map(s => s.name) ?? []
}

const FALLBACK_STAGES = stageNamesFrom(DEFAULT_PIPELINES)

export interface PipelineStageSelectProps {
  value: string
  onChange: (stage: string) => void
  /** Adds a leading "Any stage" option — for filters, not for setting a stage. */
  includeAnyOption?: boolean
  className?: string
}

export default function PipelineStageSelect({
  value, onChange, includeAnyOption, className = 'cfg-input',
}: PipelineStageSelectProps) {
  // Seeded rather than empty, so the first paint (and any failed fetch) still
  // offers real stages instead of an empty box.
  const [stages, setStages] = useState<string[]>(FALLBACK_STAGES)

  useEffect(() => {
    let cancelled = false
    fetch('/api/pipelines')
      .then(r => r.ok ? r.json() : null)
      .then((data: Array<{ id: string; stages?: Array<{ name: string }> }> | null) => {
        if (cancelled || !Array.isArray(data)) return
        const names = stageNamesFrom(data)
        // An empty result means a misconfigured pipeline, not "no stages
        // exist" — keep the fallback rather than blanking the control.
        if (names.length > 0) setStages(names)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={className}>
      {includeAnyOption && <option value="">Any stage</option>}
      {stages.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}

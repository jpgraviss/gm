import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import PipelineStageSelect, { stageNamesFrom } from '@/components/automation/PipelineStageSelect'
import { DEFAULT_PIPELINES } from '@/lib/pipelines'

/**
 * AUDIT #516 coverage, and the second component test in this repo — see
 * `tests/components/revenue-split.test.tsx` for the pattern this follows.
 *
 * #516 was: the automation builder's stage dropdowns hardcoded a list
 * containing 'Negotiation', a stage this codebase's pipeline doesn't have.
 * `app/crm/pipeline/page.tsx` groups deals by `d.stage === s.name`, so a deal
 * auto-created on that stage vanished from the board. The fix replaced the
 * list with a live fetch — which introduced the opposite failure: no
 * fallback, so a failed fetch rendered a `<select>` with zero options.
 *
 * These cases pin down both ends: never offer a stage the board can't show,
 * and never offer nothing at all.
 */

const REAL_STAGES = ['Lead', 'Qualified', 'Proposal Sent', 'Contract Sent', 'Closed Won', 'Closed Lost']

function mockPipelines(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  }))
}

/**
 * Drains the fetch promise chain before asserting.
 *
 * Necessary, not ceremony: the component seeds its state with the fallback,
 * so `waitFor`/`findBy*` are satisfied by the FIRST render and never observe
 * what the response did. Mutation-testing caught that — removing the
 * empty-result guard left every assertion passing. A macrotask tick flushes
 * the whole `fetch().then().then()` chain, so the assertions below describe
 * the settled state rather than the initial one.
 */
async function settled() {
  await act(async () => { await new Promise(r => setTimeout(r, 0)) })
}

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('stageNamesFrom', () => {
  it('prefers client-acquisition, matching what GET /api/pipelines returns first', () => {
    // Order in the array must not decide which pipeline the deal stages come
    // from — the route stores whatever the org configured, in any order.
    expect(stageNamesFrom([
      { id: 'clients', stages: [{ name: 'Onboarding' }] },
      { id: 'client-acquisition', stages: [{ name: 'Lead' }] },
    ])).toEqual(['Lead'])
  })

  it('falls back to the first pipeline when there is no client-acquisition', () => {
    expect(stageNamesFrom([{ id: 'custom', stages: [{ name: 'Intake' }] }])).toEqual(['Intake'])
  })

  it('returns empty rather than throwing on a malformed pipeline', () => {
    expect(stageNamesFrom([{ id: 'client-acquisition' }])).toEqual([])
    expect(stageNamesFrom([])).toEqual([])
  })
})

describe('PipelineStageSelect', () => {
  it('offers the live stages once they load', async () => {
    const custom = ['Intake', 'Scoping', 'Won']
    mockPipelines([{ id: 'client-acquisition', stages: custom.map(name => ({ name })) }])
    render(<PipelineStageSelect value="Intake" onChange={() => {}} />)

    // Deliberately NOT the default stages: an org's own configured pipeline
    // must win. Asserting the defaults here would pass without the fetch
    // doing anything at all.
    await settled()
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(custom)
  })

  it('never offers a stage the pipeline board cannot display', async () => {
    // The actual #516 bug. 'Negotiation' was in the hardcoded list and in no
    // pipeline, so deals created on it disappeared from the Kanban.
    mockPipelines([{ id: 'client-acquisition', stages: REAL_STAGES.map(name => ({ name })) }])
    render(<PipelineStageSelect value="Lead" onChange={() => {}} />)

    await settled()
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
    expect(screen.queryByRole('option', { name: 'Negotiation' })).not.toBeInTheDocument()
  })

  it('still offers real stages when the fetch fails outright', async () => {
    // The regression the extraction was for: the pre-extraction version left
    // `stages` at [] here, rendering an empty, unusable dropdown.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<PipelineStageSelect value="Lead" onChange={() => {}} />)

    await settled()
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(REAL_STAGES)
  })

  it('keeps the fallback when the response is a non-2xx', async () => {
    mockPipelines(null, false)
    render(<PipelineStageSelect value="Lead" onChange={() => {}} />)
    await settled()
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(REAL_STAGES)
  })

  it('keeps the fallback when the pipeline config has no stages', async () => {
    // An empty array means someone deleted every stage, not that the concept
    // of stages went away. Blanking the control would make the action
    // unconfigurable with no way to recover from inside the builder.
    mockPipelines([{ id: 'client-acquisition', stages: [] }])
    render(<PipelineStageSelect value="Lead" onChange={() => {}} />)
    await settled()
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(REAL_STAGES)
  })

  it('adds "Any stage" only where a filter asked for it', async () => {
    mockPipelines([{ id: 'client-acquisition', stages: REAL_STAGES.map(name => ({ name })) }])
    const { rerender } = render(<PipelineStageSelect value="" onChange={() => {}} includeAnyOption />)
    await settled()
    expect(screen.getByRole('option', { name: 'Any stage' })).toBeInTheDocument()

    rerender(<PipelineStageSelect value="Lead" onChange={() => {}} />)
    // Setting a stage must not offer "" — an empty stage is the same
    // invisible-deal outcome as a nonexistent one.
    expect(screen.queryByRole('option', { name: 'Any stage' })).not.toBeInTheDocument()
  })

  it('uses the same constant the API route falls back to', () => {
    // Guards the fallback against drift: if DEFAULT_PIPELINES changes, the
    // component follows it rather than keeping its own stale copy — which is
    // exactly the failure #516 was.
    expect(stageNamesFrom(DEFAULT_PIPELINES)).toEqual(REAL_STAGES)
  })
})

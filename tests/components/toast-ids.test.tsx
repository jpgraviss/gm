import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastProvider, useToast } from '@/components/ui/Toast'

/**
 * AUDIT #779 — toasts raised in the same millisecond must not share an id.
 *
 * `addToast` used `Date.now()`, so several errors raised in one tick — a page
 * firing three requests on mount and failing them together, which is how this
 * was found on /intelligence — all got the same id. `removeToast` filters by
 * id, so dismissing any one of them removes *every* toast that shares it: the
 * user clicks the × on one message and the other errors disappear with it,
 * unread. The same applies to the 4s auto-dismiss timer.
 *
 * Picking an assertion that actually discriminates took two attempts. Simply
 * counting rendered toasts does not: React warns about the duplicate keys but
 * still renders all three on the initial pass, so that test passes against
 * the bug. Nor does "both are gone after 4s" — with identical ids they are
 * gone, just for the wrong reason. Dismissing *one* of a same-tick burst is
 * the case where correct and broken diverge visibly, so that is what these
 * assert. Both were checked by reverting the fix and confirming they fail.
 */

function Raiser({ messages }: { messages: string[] }) {
  const { toast } = useToast()
  return <button onClick={() => { for (const m of messages) toast(m) }}>raise</button>
}

/** Raises every message in a single tick, as a burst of failed requests does. */
function renderBurst(messages: string[]) {
  const { container } = render(
    <ToastProvider>
      <Raiser messages={messages} />
    </ToastProvider>,
  )
  act(() => { screen.getByText('raise').click() })
  return container
}

/** The × on each toast. */
function dismissButtons(container: HTMLElement) {
  return [...container.querySelectorAll('button')].filter(b => b.textContent === '')
}

describe('Toast (AUDIT #779)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('dismissing one toast of a same-tick burst leaves the others', () => {
    const container = renderBurst(['stats failed', 'visitors failed', 'companies failed'])
    expect(screen.getByText('stats failed')).toBeTruthy()
    expect(screen.getByText('visitors failed')).toBeTruthy()
    expect(screen.getByText('companies failed')).toBeTruthy()

    act(() => { dismissButtons(container)[0].click() })

    // The regression: shared ids make this remove all three at once.
    expect(screen.queryByText('stats failed')).toBeNull()
    expect(screen.queryByText('visitors failed')).toBeTruthy()
    expect(screen.queryByText('companies failed')).toBeTruthy()
  })

  it('survives a burst of identical messages', () => {
    // Same message text three times — a retry loop reporting the same
    // failure. Nothing but the id distinguishes them.
    const container = renderBurst(['Request failed', 'Request failed', 'Request failed'])
    expect(screen.getAllByText('Request failed')).toHaveLength(3)
    act(() => { dismissButtons(container)[0].click() })
    expect(screen.getAllByText('Request failed')).toHaveLength(2)
  })

  it('still auto-dismisses after 4s', () => {
    renderBurst(['temporary'])
    act(() => { vi.advanceTimersByTime(3900) })
    expect(screen.queryByText('temporary')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.queryByText('temporary')).toBeNull()
  })
})

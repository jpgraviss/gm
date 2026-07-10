---
name: audit
description: Run a thorough multi-agent audit of the GravHub codebase to find holes — incomplete features, fake/stub data presented as real, silent failures, and security gaps. Maintains AUDIT.md as a persistent, human-editable findings log across runs. Use when the user asks to "audit", "reaudit", "find holes", or "check what's broken" in the app.
---

# GravHub Audit

Finds features that *look* finished but silently don't work: stubs presented as real, config
that's collected but never used, UI that promises behavior the backend doesn't deliver, and
security/data-integrity gaps. Distinct from `/code-review` (reviews a diff) — this sweeps the
whole app or named modules regardless of recent changes.

Results live in `AUDIT.md` at the repo root. That file is the source of truth for what's known,
what's fixed, and what's intentionally deferred — read it first so you don't re-report things
already tracked, and update it (don't replace it) when you're done.

## When invoked

1. **Read `AUDIT.md` first.** Note what's already `Open`, `Fixed`, `Won't Fix`, or `Needs
   Decision` — don't re-discover known items from scratch, and don't silently drop existing rows
   when you rewrite the file.
2. **Scope the sweep.** Default to the whole app. If the user names an area ("audit the CRM",
   "recheck automations"), scope to that instead — smaller sweeps can use 1 agent, no need to
   fan out.
3. **Fan out with parallel agents**, each covering a disjoint set of modules — module lists rot
   fast, so re-derive them from the app's actual route tree (`app/*/page.tsx`,
   `app/api/*/route.ts`) rather than trusting a hardcoded list from a prior run. Split into
   groups of 3-6 related modules per agent so each agent can go deep rather than skim
   everything. A full-app sweep is typically 3-5 agents.
4. **Add one adversarial self-review agent** covering whatever changed most recently (check
   `git log --oneline -20` and `git diff` against the last few commits) — newly-written code is
   where regressions actually hide, and a dedicated pass catches things a "does this feature
   exist" sweep won't (stale React state, fail-open security checks, race conditions).
5. Each agent should, for every finding, report: **file path, one-line description, severity
   (High/Medium/Low), and what it verified as genuinely working** (so nothing gets falsely
   flagged next time). Tell agents explicitly to trace actual implementation code, not just
   grep for suspicious names — a route named `sendEmail` that really sends email is not a hole.

## Severity guide

- **High** — looks fully functional (real UI, real button, real-looking data) but silently does
  nothing, corrupts data, or is a live security/auth gap.
- **Medium** — partially works, degrades silently under a specific condition, or UI overstates
  what the backend actually does.
- **Low** — cosmetic, or a real gap with low practical impact.

## Updating AUDIT.md

- **Match by finding title**, not row position. If a new sweep re-finds something already
  tracked, don't duplicate it — leave the existing row (and its `Status`/`Notes`) untouched.
- **New findings** get a new row, next available `#`, in the right severity section.
- **Never silently mark something `Fixed`** unless you (or the user) actually made the fix in
  this session and verified it (type-check/build/test at minimum). If a finding looks resolved
  because the surrounding code changed, say so in `Notes` and ask before flipping the status.
- The **"Confirmed working"** section at the bottom exists so re-audits don't re-flag things —
  append newly-verified-working areas there instead of writing a paragraph in chat.

## Making changes to the audit

The user (or you, on request) can edit `AUDIT.md` directly at any time — it's a normal markdown
table, not generated output to be treated as read-only:
- Change `Status` (e.g. mark something `Won't Fix` if it's a deliberate product decision, not a
  bug).
- Edit `Notes` to record why, or link to a decision.
- Add rows by hand for anything noticed outside a formal audit run.
- Delete a row only if it was a false positive — otherwise prefer `Won't Fix` with a note, so
  the history of "we knew about this and chose not to fix it" isn't lost.

## After the sweep

Don't just report findings — this project's convention (see prior sessions) is to triage and
fix what's reasonable in the same pass:
1. Fix anything **High severity that's a quick, well-scoped, unambiguous bug fix** (wrong column
   name, missing auth check, stale closure, off-by-one) immediately — type-check, build, and run
   the test suite before committing.
2. For anything requiring a **schema change, new infrastructure, a paid third-party
   integration, or a product/cost decision** — do NOT build it unilaterally. Mark it `Needs
   Decision` in `AUDIT.md` with a one-line note on what the decision is, and surface it to the
   user explicitly rather than guessing.
3. Commit fixes with a clear message referencing what was broken and why, same as any other
   change in this repo (see recent commit history for the established message style).

# GravHub — Completion Assessment
**Last updated: August 5, 2026**
**Scope of this update:** full 8-lane feature-maturity audit (7 modules + a dedicated cross-module integration lane), at the user's request to fully understand the app, its direction, and what's left to finish it as an **internal tool for Graviss Marketing** — not a resellable SaaS product (see `STRATEGIC_ROADMAP.md` for why that direction was retired).

**Note on method:** this assessment does not re-run a bug hunt. `AUDIT.md` already tracks 700+ findings across ~10 full audit rounds, the large majority fixed — this document instead asks a different question per feature: *does this actually work well enough to run Graviss Marketing's real day-to-day agency operations on, right now, with ~30 real clients already in the system?* Findings reference the relevant `AUDIT.md` row number where one exists.

---

## The headline finding

**Individual modules are unusually mature — most things staff touch day-to-day genuinely work, not cosmetic.** But **the modules don't talk to each other as much as a single coherent system should.** Contract → Invoice has zero automated wiring. The Company page (the main "everything about this client" view) still filters Deals/Contracts/Invoices by company *name* instead of the real `company_id` link, and has no Invoices/Proposals/Tickets/Projects tabs. The way clients actually accept a proposal (the emailed link) doesn't auto-create a contract, even though a rarely-used internal button does. Delivery/Operations and Client Support can't trigger or be triggered by automations at all. The main dashboard is missing Projects, Tickets, Proposals, and Marketing entirely.

This is the #1 priority in `STRATEGIC_ROADMAP.md`'s new Phase 1, directly per the user's own direction: *"All of the features and services need to be connected to each other."*

---

## Module-by-module scoring

| Module | Maturity | Headline gap(s) |
|---|---|---|
| **CRM & Sales** (companies, contacts, pipeline/deals incl. line items, proposals, contracts, e-signature, duplicate detection, import) | **Strong** | Pipeline/forecast totals don't separate one-time vs. recurring line-item value; Revenue-by-Service still attributes a whole multi-service deal to one service (#719, Open); `NewProposalPanel` has no company picker (#721, Open) |
| **Finance & Billing** (invoicing, Stripe, MRR/ARR, renewals, Mercury) | **Moderate** | **No recurring/retainer invoice generation** — every monthly invoice for ~30 real contract clients must be manually recreated every period; no tax handling anywhere; renewal-quote math can inflate pricing up to 36x when no linked contract exists (#707, Open); this module complements a real bookkeeping tool, it cannot replace one (no chart of accounts/expense tracking/reconciliation) |
| **Operations & Delivery** (projects, tasks, calendar/booking, tickets, time tracking, maintenance) | **Moderate-Strong** | Client-facing delivery timeline is broken (#693, Open — staff-added deliverables never reach the client); no shared multi-staff team calendar; delivery workflow is single-instance per client (can't run a second one for a repeat/second engagement); no project budget/hours-estimate/dependency tracking; ticket reassignment has no UI once auto-routed |
| **Marketing & Automation** (automation engine, sequences, funnels, forms, social, reputation, rank tracker, chatbot) | **Moderate-Strong** | Social scheduling only actually posts to Google Business today — Facebook/Instagram/LinkedIn code is done but blocked on each platform's app review (a business process step, not an engineering gap); rank tracker has no real SERP data source and a permanently-empty Competitors tab; chatbot-captured leads never reach the CRM automatically; no SMS channel anywhere (confirmed) |
| **Client Portal & Communication** (client dashboard, billing, approvals/e-sign, tickets, courses, knowledge base, staff inbox) | **Strong**, with two real client-facing risks | **Sales Training has no client self-enrollment path (#710, Open, High)** — a client not individually pre-enrolled hits a raw error with no explanation; **Delivery Timeline's per-step detail panel is entirely dead (#693, Open, High)** — looks broken, not just incomplete, to any client who explores it; Insights tab will likely be empty for many of the freshly-imported 30 clients until their integrations are backfilled (a data-entry task, not a code gap) |
| **Admin, Settings, Auth & Security** (team/role management, 2FA, audit log, integrations, WordPress plugin, browser extension) | **Strong** | Security posture is genuinely above-average for an internal tool (real 2FA, IP allow-listing, encrypted-at-rest secrets, forgery-resistant audit trail) — but **there is no verified backup/disaster-recovery process**, only a manual, one-way JSON export button with no restore path; a few smaller `Needs Decision` items (#647 Gmail-privacy disclosure, #656 OAuth re-auth policy gap, #688 saved-filter ownership) |
| **Data, AI & Infrastructure** (dashboards, AI chat/insights, cron jobs, CI, schema/migrations) | **Strong feature-wise, real infra unknowns** | AI chat assistant, insights, and website-audit features are unusually well-engineered (real tool-calling, budget-bounded, grounded prompts, honest fallbacks) — but **Sentry error monitoring is fully code-complete and its production activation has never been confirmed**; **`app/api/cron/route.ts` (12 chained jobs, the single highest-blast-radius file in the app) has zero automated tests**; migration history (144 of 145 files) has no enforced apply order and no drift check against the live schema; rate limiting is in-memory (won't survive Vercel's multi-instance model) |
| **Cross-Module Integration** (does this behave as ONE system) | **The real gap — see below** | 8 ranked findings; see `STRATEGIC_ROADMAP.md` Phase 1 |

---

## Cross-module integration findings (traced with file:line evidence)

Ranked by real staff manual-re-entry/context-loss impact:

1. **Contract → Invoice: zero wiring, not even opt-in.** No "Create Invoice" automation action exists at all. All 3 real invoice-creation paths (CSV import, time-entry billing, maintenance renewal) never set `contract_id` — confirmed by the code's own comment in `app/contracts/page.tsx`: *"every invoice in the app is created with contract_id null."*
2. **Company Panel (the main "company 360" view) still filters Deals/Contracts/Invoices by exact company-name string, not `company_id`**, despite the FK existing and being populated elsewhere in the app — a rename or import-time typo silently drops records from that company's own page. The panel also has no Invoices/Proposals/Tickets/Projects tabs at all.
3. **The real client-facing proposal-acceptance path (the emailed link) does not auto-create a contract**, while the rarely-used internal "Mark Accepted" button does — most real wins today silently don't flow forward unless staff separately built a matching automation.
4. **Delivery/Operations cannot trigger or be triggered by automations at all.** The one project-related trigger (`project_launched`) is dead code with zero real callers.
5. **Client Portal/Support cannot trigger automations at all** — no ticket-created/replied trigger exists anywhere.
6. **The "unified" `crm_activities` timeline only receives email, sequence, and a handful of opt-in automation-logged entries** — Finance (invoices), Operations (projects), and Support (tickets) never write to it directly, so a company's Activity tab is really an email+proposal log wearing a "unified timeline" label.
7. **The main executive dashboard is missing Projects, Tickets, Proposals, and Marketing entirely** — only visible in separate `/reports` sub-pages.
8. **Mercury (bank feed) is disconnected from Invoices** — no reconciliation between real bank transactions and outstanding invoices, unlike the fully-wired Stripe path.

---

## What "finished" means from here

Given the confirmed direction (internal tool for Graviss Marketing, no deadline, general product maturity as the goal), "finished" is not a feature-count target — it's: **staff can run 100% of a real client's lifecycle (win → deliver → bill → renew) inside GravHub without re-typing the same information twice across modules, and nothing a real client sees looks broken.** See `STRATEGIC_ROADMAP.md` for the phased plan to get there.

---

## Retired from the prior version of this document

- **99% Functional / Tier-based "ALL DONE" scoring** (dated April 4, 2026) — superseded. That assessment predates ~500 of the ~700 findings now tracked in `AUDIT.md` and this full re-audit; treat it as historical record only, not current status.
- **Sentry DSN "not yet configured"** — the *code* is fully built (confirmed this pass: PII redaction, all 298 routes wrapped, source-map upload configured). Whether the DSN is actually set in the production Vercel environment is now the only open question — see Phase 0 below.
- **"RLS granularity" / "Rate Limiting"** — still real, still open (confirmed this pass, not stale), now tracked as Phase 0/4 items in `STRATEGIC_ROADMAP.md` rather than a vague "needs infra decisions" bucket.

## Tech stack (current)

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.1 (App Router) |
| Language | TypeScript 5.9.3 |
| Styling | Tailwind CSS v4 |
| Database | Supabase (Postgres) |
| Auth | Custom session + Google OAuth 2.0, email-OTP 2FA |
| Email | Resend API |
| PDF | jsPDF + headless Chromium (Playwright) for proposal rendering |
| Payments | Stripe Checkout |
| Calendar | Google Calendar API v3 |
| AI | Multi-provider fallback chain (Ollama → Groq → Gemini → Cerebras → static template), Anthropic Claude for the chat assistant |
| Error monitoring | Sentry (code-complete; production activation unverified) |
| Testing | Vitest, 78 test files / 446 passing tests |
| CI | GitHub Actions — typecheck, lint, test, build, WordPress-plugin-zip drift check |
| Integrations | Gmail, Google Drive, Google Calendar, Stripe, Mercury, Meta Ads, Google Ads/GSC/GA4, HubSpot (import), Google Business Profile |

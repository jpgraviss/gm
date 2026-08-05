# GravHub — Strategic Roadmap
**Last updated: August 5, 2026**
**Goal: finish GravHub as Graviss Marketing's own internal agency-management system.** This is not a resellable SaaS product — see "Retired direction" below.

Companion doc: `DEVELOPMENT_PLAN.md` has the full current-state assessment this roadmap is built from. `AUDIT.md` remains the bug/security findings tracker — this document is the feature/architecture roadmap.

---

## Retired direction

The prior version of this document (April 2026) was framed around competing with HubSpot/GoHighLevel and building GravHub into a multi-tenant SaaS product to resell to other agencies. **That direction is retired.** Confirmed with the user (2026-08-05): GravHub's purpose is to run Graviss Marketing's own agency operations, permanently single-tenant. This means, explicitly, none of the following are on this roadmap anymore:

- Multi-tenancy migration (`tenant_id`, workspaces, per-tenant RLS)
- Signup/invite flow for external agencies, subdomain/custom-domain-per-tenant routing
- Per-tenant Stripe subscription billing, usage quotas, white-labeling
- Feature-count parity chasing (voice AI receptionist, communities, affiliate manager, 1000+ templates, mobile apps, etc.) — build these only if Graviss's own team would actually use them, never for competitive optics

Everything below is scoped to: **make this the best possible internal tool for one agency's real day-to-day work.**

---

## Phase 0 — Data-safety guardrails
*Do this first. Real client contracts, invoices, and financial data for ~30 real clients are already live in this system.*

| # | Item | Why now |
|---|---|---|
| 0.1 | **Verify and document the actual backup/disaster-recovery story.** Confirm whether Supabase Point-in-Time Recovery is enabled on the production project and at what retention window; write a one-page restore runbook. The only current backup is a manual, one-way admin JSON export with no restore path. | No verified DR path for the business's real financial/contract data today |
| 0.2 | **Confirm `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_AUTH_TOKEN` are actually set in the production Vercel environment.** The code is fully built and correctly redacts PII — this is a one-time config checklist item, not engineering work. Until confirmed, every unhandled error across all 298 API routes is invisible with no alerting. | False sense of security if the team believes error monitoring is "on" when it may be silently no-op'd |
| 0.3 | **Add test coverage to `app/api/cron/route.ts`.** Zero tests exist today despite this being the single highest-blast-radius file in the app — 12 chained jobs (sequence emails, uptime alerting, rank tracking, scheduled broadcasts, review campaigns, recurring task spawning) that fail silently (try/catch-per-job, log-only) with nothing to catch a regression before it reaches production. | A silent regression here could break sequence sends, uptime alerting, and billing reminders simultaneously with no one noticing until a client does |
| 0.4 | **Formalize migration ordering.** 144 of 145 files in `supabase/migrations/` don't follow the standard timestamp-prefixed naming convention, so there's no enforced apply order and no CI check that `schema.sql` matches what's actually live. Doesn't need a full CLI-migration rebuild — at minimum, adopt timestamp prefixes going forward and add a lightweight CI check that flags drift. | Real risk of an un-rebuildable database and silent schema drift as the migration backlog keeps growing |

---

## Phase 1 — Connect the modules
*The user's explicit directive: "All of the features and services need to be connected to each other." This is the single highest-value phase — the app is already feature-rich; it needs to behave like one system.*

| # | Item | Detail |
|---|---|---|
| 1.1 | **Build a real "Create Invoice" automation action.** None exists today — `lib/automations-engine.ts` has no invoice-creation action type at all, so not even a hand-built automation can generate one. This unblocks recurring billing (Phase 3) and lets `Contract Fully Executed`/`Contract Sent` optionally spin up a first invoice automatically. |
| 1.2 | **Fix the Company Panel to use `company_id`, not company name, for Deals/Contracts/Invoices** (Contacts/Activity tabs already do this correctly — extend the same pattern). Add Invoices, Proposals, Tickets, and Projects as real tabs — today a company's invoices/tickets/projects are only small side-widgets, and proposals can be created from the panel but never viewed there. |
| 1.3 | **Fix the proposal-acceptance asymmetry.** The real path clients use — clicking Accept in the emailed link (`/api/proposals/view/[token]`) — only fires an automation trigger; a contract is created *only if* staff separately built a matching automation. The rarely-used internal "Mark Accepted" button auto-creates a contract directly. Ship a default seeded automation (or make the direct-creation behavior the default for both paths) so a real client acceptance always flows forward the same way. |
| 1.4 | **Give Delivery/Operations and Client Support real automation triggers.** Today neither module can trigger or be triggered by anything — `project_launched` exists in the trigger map but is dead code with zero real callers, and there's no ticket-created/replied trigger at all. Add real triggers for at minimum: project status change, task completion, ticket created, ticket replied. |
| 1.5 | **Make `crm_activities` genuinely unified.** Finance (invoice created/paid), Operations (project status change), and Support (ticket created/replied) currently never write to it directly — the company Activity tab is really just an email+proposal log. Add direct activity-log writes from those three modules so it lives up to its name. |
| 1.6 | **Expand the main dashboard (`app/page.tsx`) to include Projects, Tickets, Proposals, and Marketing.** Today it only queries deals/invoices/contracts/renewals — a company could have every ticket escalating and every project stalled and the exec dashboard would show nothing. The broader picture already exists across ~6 separate `/reports` sub-pages; at minimum, surface high-signal counts from those on the home dashboard too. |
| 1.7 | **Reconcile Mercury bank transactions against invoices.** Currently a fully disconnected read-only widget — no matching logic exists between a real bank transaction and an outstanding invoice, unlike the fully-wired Stripe path. Lower priority than 1.1–1.6, but a real ongoing manual-matching cost otherwise. |

---

## Phase 2 — Close client-facing embarrassment risks
*Two things a real Graviss Marketing client can hit today that would look outright broken, not just incomplete.*

| # | Item | AUDIT.md ref |
|---|---|---|
| 2.1 | **Build real client self-enrollment for Sales Training**, or bulk-enroll clients automatically when their company gets the Sales Training entitlement. Today a client not manually pre-enrolled course-by-course gets a raw, unexplained error trying to complete a quiz. | #710 (Open, High) |
| 2.2 | **Fix the Delivery Timeline's per-step detail panel.** `mapWorkflow()` never populates the `details`/deliverables fields the client-facing UI expects — every client who expands a step sees nothing, including deliverables staff believe they've already shared. This is the kind of gap that reads as "broken" rather than "missing" to a client. | #693 (Open, High) |
| 2.3 | **Wire chatbot-captured leads into the CRM.** A prospect can chat with the widget, give their name/email, and that lead sits only in the chatbot's own conversation list today — no automatic (or even a manual "Convert to Lead") path into `crm_contacts`. Straightforward given the automation engine already exists. | — |
| 2.4 | **Backfill integrations for the freshly-imported 30 real clients** (GSC/GA4/reputation/rank tracking) so the client portal's Insights tab isn't a blank state for most of them on first login. This is a data-entry/rollout task, not a code fix — flagging here so it's tracked as part of "finishing" the product experience. | — |

---

## Phase 3 — Recurring billing automation
*The single largest daily-operations gap found in Finance & Billing: nothing keeps invoices flowing from active retainer contracts without manual work every period.*

| # | Item |
|---|---|
| 3.1 | Build a cron job (alongside the existing `app/api/cron/route.ts` jobs) that generates a real invoice automatically for each active recurring `Contract` on its billing cadence, using the new "Create Invoice" action from Phase 1.1. |
| 3.2 | Same for `maintenance_records` — cancellation-fee invoicing already auto-generates correctly (AUDIT #467); regular month-to-month retainer billing off `nextBillingDate` still doesn't. |
| 3.3 | **Needs a decision, not a build**: does Graviss need real tax handling on invoices (sales tax field/rate/calculation)? Nothing exists today. Flag to the user before building — depends on real business/compliance requirements this document can't answer. |
| 3.4 | **Needs a decision**: is a real, numbered, line-itemized, tax-aware invoice PDF needed (vs. today's ad hoc "receipt" popup after payment)? Would also need a new document-template type (`TEMPLATE_TYPES` currently only supports proposal/contract/addendum). |

---

## Phase 4 — Marketing channel completion
*Mostly business-process steps, not engineering — flagged here so they're tracked as part of "finished," not lost.*

| # | Item | Type |
|---|---|---|
| 4.1 | Complete Facebook, Instagram, and LinkedIn app review. The publishing code for all three is already fully built and correct — they're gated behind each platform's own review process, not a missing feature. Google Business Profile already publishes live today. | Business process |
| 4.2 | **Needs a decision**: pay for a real SERP data source (e.g. DataForSEO, SerpApi) for the rank tracker. Today positions are GSC-derived only (different methodology than a true rank checker, requires the client's GSC connected, can't track a brand-new zero-traffic keyword), and the Competitors tab is permanently empty — `competitor_rank_snapshots` is never written by any code path. | Cost decision |
| 4.3 | **Needs a decision**: custom/branded domain support for the funnel/landing-page builder. Pages currently only live under GravHub's own app domain — fine for gated internal use, a real limitation if these are meant as public campaign pages for clients or for Graviss's own marketing. | Infra decision |

---

## Phase 5 — Polish & completeness
*Real, traced gaps that don't block daily work today but are worth closing as capacity allows. Roughly ordered by impact.*

| # | Item | AUDIT.md ref |
|---|---|---|
| 5.1 | Pipeline/forecast totals should separate one-time from recurring line-item value — as retainer deals get built with the new line-items editor, "Pipeline Value"/"Weighted Value" will otherwise overstate real cash flow. | — |
| 5.2 | Fix Revenue-by-Service reporting to split a multi-service deal's value across its real line items instead of attributing 100% to one service. | #719 (Open) |
| 5.3 | Fix the renewal-quoting sidebar's monthly/total math — can inflate a quoted renewal price by up to 36x when no linked `Contract` record exists (the common case, since `LogRenewalModal` never links one). | #707 (Open) |
| 5.4 | Add a manual ticket-reassignment control to the ticket detail panel — today assignment is set once at auto-routing and effectively frozen. | — |
| 5.5 | Add a real shared, multi-staff team calendar view — today each staff member only sees their own schedule. | — |
| 5.6 | `NewProposalPanel` needs a real company picker (`CompanySelect`), not a free-text field. | #721 (Open) |
| 5.7 | Add ownership scoping to saved filters/smart lists so one Team Member can't delete another's. | #688 (Needs Decision) |
| 5.8 | Resolve the Gmail-connect privacy-disclosure gap — staff aren't told connecting turns unread personal mail into org-visible tickets. | #647 (Needs Decision) |
| 5.9 | Resolve the OAuth 180-day re-auth policy inconsistency — Calendar/Drive/Gmail never actually get forced re-auth despite the code's own doc comment claiming they do. | #656 (Needs Decision) |
| 5.10 | Redis/Upstash-backed rate limiting to replace the current in-memory limiter (won't survive Vercel's multi-instance model) — lower urgency for a trusted internal team, but a real defense-in-depth gap. | — |
| 5.11 | Deeper project management (drag-drop status changes, budget/hours-estimate tracking, dependency/critical-path view) — explicitly optional; today's list/board/milestone view is functional, this would be a real upgrade, not a fix. | — |
| 5.12 | Make the delivery workflow repeatable per client (today it's a single fixed 8-step instance per client — can't run a second one for a repeat/second engagement without a schema change). | #693-adjacent |

---

## Recommended execution order

1. **Phase 0** — non-negotiable, do before anything else touches production data further.
2. **Phase 1** — the highest-leverage phase; directly answers "make the features connect to each other." Item 1.1 (Create Invoice action) also unblocks Phase 3.
3. **Phase 2** — quick, high-visibility fixes given real clients are already using the portal.
4. **Phase 3** — once 1.1 lands, the recurring-billing cron is a natural next step; items 3.3/3.4 need the user's input first.
5. **Phase 4** — mostly waiting on business-process/cost decisions, not blocked on other engineering work; can run in parallel with anything else.
6. **Phase 5** — ongoing polish, pick up opportunistically or in a dedicated pass once 0–3 are done.

Every `Needs Decision` item above will be raised via a direct question before being built, per this repo's established convention — none will be built unilaterally.

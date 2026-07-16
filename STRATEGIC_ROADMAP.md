# GravHub — Strategic Roadmap & Competitive Audit
**Date:** April 2026
**Goal:** Complete GravHub into a robust platform, competitive with HubSpot and GoHighLevel, ready to scale and resell as SaaS to other marketing agencies.

---

## 1. Current State Assessment

### Functional completeness: ~60%

| Module | Score | Notes |
|---|---|---|
| CRM (companies, contacts, deals) | 65% | Usable. Weak on AI insights, bulk ops, search, import. |
| Sales (proposals, contracts) | 70% | Full lifecycle works. Missing templates, counter-proposals, redlines. |
| Billing (invoices) | 100% | Native invoicing. No payment collection yet (Stripe planned). |
| Projects | 75% | Kanban works. No Gantt, budgets, or file attachments. |
| Communication (inbox, calendar, sequences, tickets) | 85% | Sequences execute with full delivery tracking (open/click/bounce/unsubscribe). Ticket routing rules implemented. No SMS yet. |
| Client Portal | 55% | Basic visibility. No approvals, chat, payments, file uploads. |
| Reporting | 65% | Built-in charts. No custom report builder or forecasting. |
| Automation engine | 95% | 28 actions implemented: email, task, deal, contract, project, notification, tags, field updates, sequences, flow control. |
| Admin & permissions | 90% | API middleware auth gate + RBAC enforcement on critical routes (export, bulk-delete, merge, import, storage, push, invites). |

### Critical production blockers (must fix before selling)

1. ~~QuickBooks sync~~ — Removed. Native invoicing in place.
2. ~~Automation actions are no-ops~~ — All 28 actions implemented and functional.
3. ~~RBAC not enforced~~ — Middleware auth + requireRole guards on critical routes.
4. ~~No payment processing~~ — Stripe Checkout integration shipped (B1): "Pay Now"/"Copy Payment Link" on invoices, webhook-driven paid-status updates.
5. ~~No real ticket routing rules~~ — Routing rules implemented (priority escalation, company rep matching, service-type unit assignment).
6. ~~Sequences lack tracking~~ — Full delivery tracking: open/click/bounce/unsubscribe via Resend webhooks.
7. ~~Dashboard queries load full tables~~ — All growing-table endpoints now cursor-paginated (100/page default) with frontend pages following the cursor to completion instead of truncating.

---

## 2. Competitive Gap Analysis

### What HubSpot has that we don't
- Custom objects and unlimited custom properties
- AI-powered lead scoring and predictive insights
- Email marketing (bulk sends, templates, A/B testing)
- Landing page builder
- Forms with progressive profiling
- Ads management (Google, Facebook, LinkedIn)
- Live chat and chatbots
- Knowledge base and customer portal
- Custom report builder with attribution
- Content CMS with blog, SEO, AI-assisted content
- Sandbox environments
- ~1,900+ app marketplace
- Mobile apps (iOS/Android)
- Playbooks and snippets libraries
- Multi-language content
- Call recording with AI transcription

### What GoHighLevel has that we don't (and is MORE critical for agency SaaS)
- **SaaS Mode + rebilling** — the single feature that defines this category
- **Unlimited sub-accounts** — one platform, many agency clients
- **Snapshots** — clone a full workspace template across clients
- **Unified conversations inbox** — SMS, email, FB, IG, WhatsApp, Google chat, TikTok in one view
- **Voice AI receptionist** — inbound calls answered by AI, books appointments
- **Funnels & websites builder** — no-code, drag-drop
- **Membership sites and courses**
- **Reputation management** — automated review requests, AI responses
- **Communities** (group discussions)
- **Affiliate manager**
- **Social media scheduler** (7 platforms)
- **Missed-call text-back automation**
- **Text-to-Pay**
- **Multiple calendar types** (round-robin, class/group, service calendars)
- **Twilio + Mailgun integration for SMS/email sending**
- **A2P 10DLC registration workflow**
- **Custom domains per tenant** (app.youragency.com)
- **White-labeled mobile app** (iOS/Android with tenant branding)
- **Wallet system + auto-recharge** for rebilling
- **1000+ industry templates** and 1000+ marketplace apps
- **Smart lists** (dynamic contact segments that auto-update)
- **AI Employee suite** (Conversation AI, Voice AI, Reviews AI, Content AI, Workflow AI)

### What we have that they don't (our edge)
- Purpose-built for marketing agency operations (proposal → contract → project → billing → renewal as a coherent flow)
- Structured addendum workflow with typed change fields
- Tight integration with Google Workspace (Gmail, Calendar, Drive)
- AI chat assistant with CRM tool-calling
- Cleaner, more modern UI

---

## 3. Prioritized Roadmap to Competitive Parity

### PHASE A — Fix what's broken (3 weeks)
Must-do before anything else. These are things we claim to have but don't actually work.

| # | Item | Effort |
|---|---|---|
| A1 | ~~Wire all automation actions~~ — **DONE.** 28 actions implemented. | ✅ |
| A2 | ~~QuickBooks sync~~ — **DONE.** Removed QB, native invoicing in place. | ✅ |
| A3 | ~~Enforce RBAC in API routes~~ — **DONE.** Middleware auth + requireRole on critical routes. | ✅ |
| A4 | ~~Sequence tracking~~ — **DONE.** Full delivery tracking via Resend webhooks. | ✅ |
| A5 | ~~Dashboard pagination~~ — **DONE.** All growing-table list endpoints (`crm_activities`, sequence enrollments, tracked keywords, reviews, tasks/tickets/projects/proposals, contracts) now cursor-paginated + frontend follows to completion via `fetchAllPages()`. | ✅ |
| A6 | ~~Ticket routing rules~~ — **DONE.** Priority escalation + company rep + service-type routing. | ✅ |
| A7 | ~~Contract template builder UI~~ — **DONE.** Full CRUD at `/admin/document-templates`, wired into Sidebar + Cmd+K. | ✅ |

### PHASE B — Core agency features we're missing (4 weeks)
Core features every agency CRM has that we don't.

| # | Item | Effort |
|---|---|---|
| B1 | ~~Stripe integration for client invoicing~~ — Checkout Session payment link + webhook, DONE. Card-on-file/auto-collect not built (Checkout is one-time payment per invoice, not a saved payment method) | 4 days |
| B2 | ~~Custom fields on contacts, companies, deals~~ — field-definition library (`/admin/custom-fields`) + jsonb storage, wired into display and edit views for all three entities, DONE. Edit-only for v1 (not on the create panels) | 4 days |
| B3 | ~~Smart lists~~ — saved filter criteria per list (contacts/companies/deals), re-applied against live data on click, DONE | 3 days |
| B4 | ~~Bulk operations~~ — bulk tag, bulk reassign, bulk delete on CRM lists DONE (contacts/companies/deals). Bulk email still missing (needs a send-path decision) | 3 days |
| B5 | ~~Email marketing builder~~ — real block-based drag-drop editor (`EmailBlockEditor`, react-beautiful-dnd), templates, 15-field audience filtering, A/B subject testing with winner tracking, real Resend sends. DONE (this roadmap entry was stale — already built) | 6 days |
| B6 | ~~Forms builder~~ — 14 field types incl. conditional logic + multi-step, real CRM/webhook/notification/confirmation wiring, embeddable iframe snippet. DONE (stale entry — already built) | 4 days |
| B7 | ~~Landing pages~~ — real block-based page builder (`app/funnels/editor`). DONE: quick-create drops straight into the editor on the auto-created first page; page reorder (funnels list) and block reorder (editor) are real drag-drop (`@hello-pangea/dnd`) instead of up/down buttons; pages are inline-renamable from the list, not just in the editor; single-page funnels render as a plain "Landing Page" (no "Step 1"/pipeline chrome) instead of looking like an unfinished funnel; editor has a page switcher so multi-page funnels don't require bouncing back to the list between pages. Custom domains still not built — needs a hosting/DNS decision, out of scope for this pass | 6 days |
| B8 | **SMS channel** — Twilio integration, bulk SMS, 2-way in unified inbox. Confirmed 100% missing (zero references anywhere in the codebase) — needs a Twilio account decision before building, not something to start unilaterally | 4 days |
| B9 | ~~Unified inbox~~ — merges tickets/sequences/broadcasts/CRM-activities/Gmail into one contact-keyed view. DONE. SMS merging blocked on B8 | 5 days |

### PHASE C — SaaS readiness for reselling (8 weeks)
This is the big one. Required before you can sell to another agency.

| # | Item | Effort |
|---|---|---|
| C1 | **Multi-tenancy migration** — add `tenant_id` to every table, rewrite RLS policies, add `workspaces` + `workspace_members` tables, inject tenant context into every query | 10 days |
| C2 | **Signup + invite flow** — public registration, workspace creation, email invites, JWT tenant claims | 5 days |
| C3 | **Subdomain routing** — `*.gravhub.com` resolves to tenant workspace via subdomain → workspace lookup | 3 days |
| C4 | **Custom domains per tenant** — `app.youragency.com` → Vercel domain attach API | 3 days |
| C5 | **Stripe subscription billing (for tenants)** — plan tiers, usage tracking, quota enforcement, webhook handling | 6 days |
| C6 | **Full white-label** — logo upload, favicon, email sender domain, brand colors, "Powered by" removal | 4 days |
| C7 | **Per-tenant rate limiting** — switch from IP-based to tenant-based in `proxy.ts` | 1 day |
| C8 | **Per-tenant encryption keys** — envelope encryption for OAuth tokens, derive per-tenant keys from master | 3 days |
| C9 | **Usage dashboard + quotas** — contacts/deals/API calls/storage tracked per tenant, enforced at write-time | 3 days |
| C10 | **Snapshots** — clone a workspace template to a new tenant (copy pipelines, sequences, templates) | 5 days |
| C11 | **Observability** — structured logging (pino), APM instrumentation, uptime monitoring, per-tenant dashboards | 3 days |

### PHASE D — HubSpot/GHL parity (6 weeks)
After we can sell, these close the gap with the big players.

| # | Item | Effort |
|---|---|---|
| D1 | **Advanced workflow engine** — if/else branching (done), wait-until-condition, goal events, generic webhook-trigger intake, custom code action. Partially done: `lib/automations-engine.ts` already has real Wait/Resume and a working If/Else with 5 operators; the remaining gap is a fixed-duration-only Wait (no condition-based wait), a hardcoded ~17-event `TRIGGER_MAP` (no generic webhook intake, no goal-event type), and no custom-code action | 5 days |
| D2 | ~~AI lead scoring~~ — `lib/ai/lead-scoring.ts`'s `scoreContact()` (real LLM call + weighted engagement/deal/activity score), wired end-to-end from `app/crm/contacts/page.tsx`. DONE — this roadmap entry was stale, already built | 4 days |
| D3 | **Custom report builder** — user-defined dimensions/metrics, save, schedule, email. Confirmed not built — only a dead `'custom_reports'` feature-flag string exists, no UI/API/schema | 6 days |
| D4 | ~~Attribution reporting~~ — source → deal → revenue tracking, UTM capture. DONE: `crm_contacts` now captures first-touch UTM params (source/medium/campaign/term/content + landing URL) at contact-creation time from both public funnels and the standalone Forms product; deals join through `contact_id` (also fixed `lib/automations-engine.ts`'s `Create Deal` action, which previously never set `contact_id`, silently breaking the join for every automation-created deal); new `/reports/attribution` page + `/api/reports/attribution` aggregation. Existing contacts predating this fix and manually-created/HubSpot-imported deals honestly show as "unattributed," not guessed at. GravIntel's separate visitor-tracking UTM capture (`gi_visitors`) was NOT wired to this — it's a different, pre-conversion signal (anonymous visits) vs. this feature's post-conversion signal (named contacts/deals); linking the two remains a future enhancement, not required for this to be useful today | 3 days |
| D5 | ~~Reputation management~~ — GBP integration, auto review request after invoice paid, public `/go/review/[token]` flow. DONE — this roadmap entry was stale, already built | 3 days |
| D6 | ~~Social media scheduler~~ — 6 real platform integrations (FB/IG/LinkedIn/X/GBP), scheduled dispatch cron. DONE — this roadmap entry was stale, already built | 5 days |
| D7 | **Client portal 2.0** — approvals, comments, file upload, payment button, progress view. Already fully built (`app/portal/**`: approvals, e-sign, billing, projects, SEO, services, tickets, delivery workflow timeline, help center — all correctly `requirePortalClient`-gated). The gap is reachability, not engineering: `AppShell.tsx` routes every real client session to a smaller single-page `/client` dashboard instead, so `/portal` is dead weight in practice (AUDIT #154). **Needs a product decision**: is `/client` the intentional replacement (trim/remove `/portal`), or should real clients be reconnected to the richer `/portal` build? | 5 days |
| D8 | ~~Knowledge base~~ — CRUD + portal-scoped visibility. DONE — this roadmap entry was stale, already built | 3 days |
| D9 | ~~Live chat widget~~ — embeddable widget (real LLM call, `public/chatbot.js` → `app/api/chatbots/[id]/chat`) was already built; DONE now that conversations with a captured visitor email also surface as a read-only source in the Unified Inbox (`app/api/inbox/unified/route.ts`) — there's no staff-reply path for chat, so this is visibility only, not a reply channel | 4 days |
| D10 | **Public API + webhooks** — REST API for external integrations, OAuth 2.0, rate limiting. Confirmed not built — no outward-facing API/key issuance exists for third parties (the WordPress plugin's static `X-GravHub-Key` and this session's `lib/extension-auth.ts` Bearer-token pattern are the closest prior art but both are single-purpose, not general-purpose). If pursued, `extension-auth.ts`'s hashed-token pattern is the best existing scaffold to generalize | 4 days |
| D11 | **Mobile apps** — React Native or Expo shell for iOS/Android (CRM, inbox, pipeline, notifications) | 10 days |

### PHASE E — AI & next-gen features (4 weeks)
These are the things that make people pick GHL over HubSpot today.

| # | Item | Effort |
|---|---|---|
| E1 | **Voice AI receptionist** — Twilio + Claude: inbound call, transcription, intent detection, calendar booking | 6 days |
| E2 | **Conversation AI** — auto-reply to SMS/chat/FB/IG with tool-calling to CRM | 4 days |
| E3 | **Content AI** — blog post / email / social post generation using Claude | 3 days |
| E4 | **AI Biz card scanner** — upload photo → extract contact fields via Claude vision | 2 days |
| E5 | **AI workflow action** — run Claude prompt as a step in automation with merge fields | 2 days |
| E6 | **Smart suggestions** — "This deal hasn't moved in 14 days, suggest action" via AI insights panel | 3 days |

---

## 4. Implementation Timeline

| Phase | Duration | Cumulative | What you get |
|---|---|---|---|
| **A** | 3 weeks | Week 3 | Production-ready for internal use |
| **B** | 4 weeks | Week 7 | Competitive with HubSpot Starter / GHL Starter |
| **C** | 8 weeks | Week 15 | Can sell to other agencies as SaaS |
| **D** | 6 weeks | Week 21 | Parity with HubSpot Pro / GHL Pro |
| **E** | 4 weeks | Week 25 | Market-leading AI features |

**Total: ~25 weeks (6 months) to be a credible HubSpot/GHL competitor.**

---

## 5. Recommended Execution Order

### Track 1 — Ship fixes immediately (weeks 1-3)
Phase A in full. After week 3, the platform is solid for your own agency to use day-to-day.

### Track 2 — Revenue-driving features (weeks 4-7)
Phase B. Adds the things clients will pay more for (email marketing, forms, landing pages, SMS).

### Track 3 — SaaS foundation (weeks 8-15)
Phase C. This is the big investment. If you're not 100% committed to reselling, skip this entirely and stay single-tenant.

### Track 4 — Competitive parity (weeks 16-25)
Phases D + E in parallel. Ship AI features alongside reporting and mobile to be a credible alternative.

---

## 6. Critical Architectural Decisions Needed

Before starting Phase C, you need to commit to answers for these:

1. **Multi-tenancy model:** schema-based (one Postgres per tenant) vs row-based (`tenant_id` column). **Recommendation:** row-based for simplicity, migrate to schema-based at 100+ tenants.

2. **Hosting model:** Vercel-only, or offer self-hosted Docker? **Recommendation:** Vercel-only until $1M ARR, then add self-hosted for enterprise.

3. **Sending infrastructure:** Resend (current) handles transactional well but bulk email at scale needs Mailgun/SendGrid. **Recommendation:** Keep Resend for transactional, add Mailgun for marketing broadcasts.

4. **Voice/SMS:** Twilio (flexible, expensive) vs LeadConnector/LC Phone (cheaper, less control). **Recommendation:** Twilio for flexibility.

5. **Pricing model:** Per-user seat, per-contact, or flat rate with tier limits? **Recommendation:** Flat tier with limits (Starter $99, Pro $299, Agency $999) + usage overage.

6. **Which features to build in-house vs embed:** Landing page builder is 6 days in-house or free via Unicorn Platform / Carrd white-label. **Recommendation:** Buy first, build second.

---

## 7. What to Cut / Not Build

To stay focused, these should NOT be priorities:

- ❌ Full Webflow-level page builder (too much work, low ROI)
- ❌ Knowledge base with multi-language (nice but not revenue-driving)
- ❌ Podcast hosting (outside scope)
- ❌ Ads management (complex, regulated — partner instead)
- ❌ On-prem self-hosted (until $1M+ ARR)
- ❌ Communities/forums (scope creep)
- ❌ Affiliate manager (until you have 50+ paying tenants)

---

## 8. Budget & Resources

This roadmap assumes **one senior full-stack engineer working full-time** (or two engineers at 50% utilization). At that pace:

- Phase A+B (7 weeks): Core platform done — you can use it
- Phase C (8 weeks): SaaS-ready — you can start selling
- Phase D+E (10 weeks): Competitive — you can charge premium pricing

**At one engineer, total time to full roadmap: ~25 weeks / 6 months.**
**At two engineers: ~13 weeks / 3 months.**
**With Claude Code acceleration: probably 40-50% faster on well-scoped tasks.**

---

## 9. Recommended Next Actions

1. **This week:** Execute Phase A completely. Lock down the broken pieces.
2. **Next week:** Decision meeting on Phase C commitment (SaaS or stay internal).
3. **Week 3:** Kick off Phase B based on that decision.
4. **Week 7:** Internal launch to your own agency — dogfood everything.
5. **Week 15:** Beta test SaaS with 3 friendly agencies (free for 3 months).
6. **Week 25:** Public launch.

---

## Appendix: Feature count comparison

| Platform | Feature count |
|---|---|
| HubSpot (all hubs) | ~130+ core features |
| GoHighLevel | ~181 features |
| GravHub (current) | ~85 functional features |
| GravHub (after Phase A) | ~100 |
| GravHub (after Phase B) | ~135 |
| GravHub (after Phase D+E) | ~200+ |

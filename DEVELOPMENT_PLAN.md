# GravHub — Master Development Plan
**Last updated: March 13, 2026**

---

## WHAT GRAVHUB IS

A marketing agency operating system for Graviss Marketing — one platform replacing
HubSpot, Calendly, spreadsheets, and paper contracts. Manages the full client
lifecycle: lead → proposal → contract → project delivery → invoicing → renewal,
plus internal ops (time tracking, tasks, tickets, team management).

---

## CURRENT STATUS: ~85% UI Complete, Build Clean

- `next build` passes with zero errors
- 22 page routes, 60+ API routes, 24 Supabase tables
- Deployed to app.gravissmarketing.com via Vercel

### Modules Complete
| Module | Status |
|--------|--------|
| CRM (Pipeline, Contacts, Companies, Sequences, CSV Import) | Done |
| Proposals (builder, approval workflow) | Done |
| Contracts (CRUD, addendums, signature tracking) | Done |
| Billing / Invoices (CRUD, QB sync, PDF receipts) | Done |
| Projects (Kanban, milestones) | Done |
| Tasks, Time Tracking, Maintenance, Renewals | Done |
| Tickets | Done |
| Reports (revenue, team metrics, CSV export) | Done |
| Gmail Inbox (OAuth, CRM activity logging) | Done |
| Calendar / Public Booking Page | Done |
| Client Portal (login, project view, billing history, support tickets) | Done |
| Admin Panel (users, roles, audit logs, impersonation) | Done |
| Settings, QuickBooks OAuth, Google SSO, AI Insights | Done |

### Recent Fixes (This Session)
- Team member login crash fixed (NULL `unit` field default)
- Pay Now buttons removed (QuickBooks is view-only, no invoicing in-app)
- Client portal Submit Request form wired to POST /api/tickets
- Security hardening (env vars, encrypted tokens, middleware auth)

### Pending User Actions (Supabase SQL Editor)
1. Run indexes SQL migration
2. `UPDATE public.team_members SET unit = 'Delivery/Operations' WHERE unit IS NULL;`
3. Merge `claude/review-gravhub-chat-SbH9g` branch to main

---

## CRITICAL GAPS — What's Missing for Production

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| 1 | **No outbound email to clients** | "Send Proposal/Invoice/Contract" buttons exist but fire nothing | Medium |
| 2 | **Booking confirmations incomplete** | No email sent, no Google Meet link shown | Light |
| 3 | **Time tracking → invoice conversion missing** | Billable hours are orphaned, can't bill for them | Medium |
| 4 | **Automation engine never executes** | Rules saved to DB but zero execution logic | Heavy |
| 5 | **No e-signature** | Contracts/proposals are metadata only | Heavy (3rd party) |
| 6 | **No document/file storage** | No actual PDFs attached to anything | Medium |

### Design Decisions Already Made
- **QuickBooks = view-only** — No write-back, no payment processing in this app
- **No Stripe** — Invoicing/payment does not happen in this software
- **No Pay Now buttons** — Removed from client portal
- **Billing tab kept** — Shows invoice history from QuickBooks (read-only)

---

## BUILD ORDER (Prioritized Implementation Plan)

### Phase 1: Outbound Email (No Blockers)
**Goal:** Make "Send" buttons actually send emails to clients.

**New files to create:**
- `app/api/email/proposal/route.ts` — Send proposal to client via Resend
- `app/api/email/invoice/route.ts` — Send invoice notification
- `app/api/email/contract/route.ts` — Send contract for review

**Files to modify:**
- `app/proposals/page.tsx` — Wire "Send" button to POST `/api/email/proposal`
- `app/billing/page.tsx` — Wire send action to POST `/api/email/invoice`
- `app/contracts/page.tsx` — Wire send action to POST `/api/email/contract`

**Pattern:** Each route takes `{ to, subject, templateData }`, renders HTML, sends via Resend SDK.

**Env vars needed:** `RESEND_API_KEY` (already referenced in code)

---

### Phase 2: Booking Confirmations (Mostly Done, 2 Fixes)
**Goal:** Complete the booking flow with email + Meet link.

**Files to modify:**
- `app/api/bookings/route.ts` — Add Resend email to team after booking created
- `app/book/[slug]/page.tsx` — Display Google Meet link on confirmation screen

---

### Phase 3: Time → Invoice Conversion
**Goal:** Let billable hours flow into invoices.

**DB change:** Add `invoiced` boolean column to `time_entries` table

**New files:**
- `app/api/time-entries/billable-summary/route.ts` — Aggregate unbilled hours by client

**Files to modify:**
- `app/billing/page.tsx` — Add "Create Invoice from Time Entries" panel
- `app/time-tracking/page.tsx` — Show invoiced/uninvoiced status per entry

---

### Phase 4: Automation Execution Engine
**Goal:** Make saved automation rules actually fire.

**New files:**
- `lib/automations-engine.ts` — Core `fireAutomations(event, data)` function
  - Reads rules from `automations` table
  - Matches event type + conditions
  - Executes actions (send email, update status, create task, etc.)

**Files to modify (inject trigger hooks):**
- `app/api/proposals/[id]/route.ts` — Fire on status change
- `app/api/contracts/[id]/route.ts` — Fire on status change
- `app/api/invoices/[id]/route.ts` — Fire on status change
- `app/api/deals/[id]/route.ts` — Fire on stage change
- `app/api/crm/contacts/route.ts` — Fire on contact created

---

### Phase 5: Error Handling & UX Polish
**Goal:** Replace silent failures with visible feedback.

- Create toast notification component
- Replace ~25 `.catch(() => {})` blocks with user-visible error messages
- Add loading skeletons to dashboard and high-traffic pages

---

### Phase 6: Security Hardening (Before Public Launch)
**Goal:** Defense in depth.

- Add RLS policies to all Supabase tables
- Verify `TOKEN_ENCRYPTION_KEY` is set in Vercel production
- Set up Sentry error monitoring
- Input validation audit on all POST/PUT API routes

---

### Phase 7: Future / Nice-to-Have
| Feature | Notes |
|---------|-------|
| E-signature (HelloSign/Dropbox Sign) | 3rd party integration, heavy lift |
| Document storage (Supabase Storage) | For contracts, proposals as PDFs |
| Client portal proposal view/acceptance | Portal currently read-only for projects/invoices |
| Global search | Cross-module search |
| Bulk actions | Multi-select in CRM, tickets |
| Task dependencies | Project management enhancement |
| 2FA | Security enhancement |
| Branding/theming from settings | Settings UI exists but doesn't apply |

---

## KEY FILES REFERENCE

| Area | Files |
|------|-------|
| Auth | `contexts/AuthContext.tsx`, `middleware.ts`, `app/login/page.tsx` |
| Layout | `components/layout/AppShell.tsx`, `components/layout/Sidebar.tsx` |
| Client Portal | `app/client/page.tsx`, `app/portal/page.tsx` |
| API Routes | `app/api/` (60+ routes) |
| DB Schema | `supabase/migrations/*.sql` |
| Config | `.env.local`, `next.config.ts`, `package.json` |
| Types | `lib/types.ts` |
| Supabase | `lib/supabase.ts`, `lib/encryption.ts` |
| QuickBooks | `app/api/quickbooks/` (view-only) |
| AI Insights | `app/api/ai/insights/route.ts` |
| Email | `app/api/email/` (invite, forgot-password, portal-invite exist) |

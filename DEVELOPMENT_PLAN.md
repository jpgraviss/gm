# GravHub — Master Development Plan
**Last updated: March 13, 2026**

---

## WHAT GRAVHUB IS

A marketing agency operating system for Graviss Marketing — one platform replacing
HubSpot, Calendly, spreadsheets, and paper contracts. Manages the full client
lifecycle: lead → proposal → contract → project delivery → invoicing → renewal,
plus internal ops (time tracking, tasks, tickets, team management).

---

## CURRENT STATUS: ~95% Complete, Build Clean

### Completed Phases
- **Phase 1** — Outbound email for proposals & contracts (Resend integration)
- **Phase 2** — Automation execution engine (12 triggers, 18 actions, hooks in 5 API routes)
- **Phase 3** — Time tracking → invoice conversion (billable summary, create invoice from hours)
- **Phase 3.5** — File storage (Supabase Storage upload/download in client portal)
- **Phase 4** — Toast notification system (global provider, useToast hook)

### Design Constraints (Firm)
- QuickBooks = view-only. No write-back, no payment processing.
- No Stripe / no payment processing at all.
- Billing is read-only from QuickBooks.

### Pending User Actions (Supabase)
1. ~~Run indexes SQL migration~~ DONE
2. ~~Fix NULL units~~ DONE
3. **Run time entries migration:**
   ```sql
   ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS invoiced boolean DEFAULT false;
   ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS invoice_id text;
   ```
4. **Create `client-files` Storage bucket** in Supabase dashboard
5. Merge `claude/review-gravhub-chat-SbH9g` to main

---

## REMAINING WORK

### High Priority
- Replace ~25 `.catch(() => {})` blocks with `useToast()` calls across all pages
- Add loading skeletons to dashboard, CRM, projects, tasks pages

### Security (Before Public Launch)
- Add RLS policies to all Supabase tables
- Verify `TOKEN_ENCRYPTION_KEY` is set in Vercel production
- Set up Sentry error monitoring
- Input validation audit on all POST/PUT routes

### Future / Nice-to-Have
- E-signature integration (HelloSign/DocuSign)
- Client portal proposal view/acceptance
- Branding/theming from settings
- Global search, bulk actions, task dependencies, 2FA

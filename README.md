# GravHub — Graviss Marketing Operating System

The internal business operating system for Graviss Marketing. Built with Next.js 16, Supabase, and Google Calendar — deployable to `app.gravissmarketing.com`.

---

## What It Does

GravHub replaces disconnected tools (HubSpot, spreadsheets, Calendly, paper contracts) with a single internal platform purpose-built for a marketing agency.

### Modules

| Module | Path | Description |
|---|---|---|
| **Dashboard** | `/` | KPI overview — MRR, pipeline, active contracts, recent activity |
| **Calendar** | `/calendar` | Booking dashboard — view, manage, and cancel client calls |
| **Tasks** | `/tasks` | Cross-department task management with priorities and due dates |
| **Time Tracking** | `/time-tracking` | Weekly time log per team member — billable vs. non-billable |
| **CRM — Pipeline** | `/crm/pipeline` | Drag-and-drop deal stages (Lead → Closed Won) |
| **CRM — Companies** | `/crm/companies` | Company profiles with deal history and contacts |
| **CRM — Contacts** | `/crm/contacts` | Contact records with notes, tasks, and activity timeline |
| **CRM — Sequences** | `/crm/sequences` | Email drip sequences and automation |
| **Inbox** | `/inbox` | Gmail integration — read and log emails as CRM activities |
| **Proposals** | `/proposals` | Build proposals with line items, approval workflow, PDF export |
| **Contracts** | `/contracts` | Contract management, e-signature tracking, addendums |
| **Billing** | `/billing` | Invoice creation, tracking, and payment status |
| **Projects** | `/projects` | Project boards with milestones, tasks, and team assignments |
| **Maintenance** | `/maintenance` | Recurring maintenance agreements and billing |
| **Renewals** | `/renewals` | Contract renewal pipeline with expiry tracking |
| **Client Portal** | `/portal` | Client-facing view of project status, files, invoices |
| **Tickets** | `/tickets` | Client support ticket tracking |
| **Reports** | `/reports` | Revenue charts, MRR, pipeline value, team metrics |
| **Automation** | `/automation` | Workflow automation rules |
| **Admin Panel** | `/admin` | User management, invite, role assignment |
| **Settings** | `/settings` | Company config, branding, integrations, permissions |
| **Calendar Settings** | `/settings/calendar` | Google Calendar OAuth, availability config, booking link |

---

## Booking System

Each team member can have a public booking link that clients use to schedule calls — no Calendly needed.

### Flow
1. Go to `/settings/calendar` → Connect Google Calendar
2. Set your availability (days, hours, timezone, duration)
3. Your link is generated: `app.gravissmarketing.com/book/your-name`
4. Client visits the link, picks a date and time, fills in their info
5. A Google Calendar event is created with a **Google Meet link**
6. Both host and client receive a calendar invite and confirmation email

### Features
- Real-time availability — checks Google Calendar for conflicts before showing slots
- Buffer time between meetings configurable per user
- Race condition protection — double-bookings prevented at the API level
- Confirmation email sent via Resend with the Meet link
- Internal dashboard at `/calendar` to view, manage, and cancel bookings

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Database | Supabase (Postgres) |
| Auth | Custom session + Google SSO |
| Email | Resend |
| PDF | jsPDF (native vector — no html2canvas) |
| Calendar | Google Calendar API v3 |
| AI | Anthropic Claude (AI Insights in CRM) |
| Drag & Drop | @hello-pangea/dnd |
| Icons | Lucide React |

---

## Deployment

### 1. Supabase — Run SQL schemas (in order)

In your Supabase project → SQL Editor:

```
supabase/schema.sql          ← core tables (proposals, contracts, CRM, etc.)
supabase/schema_calendar.sql ← calendar_settings + bookings tables
```

### 2. Vercel — Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Resend (transactional email)
RESEND_API_KEY=re_your_key_here

# Anthropic (AI insights in CRM)
ANTHROPIC_API_KEY=sk-ant-your_key_here

# Google Calendar OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://app.gravissmarketing.com/api/calendar/callback
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### 3. Google Cloud Console — Calendar OAuth Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or use existing)
3. Enable **Google Calendar API**
4. Create **OAuth 2.0 Credentials** → Web application
5. Add authorized redirect URI:
   ```
   https://app.gravissmarketing.com/api/calendar/callback
   ```
6. Copy Client ID and Client Secret into Vercel env vars

### 4. First Login After Deploy

1. Visit `app.gravissmarketing.com/login`
2. Log in with your admin credentials
3. Go to **Settings → Calendar**
4. Click **Connect Google Calendar** and authorize
5. Set your availability and copy your booking link

---

## Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local
# Fill in your values in .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
app/
├── (auth)/login/              # Login page
├── api/
│   ├── bookings/              # Booking CRUD + cancellation
│   ├── calendar/              # OAuth flow, slot calculator, settings
│   ├── contracts/             # Contract CRUD
│   ├── crm/                   # CRM companies + contacts
│   ├── email/                 # Resend transactional emails
│   ├── gmail/                 # Gmail API integration
│   ├── proposals/             # Proposal CRUD
│   └── time-entries/          # Time tracking CRUD
├── book/[slug]/               # Public booking page (no auth required)
├── calendar/                  # Internal bookings dashboard
├── contracts/                 # Contract management
├── crm/                       # CRM sub-pages
├── proposals/                 # Proposal management
├── settings/calendar/         # Calendar + Google auth settings
├── time-tracking/             # Weekly time log
└── ...                        # All other modules

components/
├── crm/                       # ProposalBuilderPanel, ContractPanel, etc.
└── layout/                    # AppShell, Sidebar, Header

lib/
├── google-calendar.ts         # Google Calendar OAuth + API helpers
├── supabase.ts                # Supabase client (lazy-init, throws if env vars missing)
├── types.ts                   # All TypeScript interfaces
└── utils.ts                   # formatCurrency, formatDate, color maps

supabase/
├── schema.sql                 # Core 12-table schema
└── schema_calendar.sql        # Calendar + bookings tables
```

---

## API Routes

### Calendar & Bookings
| Method | Route | Description |
|---|---|---|
| `POST` | `/api/calendar/auth` | Start Google OAuth — returns redirect URL |
| `GET` | `/api/calendar/callback` | Handle OAuth callback, store tokens |
| `GET/POST` | `/api/calendar/settings` | Get or save calendar config by email |
| `GET` | `/api/calendar/settings/[slug]` | Public: get calendar info by slug |
| `GET` | `/api/calendar/slots` | Get available time slots for a date |
| `GET/POST` | `/api/bookings` | List or create bookings |
| `PATCH` | `/api/bookings/[id]` | Cancel or update a booking |

### Core Data
| Method | Route | Description |
|---|---|---|
| `GET/POST` | `/api/proposals` | List or create proposals |
| `PATCH/DELETE` | `/api/proposals/[id]` | Update or delete proposal |
| `GET/POST` | `/api/contracts` | List or create contracts |
| `PATCH/DELETE` | `/api/contracts/[id]` | Update or delete contract |
| `GET/POST` | `/api/time-entries` | List or log time entries |
| `PATCH/DELETE` | `/api/time-entries/[id]` | Edit or delete time entry |
| `GET/POST` | `/api/crm/companies` | CRM company list or create |
| `GET/POST` | `/api/crm/contacts` | CRM contact list or create |

---

## Notes

- **Supabase is required to run** — API routes connect to Postgres via the service-role key and will throw if env vars are missing. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` before booting the app.
- **Google Calendar not required** — booking system works without it; slots are calculated from existing bookings in Supabase only (no Google free/busy check).
- **Public routes** — `/book/*` and `/login` are the only routes that don't require authentication.
- **PDF generation** uses jsPDF's native vector API (not html2canvas), producing crisp PDFs at any zoom level.

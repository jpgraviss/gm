import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/wordpress/plugin/download': ['./wordpress/gravhub-seo/**/*'],
    // lib/proposal-template.ts reads these fonts via readFileSync/path.join
    // at render time, not a static import, so Next's tracer can't discover
    // them on its own — every route that can reach the proposal-generation
    // pipeline needs them explicitly included in its serverless bundle.
    // AUDIT — this list previously missed /api/ai/chat (the AI Assistant's
    // write_proposal tool calls generateProposal() too) and /api/cron
    // (Generate Proposal automations resuming from a paused Wait step run
    // through the cron route) — both would ENOENT on the font read in
    // production despite working fine in this dev sandbox.
    '/api/proposals/generate': ['./lib/proposal-template/fonts/**/*'],
    '/api/forms/public/[slug]': ['./lib/proposal-template/fonts/**/*'],
    '/api/forms/public/funnel-submit': ['./lib/proposal-template/fonts/**/*'],
    '/api/ai/chat': ['./lib/proposal-template/fonts/**/*'],
    '/api/cron': ['./lib/proposal-template/fonts/**/*'],
  },
  experimental: {
    turbopackUseSystemTlsCerts: true,
  },
  // AUDIT #154 / Batch 5 (final) of the /portal → /client merge — app/portal/**
  // is deleted except app/portal/setup/** and app/portal/auth/verify/** (the
  // pre-login onboarding flow, explicitly out of scope for this whole merge
  // — neither is listed below, so both keep being served normally by their
  // still-live page files; no rule here uses a /portal/:path* catch-all that
  // could accidentally swallow them).
  //
  // Per-user decision: old /portal/* URLs redirect to their real /client
  // equivalent rather than 404ing, so a stale bookmark or an old
  // notification/email link still lands somewhere real. Every route below
  // maps to real, currently-shipping content — nothing here is invented.
  //
  // Role-aware routing note: this table can't inspect the caller's session
  // (redirects run before any app/auth code executes), so every rule below
  // sends everyone — client or staff — to the client-facing /client
  // destination. That's correct for the actual client-facing pages, and
  // AppShell already lets staff browse into /client/* freely (needed for
  // its own "View as Client" preview — see lib/useClientCompany.tsx), so a
  // staff member hitting one of these old links doesn't 404, they just land
  // on /client without a company selected. Staff looking for the real admin
  // tool should use Sidebar's "Portal" link → /admin/portal-management,
  // which isn't part of this deleted tree and needs no redirect.
  async redirects() {
    return [
      // Per-service pages — three have real 1:1 destinations in
      // app/client/services/[slug]/page.tsx's REAL_SERVICE_NAMES (web-design,
      // social-media, sales-training); SEO has its own fuller top-level
      // /client/seo route (matches app/client/services/[slug]/page.tsx's own
      // redirect for the 'seo' slug). The rest — PPC, Email Marketing,
      // Content Creation, Marketing Strategy — are confirmed dead/no real
      // backing data or (Email Marketing) deliberately not ported at all
      // (cross-tenant leak risk via /api/broadcasts with no company column),
      // so they fall back to the Services hub via the :slug catch-all below,
      // same as any other/unrecognized slug.
      { source: '/portal/services/seo',            destination: '/client/seo',                      permanent: false },
      { source: '/portal/services/web-design',      destination: '/client/services/web-design',      permanent: false },
      { source: '/portal/services/social-media',    destination: '/client/services/social-media',    permanent: false },
      { source: '/portal/services/sales-training',  destination: '/client/services/sales-training',  permanent: false },
      { source: '/portal/services/:slug',           destination: '/client/services',                 permanent: false },
      { source: '/portal/services',                 destination: '/client/services',                 permanent: false },

      { source: '/portal/agreement',  destination: '/client/agreement', permanent: false },
      { source: '/portal/approvals',  destination: '/client/approvals', permanent: false },
      { source: '/portal/help',       destination: '/client/help',      permanent: false },
      { source: '/portal/seo',        destination: '/client/seo',       permanent: false },
      { source: '/portal/workflow',   destination: '/client/workflow',  permanent: false },

      // Folded into app/client/page.tsx's Insights tab / existing tabs —
      // no direct route equivalent, no query-param-driven tab selection
      // exists to deep-link into one, so these land on the plain dashboard.
      { source: '/portal/reports',  destination: '/client', permanent: false },
      { source: '/portal/billing',  destination: '/client', permanent: false },
      { source: '/portal/projects', destination: '/client', permanent: false },
      { source: '/portal/tickets',  destination: '/client', permanent: false },

      // /portal/preview?company=X was a real, actively-used staff capability
      // (the "View as Client" preview launched from
      // app/admin/portal-management's company cards) — not dead/dev-only.
      // Its ?company= query string is passed through automatically (Next.js
      // forwards the incoming query on a redirect whose destination doesn't
      // define its own), landing exactly on the rebuilt preview mechanism in
      // lib/useClientCompany.tsx with the same company preselected.
      { source: '/portal/preview', destination: '/client', permanent: false },

      // Root — /portal itself (exact only; /portal/setup and
      // /portal/auth/verify are separate literal sources above/absent, so
      // this doesn't touch them).
      { source: '/portal', destination: '/client', permanent: false },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co https://api.resend.com https://oauth2.googleapis.com https://www.googleapis.com https://api.groq.com https://accounts.google.com https://*.sentry.io",
              "frame-src https://accounts.google.com",
            ].join('; '),
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/(icon-192|icon-512|favicon)\\.(png|ico)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, immutable' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ]
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry organization and project (set via env vars)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only upload source maps in CI/production builds
  silent: !process.env.CI,

  // Disable Sentry build-time features when DSN is not set
  disableLogger: true,
});

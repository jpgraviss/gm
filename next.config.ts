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

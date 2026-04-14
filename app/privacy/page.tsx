export const metadata = {
  title: 'Privacy Policy — GravHub',
  description: 'Privacy policy for GravHub by Graviss Marketing',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: April 13, 2026</p>

      <section className="flex flex-col gap-4 text-sm leading-relaxed">
        <p>
          Graviss Marketing (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates GravHub, a business
          operations platform hosted at <strong>app.gravissmarketing.com</strong>. This Privacy Policy explains
          what information we collect, how we use it, and the rights you have over your data.
        </p>

        <h2 className="text-xl font-bold mt-6">1. Information we collect</h2>
        <p>When you use GravHub, we collect:</p>
        <ul className="list-disc pl-6 flex flex-col gap-1">
          <li><strong>Account information</strong> — name, email address, role, and company affiliation.</li>
          <li><strong>Business data</strong> — contacts, companies, deals, proposals, contracts, invoices,
            projects, tasks, time entries, and other records you create in the platform.</li>
          <li><strong>Integration data</strong> — when you connect Google Workspace, Google Search Console,
            Google Analytics, Google Ads, Google Business Profile, Meta Ads, QuickBooks, or similar services,
            we receive the data those platforms expose through OAuth scopes you explicitly grant.</li>
          <li><strong>Usage data</strong> — timestamps, IP addresses, and event logs used for security,
            debugging, and analytics.</li>
        </ul>

        <h2 className="text-xl font-bold mt-6">2. How we use Google user data</h2>
        <p>
          GravHub&rsquo;s use of information received from Google APIs adheres to the{' '}
          <a className="text-emerald-700 underline" href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </a>, including the Limited Use requirements.
        </p>
        <ul className="list-disc pl-6 flex flex-col gap-1">
          <li><strong>Calendar</strong> — to show your booked events and create new events for appointments scheduled through GravHub.</li>
          <li><strong>Gmail</strong> — to display your inbox, send emails on your behalf, and log client correspondence against CRM records.</li>
          <li><strong>Drive</strong> — to upload and share files with clients through GravHub&rsquo;s portal and document library.</li>
          <li><strong>Search Console</strong> — to pull keyword impressions, clicks, CTR, and position data for client reporting.</li>
          <li><strong>Analytics</strong> — to display session, user, and conversion metrics inside client-facing reports.</li>
          <li><strong>Ads</strong> — to read campaign performance for client ad-spend reporting.</li>
          <li><strong>Business Profile</strong> — to display location insights, reviews, and to reply to reviews at your direction.</li>
        </ul>
        <p>
          We do <strong>not</strong> use Google user data for targeted advertising, we do not sell or
          transfer Google user data to third parties except as needed to provide the service, and we do not
          use Google user data for purposes unrelated to the features you&rsquo;ve chosen to enable.
        </p>

        <h2 className="text-xl font-bold mt-6">3. How we store and protect data</h2>
        <ul className="list-disc pl-6 flex flex-col gap-1">
          <li>Data is stored on Supabase (PostgreSQL) in the United States.</li>
          <li>OAuth access and refresh tokens are encrypted at rest using AES-256-GCM.</li>
          <li>All network traffic is protected by TLS 1.2+.</li>
          <li>Access to production data is limited to authorized Graviss Marketing staff.</li>
          <li>We monitor errors and security events through Sentry and application audit logs.</li>
        </ul>

        <h2 className="text-xl font-bold mt-6">4. How we share data</h2>
        <p>We share data only with:</p>
        <ul className="list-disc pl-6 flex flex-col gap-1">
          <li><strong>Service providers</strong> that power GravHub&rsquo;s infrastructure: Supabase (database),
            Vercel (hosting), Resend (transactional email), Sentry (error tracking), Upstash (rate limiting),
            and Anthropic (AI features).</li>
          <li><strong>Third-party integrations</strong> you explicitly connect, for the specific operations
            you authorize.</li>
          <li><strong>Law enforcement</strong> when required by subpoena or court order.</li>
        </ul>

        <h2 className="text-xl font-bold mt-6">5. Data retention</h2>
        <p>
          We retain your data for as long as your account is active. You may request deletion at any time
          by emailing us at the address below. Upon request, we will delete all personal information within
          30 days, except where retention is required by law.
        </p>

        <h2 className="text-xl font-bold mt-6">6. Your rights</h2>
        <p>
          You have the right to access, correct, export, or delete your data. You also have the right to
          revoke any OAuth permissions you&rsquo;ve granted by visiting the relevant service&rsquo;s security
          settings (e.g. <a className="text-emerald-700 underline" href="https://myaccount.google.com/permissions">Google Account permissions</a>).
        </p>

        <h2 className="text-xl font-bold mt-6">7. Children&rsquo;s privacy</h2>
        <p>GravHub is a business tool and is not directed to children under 13.</p>

        <h2 className="text-xl font-bold mt-6">8. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. When we do, we will update the &ldquo;Last
          updated&rdquo; date above and notify account owners by email for material changes.
        </p>

        <h2 className="text-xl font-bold mt-6">9. Contact us</h2>
        <p>
          Questions about this policy or our data practices? Email{' '}
          <a className="text-emerald-700 underline" href="mailto:privacy@gravissmarketing.com">
            privacy@gravissmarketing.com
          </a>
          {' '}or write to: Graviss Marketing, United States.
        </p>
      </section>
    </div>
  )
}

import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Graviss Marketing',
  description: 'Privacy policy for GravHub by Graviss Marketing',
}

function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-wide" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>
          GRAVISS MARKETING
        </Link>
        <nav className="flex items-center gap-6 text-sm text-gray-500">
          <Link href="/privacy" className="text-gray-900 font-medium">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-900">Terms</Link>
          <Link href="/cookie-policy" className="hover:text-gray-900">Cookies</Link>
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-16">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <p>&copy; {new Date().getFullYear()} Graviss Marketing. All rights reserved.</p>
          <nav className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
            <Link href="/cookie-policy" className="hover:text-gray-600">Cookie Policy</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ fontFamily: 'var(--font-body)' }}>
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Effective date: July 1, 2026</p>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-gray-700">
          <p>
            Graviss Marketing, LLC (&ldquo;Graviss Marketing,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates GravHub, a business
            operations platform accessible at <strong>app.gravissmarketing.com</strong>. This Privacy Policy explains
            what information we collect, how we use it, and your rights regarding your data.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">1. Information We Collect</h2>
          <p>We collect information in the following categories:</p>
          <ul className="list-disc pl-6 flex flex-col gap-2">
            <li><strong>Account information</strong> &mdash; name, email address, phone number, role, and company affiliation provided during registration or account setup.</li>
            <li><strong>Business data</strong> &mdash; contacts, companies, deals, proposals, contracts, invoices, projects, tasks, time entries, communications, and other records you create or import into the platform.</li>
            <li><strong>Integration data</strong> &mdash; when you connect third-party services (Google Workspace, Google Search Console, Google Analytics, Google Ads, Google Business Profile, Meta Ads, QuickBooks, HubSpot, Mercury, or similar platforms), we receive the data those platforms expose through the OAuth scopes you explicitly authorize.</li>
            <li><strong>Usage data</strong> &mdash; IP addresses, browser type, device information, timestamps, pages visited, and event logs collected automatically for security monitoring, debugging, and service improvement.</li>
            <li><strong>Cookies and similar technologies</strong> &mdash; see our <Link href="/cookie-policy" className="underline" style={{ color: '#015035' }}>Cookie Policy</Link> for details.</li>
          </ul>

          <h2 className="text-lg font-bold mt-4 text-gray-900">2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-6 flex flex-col gap-2">
            <li>Provide, maintain, and improve the GravHub platform and its features.</li>
            <li>Process transactions, send invoices, and manage billing.</li>
            <li>Communicate with you about your account, service updates, and support requests.</li>
            <li>Generate reports, dashboards, and analytics for your business operations.</li>
            <li>Ensure security, detect fraud, and prevent abuse of the platform.</li>
            <li>Comply with legal obligations and enforce our Terms of Service.</li>
          </ul>

          <h2 className="text-lg font-bold mt-4 text-gray-900">3. Google API Services &mdash; Limited Use Disclosure</h2>
          <p>
            GravHub&rsquo;s use and transfer to any other app of information received from Google APIs adheres to the{' '}
            <a className="underline" style={{ color: '#015035' }} href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
              Google API Services User Data Policy
            </a>, including the Limited Use requirements. Specifically:
          </p>
          <ul className="list-disc pl-6 flex flex-col gap-2">
            <li><strong>Google Calendar</strong> &mdash; to display your calendar events and create events for appointments scheduled through GravHub.</li>
            <li><strong>Gmail</strong> &mdash; to display your inbox, send emails on your behalf, and log client correspondence against CRM records.</li>
            <li><strong>Google Drive</strong> &mdash; to upload and share files through GravHub&rsquo;s document library and client portal.</li>
            <li><strong>Google Search Console</strong> &mdash; to retrieve keyword impressions, clicks, CTR, and position data for client SEO reporting.</li>
            <li><strong>Google Analytics</strong> &mdash; to display session, user, and conversion metrics in client-facing reports.</li>
            <li><strong>Google Ads</strong> &mdash; to read campaign performance data for advertising spend reporting.</li>
            <li><strong>Google Business Profile</strong> &mdash; to display location insights, reviews, and facilitate review responses at your direction.</li>
          </ul>
          <p>
            We do <strong>not</strong> use Google user data for serving advertisements. We do <strong>not</strong> sell
            or transfer Google user data to third parties except as necessary to provide and improve the features you&rsquo;ve
            enabled. We do <strong>not</strong> use Google user data for purposes unrelated to the GravHub platform.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">4. How We Store and Protect Your Data</h2>
          <ul className="list-disc pl-6 flex flex-col gap-2">
            <li>All data is stored on Supabase (PostgreSQL) infrastructure located in the United States.</li>
            <li>OAuth access tokens and refresh tokens are encrypted at rest using AES-256-GCM.</li>
            <li>All data in transit is protected by TLS 1.2 or higher.</li>
            <li>Access to production systems is restricted to authorized Graviss Marketing personnel through role-based access controls.</li>
            <li>We maintain application-level audit logs and monitor for security incidents through automated alerting.</li>
          </ul>

          <h2 className="text-lg font-bold mt-4 text-gray-900">5. How We Share Your Data</h2>
          <p>We share your data only in the following circumstances:</p>
          <ul className="list-disc pl-6 flex flex-col gap-2">
            <li><strong>Service providers</strong> &mdash; trusted infrastructure partners that help us operate GravHub, including Supabase (database and authentication), Vercel (hosting), Resend (transactional email), Twilio (SMS), Sentry (error monitoring), Upstash (rate limiting and caching), and Anthropic (AI-powered features).</li>
            <li><strong>Third-party integrations</strong> &mdash; services you explicitly connect through OAuth or API key configuration, limited to the specific operations you authorize.</li>
            <li><strong>Legal requirements</strong> &mdash; when required by applicable law, subpoena, court order, or governmental regulation.</li>
            <li><strong>Business transfers</strong> &mdash; in connection with a merger, acquisition, or sale of assets, your data may be transferred to the successor entity.</li>
          </ul>
          <p>We do <strong>not</strong> sell your personal information to third parties.</p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">6. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active or as needed to provide the Service.
            Upon account deletion or written request, we will delete your personal information within 30 calendar days,
            except where retention is required by law or necessary for legitimate business purposes (e.g., resolving disputes, enforcing agreements).
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">7. Your Rights</h2>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-6 flex flex-col gap-2">
            <li><strong>Access</strong> &mdash; request a copy of the personal data we hold about you.</li>
            <li><strong>Correction</strong> &mdash; request correction of inaccurate or incomplete data.</li>
            <li><strong>Deletion</strong> &mdash; request deletion of your personal data.</li>
            <li><strong>Portability</strong> &mdash; request your data in a structured, machine-readable format.</li>
            <li><strong>Objection</strong> &mdash; object to certain processing of your personal data.</li>
            <li><strong>Revocation</strong> &mdash; revoke any OAuth permissions you&rsquo;ve granted by visiting the relevant service&rsquo;s security settings (e.g., <a className="underline" style={{ color: '#015035' }} href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Google Account permissions</a>).</li>
          </ul>
          <p>To exercise any of these rights, contact us at the address below.</p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">8. California Privacy Rights (CCPA)</h2>
          <p>
            If you are a California resident, you have the right to know what personal information we collect, request its deletion,
            and opt out of the sale of personal information. We do not sell personal information. To make a request, contact us
            at the email address below. We will verify your identity before processing the request.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">9. Children&rsquo;s Privacy</h2>
          <p>
            GravHub is a business operations platform and is not intended for use by individuals under the age of 13.
            We do not knowingly collect personal information from children under 13. If we become aware that we have collected
            data from a child under 13, we will delete it promptly.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">10. International Data Transfers</h2>
          <p>
            If you access GravHub from outside the United States, your data will be transferred to and processed in the United States.
            By using the Service, you consent to this transfer. We take reasonable steps to ensure your data receives an adequate
            level of protection in the jurisdictions in which we process it.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. When we make material changes, we will update the
            &ldquo;Effective date&rdquo; above and notify account holders by email. Your continued use of the Service
            after changes constitutes acceptance of the updated policy.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">12. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or our data practices, please contact us:
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <p className="font-semibold text-gray-900">Graviss Marketing, LLC</p>
            <p>Riverview, FL 33578</p>
            <p>Phone: <a href="tel:+16786020988" className="underline" style={{ color: '#015035' }}>+1 (678) 602-0988</a></p>
            <p>Email: <a href="mailto:privacy@gravissmarketing.com" className="underline" style={{ color: '#015035' }}>privacy@gravissmarketing.com</a></p>
            <p>Website: <a href="https://www.gravissmarketing.com" className="underline" style={{ color: '#015035' }} target="_blank" rel="noopener noreferrer">www.gravissmarketing.com</a></p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

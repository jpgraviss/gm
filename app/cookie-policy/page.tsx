import Link from 'next/link'

export const metadata = {
  title: 'Cookie Policy — Graviss Marketing',
  description: 'Cookie policy for GravHub by Graviss Marketing',
}

function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-wide" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>
          GRAVISS MARKETING
        </Link>
        <nav className="flex items-center gap-6 text-sm text-gray-500">
          <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-900">Terms</Link>
          <Link href="/cookie-policy" className="text-gray-900 font-medium">Cookies</Link>
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

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ fontFamily: 'var(--font-body)' }}>
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Cookie Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Effective date: July 1, 2026</p>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-gray-700">
          <p>
            This Cookie Policy explains how Graviss Marketing, LLC (&ldquo;Graviss Marketing,&rdquo;
            &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) uses cookies and similar technologies
            on the GravHub platform. This policy should be read alongside our{' '}
            <Link href="/privacy" className="underline" style={{ color: '#015035' }}>Privacy Policy</Link>.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">1. What Are Cookies?</h2>
          <p>
            Cookies are small text files placed on your device by a website or application. They are widely used
            to make websites work efficiently, remember your preferences, and provide information to site operators.
            Similar technologies include local storage, session storage, and pixels.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">2. Types of Cookies We Use</h2>

          <h3 className="text-base font-semibold mt-2 text-gray-800">Essential Cookies</h3>
          <p>
            These cookies are necessary for the Service to function. They cannot be disabled without impairing
            core functionality.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="py-2 pr-4 font-semibold text-gray-900">Cookie</th>
                  <th className="py-2 pr-4 font-semibold text-gray-900">Purpose</th>
                  <th className="py-2 font-semibold text-gray-900">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs">sb-*-auth-token</td>
                  <td className="py-2 pr-4">Supabase authentication session. Identifies you and maintains your logged-in state.</td>
                  <td className="py-2">Session / 1 year</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs">gravhub-auth</td>
                  <td className="py-2 pr-4">Authentication bridge cookie that links your session to GravHub&rsquo;s identity layer.</td>
                  <td className="py-2">Session</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs">gravhub_cookie_consent</td>
                  <td className="py-2 pr-4">Records your cookie consent preference so we don&rsquo;t ask you again.</td>
                  <td className="py-2">1 year</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-base font-semibold mt-2 text-gray-800">Functional Cookies</h3>
          <p>
            These cookies enhance your experience by remembering your preferences and settings.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="py-2 pr-4 font-semibold text-gray-900">Cookie / Storage</th>
                  <th className="py-2 pr-4 font-semibold text-gray-900">Purpose</th>
                  <th className="py-2 font-semibold text-gray-900">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs">localStorage: sidebar_collapsed</td>
                  <td className="py-2 pr-4">Remembers whether you prefer the sidebar expanded or collapsed.</td>
                  <td className="py-2">Persistent</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs">localStorage: theme</td>
                  <td className="py-2 pr-4">Stores your light/dark theme preference.</td>
                  <td className="py-2">Persistent</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs">localStorage: gravhub_cookie_consent</td>
                  <td className="py-2 pr-4">Mirrors the cookie consent preference in local storage for client-side access.</td>
                  <td className="py-2">Persistent</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-base font-semibold mt-2 text-gray-800">Analytics Cookies</h3>
          <p>
            We may use analytics cookies to understand how visitors interact with the Service. These cookies help us
            measure traffic and usage patterns to improve the platform. Analytics cookies are only set if you accept
            cookies through our consent banner.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">3. Third-Party Cookies</h2>
          <p>
            When you connect third-party integrations (such as Google Workspace), those services may set their own
            cookies during the OAuth authorization flow. These cookies are governed by the respective third party&rsquo;s
            cookie and privacy policies. We do not control these cookies.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">4. Managing Your Cookie Preferences</h2>
          <p>You can manage cookies in several ways:</p>
          <ul className="list-disc pl-6 flex flex-col gap-2">
            <li><strong>Consent banner</strong> &mdash; when you first visit GravHub, a cookie consent banner gives you the option to accept or decline non-essential cookies.</li>
            <li><strong>Browser settings</strong> &mdash; most browsers allow you to block or delete cookies through their settings. Note that blocking essential cookies may prevent you from using the Service.</li>
            <li><strong>Clearing storage</strong> &mdash; you can clear local storage and cookies at any time through your browser&rsquo;s developer tools or privacy settings.</li>
          </ul>

          <h2 className="text-lg font-bold mt-4 text-gray-900">5. Do Not Track</h2>
          <p>
            Some browsers transmit a &ldquo;Do Not Track&rdquo; (DNT) signal. There is currently no industry standard
            for how websites should respond to DNT signals. We do not currently respond to DNT signals, but we respect
            your cookie consent choices made through our consent banner.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">6. Changes to This Policy</h2>
          <p>
            We may update this Cookie Policy from time to time. When we make changes, we will update the
            &ldquo;Effective date&rdquo; above. Your continued use of the Service after changes take effect
            constitutes acceptance of the updated policy.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">7. Contact Us</h2>
          <p>If you have questions about our use of cookies, please contact us:</p>
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

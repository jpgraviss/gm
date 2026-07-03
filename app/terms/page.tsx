import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — Graviss Marketing',
  description: 'Terms of service for GravHub by Graviss Marketing',
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
          <Link href="/terms" className="text-gray-900 font-medium">Terms</Link>
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

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ fontFamily: 'var(--font-body)' }}>
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-10">Effective date: July 1, 2026</p>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-gray-700">
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the GravHub platform
            (the &ldquo;Service&rdquo;), operated by Graviss Marketing, LLC (&ldquo;Graviss Marketing,&rdquo;
            &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By accessing or using the Service, you agree
            to be bound by these Terms. If you do not agree, do not use the Service.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">1. Eligibility</h2>
          <p>
            The Service is intended for use by businesses and individuals who are at least 18 years of age.
            By using the Service, you represent that you meet these requirements and have the authority to bind
            the entity on whose behalf you are using the Service.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">2. Account Registration</h2>
          <p>
            To access the Service, you must create an account with accurate and complete information. You are
            responsible for maintaining the confidentiality of your account credentials and for all activity
            that occurs under your account. You must notify us immediately of any unauthorized use.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">3. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 flex flex-col gap-2">
            <li>Use the Service for any unlawful purpose or in violation of any applicable law or regulation.</li>
            <li>Send spam, phishing messages, or unsolicited bulk communications through the Service.</li>
            <li>Upload, transmit, or store content that infringes on third-party intellectual property rights.</li>
            <li>Attempt to gain unauthorized access to, interfere with, or disrupt the Service, its servers, or connected networks.</li>
            <li>Reverse engineer, decompile, or disassemble any portion of the Service.</li>
            <li>Use the Service to transmit malware, viruses, or other malicious code.</li>
            <li>Resell, sublicense, or make the Service available to unauthorized third parties without our consent.</li>
          </ul>

          <h2 className="text-lg font-bold mt-4 text-gray-900">4. Third-Party Integrations</h2>
          <p>
            The Service integrates with third-party platforms including Google Workspace (Calendar, Gmail, Drive),
            Google Search Console, Google Analytics, Google Ads, Google Business Profile, Meta Ads, QuickBooks,
            HubSpot, Mercury, Twilio, and others. When you connect these integrations, you authorize us to access
            and process data on your behalf under the scopes you grant. Your use of third-party services remains
            subject to their respective terms of service and privacy policies.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">5. Content Ownership and License</h2>
          <p>
            You retain all ownership rights to the data, content, and materials you upload, create, or import
            into the Service (&ldquo;Your Content&rdquo;). We claim no ownership over Your Content. You grant
            us a limited, non-exclusive, worldwide license to process, store, and display Your Content solely
            as necessary to provide and improve the Service.
          </p>
          <p>
            All intellectual property rights in the Service itself (including software, design, trademarks, and
            documentation) remain the exclusive property of Graviss Marketing.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">6. Payment and Billing</h2>
          <p>
            Access to the Service may require a paid subscription. All fees are stated in U.S. Dollars and are
            billed in advance on a recurring basis (monthly or annually). Fees are non-refundable except where
            required by applicable law. Subscriptions automatically renew unless cancelled before the end of
            the current billing period. We reserve the right to change pricing with at least 30 days&rsquo; notice.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">7. Confidentiality</h2>
          <p>
            Each party agrees to maintain the confidentiality of the other party&rsquo;s proprietary and
            confidential information and not to disclose it to third parties without prior written consent,
            except as required by law or as necessary to provide or receive the Service.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">8. Service Availability</h2>
          <p>
            We strive to maintain high availability of the Service but do not guarantee uninterrupted or
            error-free operation. We may perform scheduled maintenance, and will provide reasonable advance
            notice when possible. We are not liable for any downtime, data loss, or service interruptions.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">9. Suspension and Termination</h2>
          <p>
            We may suspend or terminate your access to the Service at any time if you violate these Terms or
            engage in conduct that is harmful to us, other users, or third parties. We will provide reasonable
            notice except in cases of serious violations. You may cancel your account at any time by contacting
            us. Upon termination, you may request export of your data within 30 days.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">10. Disclaimer of Warranties</h2>
          <p className="uppercase font-medium text-gray-600">
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of
            any kind, whether express, implied, statutory, or otherwise. We disclaim all warranties, including
            without limitation warranties of merchantability, fitness for a particular purpose, and
            non-infringement. We do not warrant that the Service will meet your requirements or that operation
            will be uninterrupted, secure, or error-free.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">11. Limitation of Liability</h2>
          <p className="uppercase font-medium text-gray-600">
            To the maximum extent permitted by applicable law, in no event shall Graviss Marketing, its
            officers, directors, employees, or agents be liable for any indirect, incidental, special,
            consequential, or punitive damages, or any loss of profits, revenue, data, or goodwill, arising
            out of or in connection with your use of the Service. Our aggregate liability for any claims
            arising from or relating to the Service shall not exceed the total amount you paid us in the
            twelve (12) months preceding the event giving rise to the claim.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">12. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless Graviss Marketing from and against any claims,
            liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or
            relating to your use of the Service, your violation of these Terms, or your violation of any
            rights of a third party.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">13. Governing Law and Disputes</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the State of Florida,
            United States, without regard to its conflict of law provisions. Any disputes arising from these Terms
            or the Service shall be resolved exclusively in the state or federal courts located in Hillsborough County, Florida.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">14. Modifications</h2>
          <p>
            We may update these Terms from time to time. When we make material changes, we will update the
            &ldquo;Effective date&rdquo; above and notify you by email or through the Service. Your continued use
            of the Service after changes take effect constitutes acceptance of the revised Terms.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">15. Severability</h2>
          <p>
            If any provision of these Terms is found to be unenforceable or invalid, that provision shall be
            limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain
            in full force and effect.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">16. Entire Agreement</h2>
          <p>
            These Terms, together with our <Link href="/privacy" className="underline" style={{ color: '#015035' }}>Privacy Policy</Link> and{' '}
            <Link href="/cookie-policy" className="underline" style={{ color: '#015035' }}>Cookie Policy</Link>, constitute
            the entire agreement between you and Graviss Marketing regarding the Service and supersede all prior
            agreements and understandings.
          </p>

          <h2 className="text-lg font-bold mt-4 text-gray-900">17. Contact Us</h2>
          <p>If you have questions about these Terms, please contact us:</p>
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <p className="font-semibold text-gray-900">Graviss Marketing, LLC</p>
            <p>Riverview, FL 33578</p>
            <p>Phone: <a href="tel:+16786020988" className="underline" style={{ color: '#015035' }}>+1 (678) 602-0988</a></p>
            <p>Email: <a href="mailto:legal@gravissmarketing.com" className="underline" style={{ color: '#015035' }}>legal@gravissmarketing.com</a></p>
            <p>Website: <a href="https://www.gravissmarketing.com" className="underline" style={{ color: '#015035' }} target="_blank" rel="noopener noreferrer">www.gravissmarketing.com</a></p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

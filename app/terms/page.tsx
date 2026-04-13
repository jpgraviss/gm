export const metadata = {
  title: 'Terms of Service — GravHub',
  description: 'Terms of service for GravHub by Graviss Marketing',
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: April 13, 2026</p>

      <section className="flex flex-col gap-4 text-sm leading-relaxed">
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of GravHub
          (the &ldquo;Service&rdquo;), operated by Graviss Marketing. By using the Service, you agree
          to these Terms.
        </p>

        <h2 className="text-xl font-bold mt-6">1. Accounts</h2>
        <p>
          You must provide accurate information when creating an account. You are responsible for
          keeping your credentials secure and for all activity under your account.
        </p>

        <h2 className="text-xl font-bold mt-6">2. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 flex flex-col gap-1">
          <li>Use the Service to send spam, phishing, or unsolicited bulk email.</li>
          <li>Upload content that infringes third-party rights or violates applicable law.</li>
          <li>Attempt to probe, scan, or test the vulnerability of the Service without authorization.</li>
          <li>Interfere with or disrupt the Service or servers connected to it.</li>
          <li>Use the Service to harm minors or transmit illegal content.</li>
        </ul>

        <h2 className="text-xl font-bold mt-6">3. Integrations</h2>
        <p>
          The Service integrates with third-party platforms including Google Workspace, Google Search
          Console, Google Analytics, Google Ads, Google Business Profile, Meta Ads, QuickBooks, and
          others. When you connect these integrations, you authorize us to access data on your behalf
          under the scopes you grant. You remain bound by each third party&rsquo;s terms of service.
        </p>

        <h2 className="text-xl font-bold mt-6">4. Content ownership</h2>
        <p>
          You retain all rights to the data and content you enter into the Service. We claim no
          ownership over your business data. You grant us a limited license to process your content
          solely to provide the Service.
        </p>

        <h2 className="text-xl font-bold mt-6">5. Payment and subscriptions</h2>
        <p>
          Access to the Service may require a paid subscription. Fees are billed in advance,
          non-refundable except where required by law, and automatically renew unless cancelled before
          the renewal date.
        </p>

        <h2 className="text-xl font-bold mt-6">6. Termination</h2>
        <p>
          We may suspend or terminate your access to the Service at any time for violation of these
          Terms or for any reason with reasonable notice. You may cancel your account at any time.
          Upon termination, you may export your data for up to 30 days.
        </p>

        <h2 className="text-xl font-bold mt-6">7. Disclaimers</h2>
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTIES OF ANY KIND. WE DO NOT
          GUARANTEE UNINTERRUPTED OR ERROR-FREE OPERATION. USE OF THE SERVICE IS AT YOUR OWN RISK.
        </p>

        <h2 className="text-xl font-bold mt-6">8. Limitation of liability</h2>
        <p>
          TO THE FULLEST EXTENT PERMITTED BY LAW, GRAVISS MARKETING&rsquo;S AGGREGATE LIABILITY IN
          CONNECTION WITH THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS
          PRECEDING THE CLAIM.
        </p>

        <h2 className="text-xl font-bold mt-6">9. Changes to these terms</h2>
        <p>
          We may update these Terms from time to time. We will post the updated Terms here and
          update the &ldquo;Last updated&rdquo; date above. Continued use of the Service after
          changes constitutes acceptance.
        </p>

        <h2 className="text-xl font-bold mt-6">10. Governing law</h2>
        <p>
          These Terms are governed by the laws of the United States. Any disputes will be resolved
          in the state or federal courts located in our registered jurisdiction.
        </p>

        <h2 className="text-xl font-bold mt-6">11. Contact</h2>
        <p>
          Questions about these Terms? Email{' '}
          <a className="text-emerald-700 underline" href="mailto:legal@gravissmarketing.com">
            legal@gravissmarketing.com
          </a>.
        </p>
      </section>
    </div>
  )
}

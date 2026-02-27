import { useSetBreadcrumbs } from '@/contexts/PageTitleContext';
import { LayoutDashboard, Scale } from 'lucide-react';

export default function TermsOfServicePage() {
  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Terms of Service", icon: Scale }
  ]);

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 md:p-12">

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Terms of Service</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-6">

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">1. Acceptance of Terms</h2>
              <p>
                By accessing or using the Authentik platform and related services (the "Platform"), provided by
                Zendwise LLC ("Zendwise", "we", "us", or "our"), you ("Client", "you", or "your") agree to be bound
                by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not use the Platform.
                These Terms constitute a legally binding agreement between you and Zendwise LLC.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">2. Description of Services</h2>
              <p>
                Zendwise LLC provides a business-to-business (B2B) marketing and communication platform that includes,
                but is not limited to:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Email marketing and newsletter creation, scheduling, and delivery.</li>
                <li>Form building, hosting, and response collection.</li>
                <li>Contact management and segmentation.</li>
                <li>SMS and telephone marketing capabilities.</li>
                <li>Campaign analytics and reporting.</li>
                <li>Template design and management.</li>
                <li>Promotional and e-card features.</li>
                <li>Appointment scheduling and reminders.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">3. Account Registration &amp; Responsibilities</h2>
              <p>
                You must register an account to use the Platform. You agree to: (a) provide accurate, current, and
                complete information during registration; (b) maintain and update your account information; (c) maintain
                the security of your password and account credentials; (d) accept responsibility for all activities that
                occur under your account; and (e) notify us immediately of any unauthorised use of your account. You must
                be at least 18 years of age and have the legal authority to bind your organisation to these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">4. Permitted Use &amp; Restrictions</h2>
              <p>You agree to use the Platform solely for lawful business purposes. You shall not:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Use the Platform to send unsolicited commercial messages (spam) or violate any anti-spam legislation.</li>
                <li>Upload, transmit, or distribute malicious software, viruses, or harmful code.</li>
                <li>Attempt to gain unauthorised access to the Platform, other accounts, or computer systems.</li>
                <li>Use the Platform to collect, harvest, or store personal data in violation of applicable laws.</li>
                <li>Engage in any activity that disrupts, degrades, or interferes with the Platform's operation.</li>
                <li>Resell, sublicense, or redistribute the Platform without express written consent from Zendwise LLC.</li>
                <li>Use the Platform to transmit content that is illegal, defamatory, obscene, or infringes on intellectual property rights.</li>
                <li>Circumvent any technical measures or access controls implemented by the Platform.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">5. Email &amp; Communication Compliance</h2>
              <p>
                You are solely responsible for ensuring that all marketing communications sent through the Platform
                comply with applicable laws and regulations, including but not limited to:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>The CAN-SPAM Act (United States).</li>
                <li>The General Data Protection Regulation (GDPR) (European Union).</li>
                <li>The Canadian Anti-Spam Legislation (CASL).</li>
                <li>The Telephone Consumer Protection Act (TCPA).</li>
                <li>The Privacy and Electronic Communications Regulations (PECR) (United Kingdom).</li>
                <li>Any other applicable local, national, or international anti-spam and privacy laws.</li>
              </ul>
              <p>
                You must obtain proper consent from recipients before sending marketing communications and must include
                functional unsubscribe mechanisms in every commercial message. Failure to comply may result in immediate
                suspension or termination of your account.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">6. SMS &amp; Telephone Communications</h2>
              <p>
                If you use the Platform to send SMS messages or make telephone calls, you are responsible for: (a) obtaining
                express written consent from recipients as required by law; (b) maintaining records of such consent;
                (c) honouring opt-out requests promptly; (d) complying with all do-not-call regulations; and
                (e) informing recipients that standard message and data rates may apply. Zendwise LLC is not responsible
                for carrier charges incurred by recipients.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">7. Intellectual Property</h2>
              <p>
                The Platform, including its design, features, code, documentation, and branding, is the intellectual
                property of Zendwise LLC and is protected by copyright, trademark, and other intellectual property laws.
                You retain ownership of content you create and upload to the Platform. By uploading content, you grant
                Zendwise LLC a non-exclusive, worldwide, royalty-free licence to use, display, and transmit such content
                solely for the purpose of providing the Platform services.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">8. Data Processing &amp; Privacy</h2>
              <p>
                Zendwise LLC acts as a data processor on your behalf when processing personal data of your contacts
                and form respondents. Our processing of personal data is governed by our Privacy &amp; Security Statement
                and any applicable Data Processing Agreement. You, as the data controller, are responsible for ensuring
                that your collection and use of personal data through the Platform complies with applicable data
                protection laws.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">9. Payment &amp; Billing</h2>
              <p>
                Access to certain features of the Platform may require a paid subscription. You agree to pay all fees
                associated with your selected plan. Fees are billed in advance on a recurring basis (monthly or annually)
                unless otherwise specified. All fees are non-refundable except as required by applicable law. Zendwise LLC
                reserves the right to modify pricing with reasonable advance notice.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">10. Service Availability &amp; Warranties</h2>
              <p>
                Zendwise LLC strives to maintain high availability of the Platform but does not guarantee uninterrupted
                or error-free service. The Platform is provided "as is" and "as available" without warranties of any kind,
                whether express, implied, or statutory, including but not limited to implied warranties of merchantability,
                fitness for a particular purpose, and non-infringement. We do not warrant that the Platform will meet all
                of your requirements or that any errors will be corrected.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">11. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by applicable law, Zendwise LLC and its directors, officers, employees,
                and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages,
                including but not limited to loss of profits, data, business opportunities, or goodwill, arising out of
                or in connection with your use of the Platform. Zendwise LLC's total aggregate liability for any claims
                arising under these Terms shall not exceed the amount paid by you to Zendwise LLC in the twelve (12) months
                preceding the event giving rise to the claim.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">12. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless Zendwise LLC and its affiliates, officers, directors,
                employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and
                expenses (including reasonable legal fees) arising out of or relating to: (a) your use of the Platform;
                (b) your violation of these Terms; (c) your violation of applicable laws or regulations; (d) any content
                you transmit through the Platform; or (e) your infringement of any third-party rights.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">13. Termination</h2>
              <p>
                Either party may terminate these Terms at any time with written notice. Zendwise LLC may suspend or
                terminate your access to the Platform immediately if you breach these Terms or engage in conduct that
                we determine, in our sole discretion, is harmful to the Platform, other users, or Zendwise LLC. Upon
                termination, your right to use the Platform ceases immediately. Sections relating to intellectual
                property, limitation of liability, indemnification, and governing law shall survive termination.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">14. Governing Law &amp; Dispute Resolution</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the State of Delaware,
                United States of America, without regard to conflict of law principles. Any disputes arising under or
                in connection with these Terms shall be resolved through good-faith negotiation, and if unsuccessful,
                through binding arbitration administered in accordance with the rules of the American Arbitration
                Association. The arbitration shall take place in Delaware, USA.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">15. Modifications to Terms</h2>
              <p>
                Zendwise LLC reserves the right to modify these Terms at any time. Material changes will be communicated
                via the Platform or by email to the address associated with your account. Your continued use of the
                Platform after such notification constitutes acceptance of the modified Terms. If you do not agree to the
                modified Terms, you must stop using the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">16. Miscellaneous</h2>
              <p>
                These Terms constitute the entire agreement between you and Zendwise LLC regarding the Platform. If any
                provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full
                force and effect. Zendwise LLC's failure to enforce any right or provision shall not constitute a waiver
                of such right or provision. You may not assign or transfer your rights under these Terms without prior
                written consent from Zendwise LLC.
              </p>
            </section>

            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Zendwise LLC &mdash; B2B Marketing &amp; Communication Platform
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

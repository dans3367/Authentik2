import { useSetBreadcrumbs } from '@/contexts/PageTitleContext';
import { LayoutDashboard, FileText } from 'lucide-react';

export default function AcceptableUsePage() {
  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Acceptable Use Policy", icon: FileText }
  ]);

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 md:p-12">

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Acceptable Use Policy</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-6">

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">1. Purpose</h2>
              <p>
                This Acceptable Use Policy ("AUP") governs your use of the Authentik platform and all related services
                provided by Zendwise LLC. This policy is designed to protect Zendwise LLC, its clients, and the
                recipients of communications sent through the platform. By using our services, you agree to comply with
                this policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">2. Prohibited Content</h2>
              <p>You may not use the Platform to create, store, or transmit content that:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Is unlawful, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, or otherwise objectionable.</li>
                <li>Infringes on any patent, trademark, trade secret, copyright, or other intellectual property rights of any party.</li>
                <li>Contains malicious code, viruses, worms, Trojan horses, or any other harmful components.</li>
                <li>Promotes illegal activities or provides instructional information about illegal activities.</li>
                <li>Impersonates any person or entity, or falsely states or misrepresents your affiliation with a person or entity.</li>
                <li>Contains unsolicited or unauthorised advertising, promotional materials, junk mail, spam, chain letters, or pyramid schemes.</li>
                <li>Involves the harvesting or collection of email addresses or other contact information without consent.</li>
                <li>Discriminates on the basis of race, sex, religion, nationality, disability, sexual orientation, or age.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">3. Email &amp; Communication Standards</h2>
              <p>When using the Platform for email marketing, newsletters, or other communications, you must:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Only send communications to recipients who have provided valid, verifiable consent (opt-in).</li>
                <li>Include a clear and functional unsubscribe mechanism in every commercial message.</li>
                <li>Honour unsubscribe requests within 10 business days (or sooner as required by applicable law).</li>
                <li>Include accurate sender identification and a valid physical postal address.</li>
                <li>Not use deceptive subject lines or misleading header information.</li>
                <li>Maintain clean and up-to-date mailing lists, promptly removing bounced addresses and unsubscribed contacts.</li>
                <li>Not purchase, rent, or use third-party email lists without verified opt-in consent.</li>
                <li>Comply with all applicable anti-spam laws (CAN-SPAM, GDPR, CASL, PECR, etc.).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">4. SMS &amp; Telephone Standards</h2>
              <p>When using the Platform for SMS or telephone communications, you must:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Obtain express written consent before sending any marketing SMS or making marketing calls.</li>
                <li>Clearly identify yourself and the purpose of the communication.</li>
                <li>Provide a clear opt-out mechanism (e.g., "Reply STOP to unsubscribe").</li>
                <li>Honour all do-not-call lists and opt-out requests immediately.</li>
                <li>Comply with the Telephone Consumer Protection Act (TCPA) and equivalent regulations.</li>
                <li>Not send messages outside of permissible hours as defined by applicable law.</li>
                <li>Inform recipients that standard message and data rates may apply.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">5. Form &amp; Data Collection Standards</h2>
              <p>When using the Platform's form builder and data collection features, you must:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Clearly disclose what data is being collected and for what purpose.</li>
                <li>Obtain appropriate consent for data collection, especially for marketing purposes.</li>
                <li>Not collect sensitive personal data (health, financial, biometric) without adequate legal basis and safeguards.</li>
                <li>Include a link to your privacy policy on all public-facing forms.</li>
                <li>Process collected data only for the purposes disclosed to the respondent.</li>
                <li>Implement appropriate measures to protect collected data.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">6. System &amp; Network Security</h2>
              <p>You shall not:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Attempt to probe, scan, or test the vulnerability of the Platform or any associated system or network.</li>
                <li>Attempt to circumvent authentication, security measures, or access controls.</li>
                <li>Interfere with or disrupt the Platform or servers or networks connected to the Platform.</li>
                <li>Use automated tools, bots, or scripts to access the Platform in a manner that exceeds reasonable use.</li>
                <li>Attempt to reverse-engineer, decompile, or disassemble any part of the Platform.</li>
                <li>Share account credentials or allow unauthorised access to your account.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">7. Reporting &amp; Enforcement</h2>
              <p>
                Zendwise LLC reserves the right to investigate any suspected violations of this AUP. If a violation is
                confirmed, we may take any action we deem appropriate, including but not limited to: issuing warnings,
                suspending or terminating your account, removing offending content, reporting illegal activities to law
                enforcement, and pursuing legal remedies. We may also cooperate with law enforcement agencies in
                investigating suspected criminal violations.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">8. Consequences of Violation</h2>
              <p>Violations of this AUP may result in:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Immediate suspension or termination of your account without refund.</li>
                <li>Removal of offending content or communications.</li>
                <li>Temporary or permanent blacklisting of sending domains and IP addresses.</li>
                <li>Legal action to recover damages and costs.</li>
                <li>Reporting to relevant authorities and industry anti-abuse organisations.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">9. Changes to This Policy</h2>
              <p>
                Zendwise LLC reserves the right to modify this AUP at any time. We will provide notice of material
                changes through the Platform or via email. Your continued use of the Platform after notification
                constitutes acceptance of the updated policy.
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

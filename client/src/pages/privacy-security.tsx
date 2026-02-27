import { useSetBreadcrumbs } from '@/contexts/PageTitleContext';
import { LayoutDashboard, Shield } from 'lucide-react';

export default function PrivacySecurityPage() {
  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Privacy & Security", icon: Shield }
  ]);

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 md:p-12">

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Privacy &amp; Security Statement</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-6">

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">1. Data Collection &amp; Purpose of Processing</h2>
              <p>
                By submitting any form on this platform, you acknowledge and consent to the collection, processing, and storage of the
                personal information you provide, including but not limited to your name, email address, phone number,
                mailing address, company name, job title, and any other data fields presented in the form. This
                information is collected for the purpose of fulfilling the specific request made through the form, as
                well as for ongoing business-to-business (B2B) communications between you and the organisation operating
                the form (the "Client").
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">2. Marketing, Newsletter &amp; Promotional Communications</h2>
              <p>
                By providing your contact details, you expressly consent to receive marketing materials, newsletters,
                promotional offers, product updates, event invitations, industry insights, and other commercial
                communications from the Client. These communications may be delivered via:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Email</strong> — including newsletters, drip campaigns, promotional announcements, and transactional updates.</li>
                <li><strong>Telephone &amp; Mobile Phone</strong> — including voice calls, SMS/text messages, MMS, and automated or pre-recorded messages to any phone number you provide, including mobile numbers. <strong>Standard messaging and data rates from your carrier may apply.</strong> Message frequency may vary.</li>
                <li><strong>Push Notifications</strong> — where applicable and where you have enabled such notifications on your device.</li>
                <li><strong>Postal Mail</strong> — physical marketing materials, catalogues, or promotional correspondence sent to the mailing address you provide.</li>
                <li><strong>Social Media &amp; Digital Channels</strong> — targeted advertisements and retargeting campaigns on third-party platforms based on the information you provide.</li>
              </ul>
              <p>
                You may opt out of marketing communications at any time by following the unsubscribe instructions
                included in each communication, by contacting the Client directly, or by replying STOP to any SMS
                message. Opting out of marketing communications does not affect transactional or service-related messages.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">3. Phone, SMS &amp; Messaging Charges</h2>
              <p>
                If you provide a phone number, you consent to being contacted at that number for the purposes described
                above. <strong>Standard call charges, SMS/text message rates, and data charges imposed by your
                telecommunications provider may apply</strong> when you receive calls, text messages, or multimedia
                messages from us or on behalf of the Client. These charges are determined by your carrier and are your
                sole responsibility. Neither the Client nor Zendwise LLC is responsible for any charges incurred by your
                carrier in connection with these communications. Contact your carrier for details about your messaging
                and data plan. You are not required to provide consent to telephone or SMS marketing as a condition of
                purchasing any goods or services.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">4. Service Provider &amp; Infrastructure</h2>
              <p>
                This platform and the associated data processing infrastructure are provided by <strong>Zendwise LLC</strong>,
                acting as a third-party service provider and data processor on behalf of the Client. Zendwise LLC
                provides the technology platform, hosting infrastructure, form rendering, email sending, SMS delivery,
                data storage, and related communication services that enable the Client to collect, manage, and
                communicate with form respondents. Zendwise LLC processes personal data strictly in accordance with
                the Client's instructions and applicable data processing agreements. Zendwise LLC does not independently
                use, sell, rent, or share personal information for its own marketing purposes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">5. Data Sharing &amp; Third-Party Processors</h2>
              <p>
                Data may be shared with trusted third-party service providers engaged by Zendwise LLC or the Client
                solely for the purpose of delivering the services described herein. These may include cloud hosting
                providers, email service providers, SMS gateway operators, analytics platforms, customer relationship
                management (CRM) systems, and payment processors where applicable. All third-party processors are
                contractually obligated to maintain the confidentiality and security of data and to process it only
                as instructed. Personal data will not be sold to third parties for independent marketing purposes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">6. Data Security</h2>
              <p>
                We implement industry-standard technical and organisational security measures to protect personal
                information against unauthorised access, alteration, disclosure, or destruction. These measures include
                but are not limited to encryption of data in transit (TLS/SSL) and at rest, access controls, regular
                security assessments, secure data centres, network monitoring, and incident response procedures. While
                we strive to protect personal information, no method of electronic transmission or storage is
                completely secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">7. Data Retention</h2>
              <p>
                Personal information will be retained for as long as necessary to fulfil the purposes for which it
                was collected, to comply with legal obligations, to resolve disputes, and to enforce agreements. When
                data is no longer required, it will be securely deleted or anonymised in accordance with applicable
                data retention policies and legal requirements.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">8. Your Rights</h2>
              <p>Depending on your jurisdiction, you may have the right to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Access the personal data we hold about you.</li>
                <li>Request correction or update of inaccurate or incomplete data.</li>
                <li>Request deletion or erasure of your personal data ("right to be forgotten").</li>
                <li>Restrict or object to the processing of your data.</li>
                <li>Request portability of your data in a structured, commonly used, and machine-readable format.</li>
                <li>Withdraw consent at any time, without affecting the lawfulness of processing based on consent prior to withdrawal.</li>
                <li>Lodge a complaint with a supervisory authority or data protection regulator in your jurisdiction.</li>
                <li>Opt out of the sale or sharing of personal information (where applicable under laws such as the CCPA/CPRA).</li>
                <li>Not be discriminated against for exercising any of these rights.</li>
              </ul>
              <p>
                To exercise any of these rights, please contact the Client directly using the contact information
                provided in their communications or privacy policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">9. International Data Transfers</h2>
              <p>
                Personal data may be transferred to and processed in countries other than the country in which you
                reside, including the United States of America, where Zendwise LLC operates its infrastructure. Such
                transfers are conducted in compliance with applicable data protection laws, including the use of Standard
                Contractual Clauses (SCCs), adequacy decisions, or other legally recognised transfer mechanisms to ensure
                data receives an adequate level of protection.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">10. Cookies, Tracking &amp; Analytics</h2>
              <p>
                This platform may utilise cookies, web beacons, pixel tags, and similar tracking technologies to collect
                information about your interactions, including your IP address, browser type, device
                information, referring URL, and behaviour patterns. This information is used to improve
                functionality, monitor performance, prevent fraud, and support analytics. By using this platform, you consent
                to the use of such technologies as described herein.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">11. Children's Privacy</h2>
              <p>
                This platform and the associated services are intended for business use and are not directed at individuals
                under the age of 16 (or the applicable age of consent in your jurisdiction). We do not knowingly collect
                personal information from children. If you believe that a child has provided personal information through
                this platform, please contact the Client immediately so that the data can be promptly deleted.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">12. Legal Basis for Processing</h2>
              <p>
                The legal bases for processing personal data include: (a) explicit consent as provided by
                submitting forms on this platform; (b) the legitimate business interests of the Client in conducting B2B marketing
                and communications; (c) the performance or preparation of a contract between you (or your organisation)
                and the Client; and (d) compliance with applicable legal obligations. Where processing is based on
                consent, you may withdraw that consent at any time as described in Section 8 above.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">13. Regulatory Compliance</h2>
              <p>
                This privacy and security statement is designed to comply with applicable data protection and privacy
                regulations, including but not limited to the General Data Protection Regulation (GDPR), the California
                Consumer Privacy Act / California Privacy Rights Act (CCPA/CPRA), the CAN-SPAM Act, the Telephone
                Consumer Protection Act (TCPA), the Canadian Anti-Spam Legislation (CASL), the Privacy and Electronic
                Communications Regulations (PECR), and other applicable national and regional privacy laws. Where local
                law provides greater protections, those protections shall apply.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">14. Changes to This Statement</h2>
              <p>
                This privacy and security statement may be updated from time to time to reflect changes in our practices,
                technology, legal requirements, or other factors. Any material changes will be reflected in the updated
                statement made available on this page. Your continued use of this platform following any
                changes constitutes your acceptance of the updated statement.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">15. Contact Information</h2>
              <p>
                For questions or concerns regarding this privacy and security statement, your personal data, or to
                exercise your data protection rights, please contact the Client using the details provided in their
                communications or privacy policy. For infrastructure and service-related enquiries, you may contact
                Zendwise LLC at the address provided on their website.
              </p>
            </section>

            <section className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm italic text-gray-500 dark:text-gray-400">
                By using this platform, you confirm that you have read, understood, and agree to this Privacy &amp;
                Security Statement. You consent to the collection, processing, and use of personal data as described
                above, including the receipt of marketing and newsletter communications via email, telephone, SMS, and
                other channels. You acknowledge that standard messaging, call, and data rates may apply for
                communications received via phone or mobile device.
              </p>
            </section>

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Infrastructure &amp; email delivery services provided by Zendwise LLC on behalf of the Client.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

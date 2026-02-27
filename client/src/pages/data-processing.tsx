import { useSetBreadcrumbs } from '@/contexts/PageTitleContext';
import { LayoutDashboard, FileText } from 'lucide-react';

export default function DataProcessingPage() {
  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Data Processing Agreement", icon: FileText }
  ]);

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 md:p-12">

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Data Processing Agreement</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-6">

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">1. Definitions</h2>
              <p>For the purposes of this Data Processing Agreement ("DPA"):</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>"Data Controller"</strong> refers to the Client who determines the purposes and means of processing personal data through the Platform.</li>
                <li><strong>"Data Processor"</strong> refers to Zendwise LLC, which processes personal data on behalf of the Data Controller.</li>
                <li><strong>"Personal Data"</strong> means any information relating to an identified or identifiable natural person.</li>
                <li><strong>"Processing"</strong> means any operation performed on personal data, including collection, recording, storage, retrieval, use, disclosure, erasure, or destruction.</li>
                <li><strong>"Sub-processor"</strong> means any third party engaged by Zendwise LLC to process personal data on behalf of the Data Controller.</li>
                <li><strong>"Data Subject"</strong> means the identified or identifiable natural person to whom the personal data relates.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">2. Scope &amp; Purpose of Processing</h2>
              <p>
                Zendwise LLC processes personal data solely on behalf of and in accordance with the documented instructions
                of the Data Controller. The purpose of processing includes: providing the Platform services, delivering
                email and SMS communications, hosting and rendering forms, storing form responses and contact data,
                providing analytics and reporting, and any other processing necessary to fulfil the services described
                in the Terms of Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">3. Categories of Data &amp; Data Subjects</h2>
              <p>The personal data processed under this DPA may include:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Contact Data</strong>: names, email addresses, phone numbers, mailing addresses, company names, job titles.</li>
                <li><strong>Form Response Data</strong>: any data submitted by respondents through forms created on the Platform.</li>
                <li><strong>Communication Data</strong>: email engagement data (opens, clicks), SMS delivery status, and call logs.</li>
                <li><strong>Technical Data</strong>: IP addresses, browser type, device information, user agent strings.</li>
                <li><strong>Account Data</strong>: registration information, preferences, and usage data of the Client.</li>
              </ul>
              <p>Data subjects include: the Client's customers, prospects, leads, form respondents, newsletter subscribers, and other business contacts.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">4. Obligations of the Data Processor</h2>
              <p>Zendwise LLC shall:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Process personal data only on documented instructions from the Data Controller.</li>
                <li>Ensure that persons authorised to process personal data are bound by confidentiality obligations.</li>
                <li>Implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk.</li>
                <li>Assist the Data Controller in responding to data subject requests (access, rectification, erasure, portability, etc.).</li>
                <li>Assist the Data Controller in ensuring compliance with data protection impact assessments and prior consultation obligations.</li>
                <li>Delete or return all personal data to the Data Controller upon termination of services, at the Data Controller's choice.</li>
                <li>Make available all information necessary to demonstrate compliance and allow for audits.</li>
                <li>Notify the Data Controller without undue delay upon becoming aware of a personal data breach.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">5. Sub-processors</h2>
              <p>
                Zendwise LLC may engage sub-processors to assist in providing the Platform services. The Data Controller
                provides general authorisation for the use of sub-processors, subject to the following conditions:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Zendwise LLC shall maintain a list of current sub-processors and make it available upon request.</li>
                <li>Zendwise LLC shall notify the Data Controller of any intended changes to sub-processors, providing a reasonable opportunity to object.</li>
                <li>All sub-processors shall be bound by data protection obligations no less protective than those in this DPA.</li>
                <li>Zendwise LLC remains fully liable for the acts and omissions of its sub-processors.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">6. Security Measures</h2>
              <p>Zendwise LLC implements the following security measures:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Encryption of personal data in transit (TLS 1.2+) and at rest (AES-256).</li>
                <li>Role-based access controls and the principle of least privilege.</li>
                <li>Regular security assessments, vulnerability scanning, and penetration testing.</li>
                <li>Secure development practices and code review processes.</li>
                <li>Network monitoring, intrusion detection, and incident response procedures.</li>
                <li>Regular backups with encrypted storage and tested restoration procedures.</li>
                <li>Employee security awareness training and background checks where applicable.</li>
                <li>Physical security controls at data centre facilities.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">7. Data Breach Notification</h2>
              <p>
                In the event of a personal data breach, Zendwise LLC shall notify the Data Controller without undue delay
                (and in any event within 72 hours of becoming aware of the breach) and shall provide: (a) a description of
                the nature of the breach, including the categories and approximate number of data subjects and records
                affected; (b) the likely consequences of the breach; (c) the measures taken or proposed to address the
                breach; and (d) the contact details of the point of contact for further information.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">8. International Transfers</h2>
              <p>
                Where personal data is transferred outside the European Economic Area (EEA) or the United Kingdom,
                Zendwise LLC shall ensure that appropriate safeguards are in place, including: Standard Contractual
                Clauses (SCCs) approved by the European Commission, adequacy decisions, binding corporate rules, or
                other legally recognised transfer mechanisms. The Data Controller authorises the transfer of personal
                data to the United States where Zendwise LLC maintains its primary infrastructure.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">9. Data Retention &amp; Deletion</h2>
              <p>
                Zendwise LLC shall retain personal data only for as long as necessary to provide the Platform services
                and as instructed by the Data Controller. Upon termination of the service agreement, Zendwise LLC shall,
                at the Data Controller's election, return or securely delete all personal data within 30 days, unless
                retention is required by applicable law. Zendwise LLC shall provide certification of deletion upon request.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">10. Audits &amp; Compliance</h2>
              <p>
                Zendwise LLC shall make available to the Data Controller all information necessary to demonstrate
                compliance with this DPA and shall allow for and contribute to audits, including inspections, conducted
                by the Data Controller or an independent auditor mandated by the Data Controller, subject to reasonable
                advance notice and during normal business hours.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">11. Duration &amp; Termination</h2>
              <p>
                This DPA shall remain in effect for the duration of the service agreement between the Data Controller
                and Zendwise LLC. The obligations of Zendwise LLC regarding the processing and security of personal data
                shall survive the termination or expiration of this DPA for as long as Zendwise LLC retains any personal
                data processed on behalf of the Data Controller.
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

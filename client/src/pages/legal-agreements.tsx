import { useSetBreadcrumbs } from '@/contexts/PageTitleContext';
import { LayoutDashboard, Scale, Shield, FileText, Mail, Cookie, Database, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';

const legalDocuments = [
  {
    title: 'Privacy & Security Statement',
    description: 'How we collect, process, store, and protect your personal data. Covers marketing consent, phone/SMS charges, data sharing, and your rights under GDPR, CCPA, and other regulations.',
    href: '/privacy-security',
    icon: Shield,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
  },
  {
    title: 'Terms of Service',
    description: 'The agreement governing your use of the Authentik platform, including account responsibilities, permitted use, payment, liability, and dispute resolution.',
    href: '/terms-of-service',
    icon: Scale,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
  },
  {
    title: 'Acceptable Use Policy',
    description: 'Rules for responsible use of the platform covering email and SMS compliance, prohibited content, communication standards, and enforcement procedures.',
    href: '/acceptable-use',
    icon: FileText,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    title: 'Data Processing Agreement',
    description: 'How Zendwise LLC processes personal data on your behalf as a data processor, including security measures, sub-processors, breach notification, and international transfers.',
    href: '/data-processing',
    icon: Database,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
  },
  {
    title: 'Cookie Policy',
    description: 'Details about cookies and similar tracking technologies used on the platform, including types, purposes, third-party cookies, and how to manage your preferences.',
    href: '/cookie-policy',
    icon: Cookie,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
  },
];

export default function LegalAgreementsPage() {
  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Legal Agreements", icon: Scale }
  ]);

  const currentYear = new Date().getFullYear();

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Legal Agreements</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Review the legal documents that govern the use of the Authentik platform and the services
            provided by Zendwise LLC. These documents cover privacy, terms, acceptable use, data processing,
            and cookies.
          </p>
        </div>

        {/* Document Cards */}
        <div className="space-y-3">
          {legalDocuments.map((doc) => {
            const Icon = doc.icon;
            return (
              <Link
                key={doc.href}
                href={doc.href}
                className="block group"
              >
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md transition-all duration-200">
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${doc.bg} flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${doc.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {doc.title}
                        </h2>
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                        {doc.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Contact Support */}
        <div className="mt-8 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
              <Mail className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Questions?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                If you have any questions about these legal documents or need further clarification,
                please contact our support team.
              </p>
              <a
                href="mailto:support@zendwise.com"
                className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                support@zendwise.com
              </a>
            </div>
          </div>
        </div>

        {/* Footer Attribution */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                &copy; {currentYear} Zendwise LLC. All rights reserved.
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Infrastructure &amp; email delivery services provided by Zendwise LLC on behalf of the Client.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500">
              <span>GDPR</span>
              <span className="text-gray-300 dark:text-gray-700">|</span>
              <span>CCPA/CPRA</span>
              <span className="text-gray-300 dark:text-gray-700">|</span>
              <span>CAN-SPAM</span>
              <span className="text-gray-300 dark:text-gray-700">|</span>
              <span>TCPA</span>
              <span className="text-gray-300 dark:text-gray-700">|</span>
              <span>CASL</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

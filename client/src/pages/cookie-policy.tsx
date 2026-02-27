import { useSetBreadcrumbs } from '@/contexts/PageTitleContext';
import { LayoutDashboard, FileText } from 'lucide-react';

export default function CookiePolicyPage() {
  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Cookie Policy", icon: FileText }
  ]);

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 md:p-12">

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Cookie Policy</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-6">

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">1. What Are Cookies</h2>
              <p>
                Cookies are small text files that are stored on your device (computer, tablet, or mobile phone) when you
                visit a website or use an online platform. Cookies allow the platform to recognise your device and remember
                information about your visit, such as your preferences, login status, and browsing behaviour. This Cookie
                Policy explains how Zendwise LLC ("we", "us", "our") uses cookies and similar technologies on the
                Authentik platform (the "Platform").
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">2. Types of Cookies We Use</h2>

              <h3 className="text-base font-medium text-gray-800 dark:text-gray-200 mt-4">Essential Cookies</h3>
              <p>
                These cookies are strictly necessary for the operation of the Platform. They enable core functionality such
                as authentication, session management, security features, and access control. Without these cookies, the
                Platform cannot function properly. These cookies do not require your consent.
              </p>

              <h3 className="text-base font-medium text-gray-800 dark:text-gray-200 mt-4">Functional Cookies</h3>
              <p>
                These cookies enable enhanced functionality and personalisation, such as remembering your language
                preference, sidebar state, theme settings, and other user interface customisations. If you do not allow
                these cookies, some or all of these features may not function properly.
              </p>

              <h3 className="text-base font-medium text-gray-800 dark:text-gray-200 mt-4">Analytics &amp; Performance Cookies</h3>
              <p>
                These cookies collect information about how you use the Platform, including which pages you visit, how long
                you spend on each page, and any errors encountered. This information is aggregated and anonymised and is
                used to improve the Platform's performance and user experience.
              </p>

              <h3 className="text-base font-medium text-gray-800 dark:text-gray-200 mt-4">Marketing &amp; Tracking Cookies</h3>
              <p>
                These cookies may be used to track your activity across the Platform and, where applicable, across other
                websites for the purpose of delivering targeted advertisements, measuring campaign effectiveness, and
                building audience profiles. These cookies may be set by third-party advertising partners.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">3. Similar Technologies</h2>
              <p>In addition to cookies, we may use the following similar technologies:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Web Beacons (Pixel Tags)</strong> — small transparent images embedded in emails and web pages to track whether content has been accessed or opened.</li>
                <li><strong>Local Storage</strong> — browser-based storage used to persist user preferences and application state (e.g., sidebar open/closed, menu preferences).</li>
                <li><strong>Session Storage</strong> — temporary browser storage that is cleared when the browser tab is closed.</li>
                <li><strong>Fingerprinting</strong> — techniques that collect information about your device configuration to create a unique identifier for fraud prevention and security purposes.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">4. Cookies on Public Forms</h2>
              <p>
                When end-users access forms created and published through the Platform, the following data may be collected
                through cookies and similar technologies:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>IP address and approximate geolocation.</li>
                <li>Browser type, version, and operating system.</li>
                <li>Device type and screen resolution.</li>
                <li>Referring URL and landing page.</li>
                <li>Form interaction behaviour (fields completed, time spent, submission status).</li>
                <li>User agent string.</li>
              </ul>
              <p>
                This data is collected to prevent spam and abuse, ensure form security, improve form functionality, and
                provide analytics to the form owner (the Client).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">5. Third-Party Cookies</h2>
              <p>
                We may allow certain third-party services to place cookies on your device through the Platform. These third
                parties include analytics providers, advertising networks, and social media platforms. These third parties
                have their own privacy and cookie policies, which govern the use of their cookies. We do not control the
                cookies set by third parties.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">6. Managing Cookies</h2>
              <p>You can manage your cookie preferences in the following ways:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Browser Settings</strong> — most browsers allow you to control cookies through their settings. You can block or delete cookies, though this may affect the functionality of the Platform.</li>
                <li><strong>Device Settings</strong> — mobile devices typically offer controls to limit ad tracking and manage cookies in their operating system settings.</li>
                <li><strong>Opt-Out Links</strong> — for targeted advertising, you may use industry opt-out tools such as the Digital Advertising Alliance (DAA) opt-out page or the Network Advertising Initiative (NAI) opt-out page.</li>
              </ul>
              <p>
                Please note that blocking essential cookies may prevent you from using the Platform. If you block functional
                cookies, certain features such as remembered preferences may not work correctly.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">7. Data Retention</h2>
              <p>
                Cookie data is retained for varying periods depending on the type of cookie. Session cookies are deleted
                when you close your browser. Persistent cookies may remain on your device for up to 12 months or until
                you manually delete them. Analytics and tracking data derived from cookies is retained in aggregated form
                as described in our Privacy &amp; Security Statement.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">8. Legal Basis</h2>
              <p>
                Essential cookies are placed on the basis of our legitimate interest in providing a functional and secure
                Platform. Non-essential cookies (functional, analytics, and marketing) are placed on the basis of your
                consent, where required by applicable law (including GDPR and PECR). You may withdraw your consent at
                any time by adjusting your cookie preferences or browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">9. Changes to This Policy</h2>
              <p>
                We may update this Cookie Policy from time to time. Any material changes will be reflected on this page
                with an updated "Last updated" date. We encourage you to review this policy periodically.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">10. Contact</h2>
              <p>
                If you have any questions about our use of cookies or this Cookie Policy, please contact the Client
                using the details provided in their communications, or contact Zendwise LLC for platform-related
                enquiries at the address provided on our website.
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

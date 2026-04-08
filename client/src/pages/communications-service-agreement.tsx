const currentYear = new Date().getFullYear();

export default function CommunicationsServiceAgreementPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#09090B', color: '#A1A1AA', fontFamily: "'DM Sans', -apple-system, sans-serif", padding: '48px 24px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span style={{ color: '#FAFAFA', fontWeight: 600, fontSize: '15px' }}>Zendwise</span>
          </div>
          <h1 style={{ color: '#FAFAFA', fontSize: '2rem', fontWeight: 500, letterSpacing: '-0.03em', marginBottom: '12px', lineHeight: 1.2 }}>
            Communications Service Agreement
          </h1>
          <p style={{ fontSize: '13px', color: '#52525B' }}>
            Effective Date: January 1, 2025 &nbsp;·&nbsp; Last Updated: {currentYear} &nbsp;·&nbsp; Zendwise LLC
          </p>
        </div>

        <div style={{ borderTop: '1px solid #1E1E22', paddingTop: '40px' }}>

          <Section title="1. Introduction and Parties">
            <p>This Communications Service Agreement ("Agreement") is entered into between <strong style={{ color: '#FAFAFA' }}>Zendwise LLC</strong> ("Zendwise", "we", "us", or "our"), a limited liability company, and the individual or entity that has accepted this Agreement ("Client", "you", or "your") by checking the acceptance checkbox during the account registration or plan selection process.</p>
            <p>This Agreement governs your use of the Zendwise platform and services, including but not limited to email marketing, SMS/telephone communications, automated messaging, contact management, analytics, and all related features (collectively, the "Services").</p>
            <p>By accepting this Agreement, you represent that you have the legal authority to bind yourself and, if applicable, your organization to these terms.</p>
          </Section>

          <Section title="2. Scope of Services">
            <p>Zendwise provides a software-as-a-service ("SaaS") platform that enables Clients to compose, schedule, and transmit electronic communications — including email, SMS, and similar messages — to their customers, contacts, and subscribers (collectively, "End Recipients").</p>
            <p>Zendwise acts solely as a <strong style={{ color: '#FAFAFA' }}>technology intermediary and infrastructure provider</strong>. We do not control the content of communications sent by Clients, nor do we have a direct relationship with End Recipients. All communications transmitted through the platform are sent on behalf of the Client and originate from the Client's business.</p>
          </Section>

          <Section title="3. Client Responsibilities and Sole Liability">
            <p>You acknowledge and agree that <strong style={{ color: '#FAFAFA' }}>you are solely and fully responsible</strong> for all communications transmitted through the Zendwise platform, including but not limited to:</p>
            <ul>
              <li>The content, accuracy, and legality of all messages sent to End Recipients;</li>
              <li>Obtaining all necessary consents, permissions, and opt-ins from End Recipients prior to contacting them;</li>
              <li>Maintaining accurate and up-to-date contact lists and suppression/unsubscribe lists;</li>
              <li>Honoring all opt-out, unsubscribe, and do-not-contact requests promptly and in compliance with applicable law;</li>
              <li>Ensuring that all communications are truthful, non-deceptive, and not misleading;</li>
              <li>Complying with all applicable federal, state, provincial, national, and international laws, rules, and regulations governing commercial communications in every jurisdiction in which you operate or in which your End Recipients are located.</li>
            </ul>
            <p>Zendwise assumes no liability for the content of communications sent by Clients or for any violations of law arising from such communications.</p>
          </Section>

          <Section title="4. Compliance with Communications Laws">
            <p>You agree to comply with all applicable laws and regulations governing electronic communications. These include, without limitation:</p>

            <SubSection title="4.1 CAN-SPAM Act (United States)">
              <p>If you send commercial email to recipients in the United States, you must comply with the Controlling the Assault of Non-Solicited Pornography and Marketing Act of 2003 ("CAN-SPAM Act"), including:</p>
              <ul>
                <li>Not using false or misleading header information;</li>
                <li>Not using deceptive subject lines;</li>
                <li>Identifying the message as an advertisement where required;</li>
                <li>Including your valid physical postal address in each message;</li>
                <li>Including a clear and conspicuous opt-out mechanism;</li>
                <li>Honoring opt-out requests within 10 business days;</li>
                <li>Monitoring and controlling the actions of any third parties you hire to handle email marketing.</li>
              </ul>
            </SubSection>

            <SubSection title="4.2 Canada's Anti-Spam Legislation (CASL)">
              <p>If you send commercial electronic messages ("CEMs") to recipients in Canada, you must comply with Canada's Anti-Spam Legislation ("CASL"), including:</p>
              <ul>
                <li>Obtaining express or implied consent from recipients before sending CEMs;</li>
                <li>Identifying yourself and providing contact information in each message;</li>
                <li>Including a functioning unsubscribe mechanism that is honored within 10 business days;</li>
                <li>Maintaining records of consent;</li>
                <li>Not installing computer programs without consent where required.</li>
              </ul>
            </SubSection>

            <SubSection title="4.3 General Data Protection Regulation (GDPR — European Union / EEA / UK)">
              <p>If you process personal data of individuals located in the European Union, European Economic Area, or United Kingdom, you must comply with the General Data Protection Regulation (GDPR) and/or the UK GDPR, including:</p>
              <ul>
                <li>Establishing and documenting a lawful basis for processing personal data (e.g., consent, legitimate interest);</li>
                <li>Providing clear, transparent privacy notices to data subjects;</li>
                <li>Respecting data subject rights including access, erasure, rectification, portability, and objection;</li>
                <li>Not transferring personal data to third countries without appropriate safeguards;</li>
                <li>Implementing appropriate technical and organizational security measures;</li>
                <li>Maintaining records of processing activities.</li>
              </ul>
            </SubSection>

            <SubSection title="4.4 Telephone Consumer Protection Act (TCPA — United States)">
              <p>If you send SMS, MMS, automated telephone calls, or use auto-dialers to contact individuals in the United States, you must comply with the Telephone Consumer Protection Act ("TCPA"), including:</p>
              <ul>
                <li>Obtaining prior express written consent before sending marketing text messages or placing autodialed or pre-recorded calls;</li>
                <li>Providing a clear opt-out mechanism for all text messages;</li>
                <li>Honoring do-not-call requests and maintaining do-not-call lists;</li>
                <li>Not contacting numbers on the National Do Not Call Registry without prior consent;</li>
                <li>Identifying yourself in each pre-recorded message.</li>
              </ul>
            </SubSection>

            <SubSection title="4.5 California Consumer Privacy Act (CCPA / CPRA)">
              <p>If you process personal information of California residents, you must comply with the California Consumer Privacy Act and its amendments under the California Privacy Rights Act, including honoring consumer rights to know, delete, opt out of sale, and correct personal information.</p>
            </SubSection>

            <SubSection title="4.6 Other Applicable Laws">
              <p>You are solely responsible for identifying and complying with all other communications, privacy, and data protection laws applicable to your business and to your End Recipients' jurisdictions, including but not limited to:</p>
              <ul>
                <li>Australia's Spam Act 2003;</li>
                <li>Brazil's Lei Geral de Proteção de Dados (LGPD);</li>
                <li>Japan's Act on the Regulation of Transmission of Specified Electronic Mail;</li>
                <li>Any applicable state, provincial, or local consumer protection laws;</li>
                <li>Industry-specific regulations (e.g., HIPAA for healthcare, FINRA for financial services).</li>
              </ul>
              <p><strong style={{ color: '#FAFAFA' }}>Zendwise makes no representation that use of the Services complies with the laws of any particular jurisdiction.</strong> It is your obligation to seek independent legal counsel to ensure your communications practices are lawful in all applicable jurisdictions.</p>
            </SubSection>
          </Section>

          <Section title="5. Prohibited Uses">
            <p>You agree not to use the Services to:</p>
            <ul>
              <li>Send unsolicited commercial messages ("spam") to any person who has not given verifiable consent;</li>
              <li>Harvest, scrape, purchase, or use contact lists in violation of applicable law or the terms under which those lists were acquired;</li>
              <li>Transmit content that is fraudulent, deceptive, defamatory, obscene, hateful, or otherwise unlawful;</li>
              <li>Impersonate any person or entity, or falsely represent the origin of any message;</li>
              <li>Distribute malware, phishing content, or links to harmful resources;</li>
              <li>Facilitate, promote, or engage in any illegal activity;</li>
              <li>Contact minors in violation of applicable laws;</li>
              <li>Use the Services in a manner that degrades platform performance or harms other Clients or their End Recipients.</li>
            </ul>
            <p>Zendwise reserves the right to suspend or terminate your access to the Services immediately and without notice if we reasonably believe you are engaging in any prohibited use.</p>
          </Section>

          <Section title="6. Indemnification">
            <p>You agree to <strong style={{ color: '#FAFAFA' }}>indemnify, defend, and hold harmless</strong> Zendwise LLC, its members, officers, employees, agents, affiliates, successors, and assigns (collectively, "Zendwise Parties") from and against any and all claims, demands, suits, proceedings, losses, damages, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or relating to:</p>
            <ul>
              <li>Your use of the Services;</li>
              <li>Any communication transmitted by you or on your behalf through the platform;</li>
              <li>Your violation of this Agreement or any applicable law or regulation;</li>
              <li>Your infringement of any third-party right, including privacy, intellectual property, or consumer protection rights;</li>
              <li>Any claim by an End Recipient arising from communications you sent to them;</li>
              <li>Any regulatory investigation, fine, penalty, or enforcement action arising from your use of the Services.</li>
            </ul>
          </Section>

          <Section title="7. Disclaimer of Warranties">
            <p>THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR ACCURACY.</p>
            <p>ZENDWISE DOES NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE FROM VIRUSES OR OTHER HARMFUL COMPONENTS. ZENDWISE DOES NOT GUARANTEE DELIVERABILITY OF ANY COMMUNICATIONS SENT THROUGH THE PLATFORM.</p>
          </Section>

          <Section title="8. Limitation of Liability">
            <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, ZENDWISE LLC AND THE ZENDWISE PARTIES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS OPPORTUNITIES, ARISING OUT OF OR IN CONNECTION WITH THIS AGREEMENT OR THE SERVICES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
            <p>IN NO EVENT SHALL ZENDWISE'S TOTAL CUMULATIVE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THIS AGREEMENT EXCEED THE TOTAL AMOUNTS PAID BY YOU TO ZENDWISE IN THE THREE (3) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM.</p>
          </Section>

          <Section title="9. Data Processing">
            <p>To the extent you transmit personal data of End Recipients through the Services, you acknowledge that:</p>
            <ul>
              <li>You are the data controller and Zendwise acts as your data processor;</li>
              <li>You have a lawful basis for processing such personal data;</li>
              <li>You have provided adequate privacy notices to your End Recipients;</li>
              <li>Your use of the Services constitutes acceptance of Zendwise's Data Processing Agreement, which governs how Zendwise processes personal data on your behalf.</li>
            </ul>
          </Section>

          <Section title="10. Audit and Compliance Records">
            <p>You agree to maintain complete and accurate records of:</p>
            <ul>
              <li>All consents obtained from End Recipients, including the date, method, and scope of each consent;</li>
              <li>All unsubscribe and opt-out requests received and the actions taken in response;</li>
              <li>Any other records required by applicable communications law.</li>
            </ul>
            <p>You agree to provide such records to Zendwise promptly upon request in the event of a complaint or regulatory inquiry involving your use of the Services.</p>
          </Section>

          <Section title="11. Term and Termination">
            <p>This Agreement is effective upon your acceptance and remains in effect for as long as you use the Services. Either party may terminate this Agreement upon written notice. Zendwise may suspend or terminate your access immediately if you breach this Agreement or any applicable law.</p>
            <p>Upon termination, Sections 3 (Client Responsibilities), 6 (Indemnification), 7 (Disclaimer), 8 (Limitation of Liability), 10 (Audit Records), and 13 (Governing Law) shall survive.</p>
          </Section>

          <Section title="12. Modifications">
            <p>Zendwise reserves the right to modify this Agreement at any time. We will provide notice of material changes by posting an updated agreement at the applicable URL and, where required by law, by sending email notice. Your continued use of the Services following notice of any modification constitutes your acceptance of the modified Agreement.</p>
          </Section>

          <Section title="13. Governing Law and Dispute Resolution">
            <p>This Agreement shall be governed by and construed in accordance with the laws of the jurisdiction in which Zendwise LLC is incorporated, without regard to its conflict of law provisions. Any disputes arising under this Agreement shall be resolved through binding arbitration in accordance with commercially reasonable arbitration rules, except that either party may seek injunctive or other equitable relief in a court of competent jurisdiction.</p>
          </Section>

          <Section title="14. Entire Agreement">
            <p>This Agreement, together with Zendwise's Terms of Service, Privacy & Security Statement, Acceptable Use Policy, Data Processing Agreement, and Cookie Policy (collectively, the "Platform Agreements"), constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior agreements, representations, and understandings.</p>
            <p>In the event of any conflict between this Agreement and the Terms of Service, this Agreement shall control with respect to matters relating to communications compliance.</p>
          </Section>

          <Section title="15. Contact">
            <p>If you have questions about this Agreement or your compliance obligations, please contact:</p>
            <p style={{ marginTop: '12px' }}>
              <strong style={{ color: '#FAFAFA' }}>Zendwise LLC — Legal & Compliance</strong><br />
              <a href="mailto:legal@zendwise.com" style={{ color: '#A78BFA', textDecoration: 'none' }}>legal@zendwise.com</a>
            </p>
          </Section>

        </div>

        {/* Footer */}
        <div style={{ marginTop: '56px', paddingTop: '24px', borderTop: '1px solid #1E1E22', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '12px', color: '#3F3F46' }}>
            © {currentYear} Zendwise LLC. All rights reserved.
          </p>
          <p style={{ fontSize: '12px', color: '#27272A' }}>
            CAN-SPAM · CASL · GDPR · TCPA · CCPA/CPRA
          </p>
        </div>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <h2 style={{ color: '#FAFAFA', fontSize: '16px', fontWeight: 600, marginBottom: '16px', letterSpacing: '-0.01em' }}>
        {title}
      </h2>
      <div style={{ fontSize: '14px', lineHeight: '1.75', color: '#71717A', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {children}
      </div>
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: '8px', paddingLeft: '16px', borderLeft: '2px solid #27272A' }}>
      <h3 style={{ color: '#A1A1AA', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {children}
      </div>
    </div>
  );
}

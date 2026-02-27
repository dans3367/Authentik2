import { Link } from "wouter";
import { Shield, FileText, Scale, Mail } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border/40 bg-muted/30 backdrop-blur-sm">
      <div className="px-6 py-6">
        {/* Main Footer Content */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          {/* Brand & Copyright */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground tracking-tight">
                Authentik
              </span>
              <span className="text-xs text-muted-foreground">
                by Zendwise LLC
              </span>
            </div>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              B2B marketing, newsletter, and communication platform.
              Infrastructure &amp; email delivery services provided by Zendwise LLC.
            </p>
          </div>

          {/* Document Links */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Legal Documents
            </span>
            <Link
              href="/privacy-security"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Shield className="h-3 w-3" />
              Privacy &amp; Security Statement
            </Link>
            <Link
              href="/terms-of-service"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Scale className="h-3 w-3" />
              Terms of Service
            </Link>
            <Link
              href="/acceptable-use"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText className="h-3 w-3" />
              Acceptable Use Policy
            </Link>
          </div>

          {/* More Links */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Resources
            </span>
            <Link
              href="/data-processing"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText className="h-3 w-3" />
              Data Processing Agreement
            </Link>
            <Link
              href="/cookie-policy"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText className="h-3 w-3" />
              Cookie Policy
            </Link>
            <a
              href="mailto:support@zendwise.com"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="h-3 w-3" />
              Contact Support
            </a>
          </div>
        </div>

        <Separator className="my-4 opacity-50" />

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            &copy; {currentYear} Zendwise LLC. All rights reserved.
          </p>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>GDPR Compliant</span>
            <span className="text-border">|</span>
            <span>CCPA/CPRA</span>
            <span className="text-border">|</span>
            <span>CAN-SPAM</span>
            <span className="text-border">|</span>
            <span>TCPA</span>
            <span className="text-border">|</span>
            <span>CASL</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

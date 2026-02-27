export function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border/40 bg-muted/30 backdrop-blur-sm">
      <div className="px-6 py-4">
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

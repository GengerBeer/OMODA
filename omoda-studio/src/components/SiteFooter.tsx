import { Link } from 'react-router-dom';
import { LEGAL_BRAND_NAME, LEGAL_COMPANY_NAME } from '@/lib/legal';

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/70 bg-background/70">
      <div className="container flex flex-col gap-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="font-medium text-foreground">{LEGAL_BRAND_NAME}</p>
          <p>{LEGAL_COMPANY_NAME}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/privacy-policy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <Link to="/gdpr-policy" className="transition-colors hover:text-foreground">
            GDPR Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}

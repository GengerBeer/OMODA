import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SiteFooter } from '@/components/SiteFooter';
import { LEGAL_BRAND_NAME } from '@/lib/legal';

interface LegalPageLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function LegalPageLayout({
  eyebrow,
  title,
  description,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-x-0 top-0 -z-10 h-[24rem] bg-[radial-gradient(circle_at_top,_rgba(32,32,32,0.1),_transparent_58%)]" />

      <main className="container py-10 sm:py-14">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="space-y-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to {LEGAL_BRAND_NAME}
            </Link>
            <Badge variant="outline" className="rounded-full px-4 py-1 text-[11px] tracking-[0.18em] uppercase">
              {eyebrow}
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">{title}</h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                {description}
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-border/70 bg-card/90 p-6 shadow-elevated sm:p-8">
            <div className="legal-copy space-y-8 text-sm leading-7 text-muted-foreground sm:text-[15px]">
              {children}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

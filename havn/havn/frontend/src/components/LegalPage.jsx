import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import Logo from "./Logo";
import SiteFooter from "./SiteFooter";

// Shared shell for the marketing-side legal pages (Privacy, Terms). It gives them
// the same warm, flat brand surface as the landing page, a readable single column,
// and the site footer — so a visitor can jump between the two documents and back
// home without ever leaving the brand.
function LegalPage({ title, updated, intro, children }) {
  return (
    <div className="w-full min-h-[100dvh] bg-[#FAF7F2] text-[#141311]">
      <header className="sticky top-0 z-20 border-b border-[#E7DFD4] bg-[#FAF7F2]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" aria-label="Havn home">
            <Logo size={30} />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#57534E] hover:text-[#141311] transition-colors"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16 lg:py-20">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 text-sm font-medium uppercase tracking-[0.14em] text-[#8A7E70]">
          Last updated {updated}
        </p>
        {intro ? <p className="mt-6 text-lg leading-relaxed text-[#57534E]">{intro}</p> : null}
        <div className="mt-12 space-y-10">{children}</div>
      </main>

      <SiteFooter />
    </div>
  );
}

// One numbered section of a legal document. Kept here so both pages share the
// exact same heading rhythm and body colour.
export function LegalSection({ heading, children }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold tracking-tight">{heading}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-[#57534E]">{children}</div>
    </section>
  );
}

export default LegalPage;

import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";

const navLinks = [
  { href: "/today", label: "HOME" },
  { href: "/find", label: "FIND" },
  { href: "/songs", label: "SONGS" },
  { href: "/assistant", label: "AI ASSIST" },
  { href: "/id", label: "ID" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-surface">
      <header className="border-b border-brand-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-full border border-brand-border bg-white">
              <Image
                src="/images/artsafeplace-logo.jpeg"
                alt="ART SAFE PLACE logo"
                width={40}
                height={40}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div>
              <p className="text-sm font-semibold">ART SAFE PLACE</p>
              <p className="text-xs text-brand-muted">PATH + FIND + SONGS + SAFE ID</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs text-brand-muted">
            <Sparkles className="h-4 w-4" />
            <span>AI заглушка</span>
          </div>
        </div>
        <nav className="border-t border-brand-border bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-4 px-6 py-3 text-sm text-brand-muted">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-brand-ink">
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">{children}</main>
    </div>
  );
}

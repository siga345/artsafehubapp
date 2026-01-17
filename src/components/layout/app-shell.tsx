import Link from "next/link";
import { Music2, Sparkles } from "lucide-react";

const navLinks = [
  { href: "/today", label: "Today" },
  { href: "/songs", label: "Songs" },
  { href: "/ideas", label: "Ideas" },
  { href: "/path", label: "PATH" },
  { href: "/hub", label: "Hub" },
  { href: "/studio", label: "Studio" },
  { href: "/learn", label: "Learn" },
  { href: "/assistant", label: "Assistant" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-surface">
      <header className="border-b border-brand-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-ink text-white">
              <Music2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">ART SAFE HUB</p>
              <p className="text-xs text-brand-muted">Artist workspace for CIS beginners</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs text-brand-muted">
            <Sparkles className="h-4 w-4" />
            <span>AI placeholder</span>
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

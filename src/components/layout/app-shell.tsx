"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, Home, MessageCircle, Music2, Search, UserCircle2 } from "lucide-react";
import { usePathname } from "next/navigation";

import { SongsFullPlayerModal } from "@/components/songs/songs-full-player-modal";
import { SongsMiniPlayerDock } from "@/components/songs/songs-mini-player-dock";
import { SongsPlaybackProvider } from "@/components/songs/songs-playback-provider";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/today", label: "Home", icon: Home },
  { href: "/find", label: "Find", icon: Search },
  { href: "/songs", label: "Songs", icon: Music2 },
  { href: "/assistant", label: "Assist", icon: MessageCircle },
  { href: "/id", label: "ID", icon: UserCircle2 }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showBottomNav = pathname !== "/signin";
  const isSongsRoute = pathname === "/songs" || pathname.startsWith("/songs/");

  return (
    <SongsPlaybackProvider>
      <div
        className={cn(
          "min-h-screen",
          showBottomNav ? (isSongsRoute ? "pb-44 md:pb-32" : "pb-36 md:pb-28") : "pb-6"
        )}
      >
        <header className="sticky top-0 z-30 border-b border-brand-border bg-[#eff4e7]/85 backdrop-blur-lg">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-6">
            <Link href="/today" className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-2xl border border-brand-border bg-white">
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
                <p className="text-sm font-semibold tracking-tight text-brand-ink">ART SAFE PLACE</p>
                <p className="text-xs text-brand-muted">Место, где искусство сохраняет нас людьми</p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="app-pill grid h-10 w-10 place-items-center hover:bg-[#e7eee0]"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
              <Link
                href="/assistant"
                className="app-pill group grid h-10 w-10 place-items-center overflow-hidden hover:bg-[#e7eee0]"
                aria-label="Assistant"
                title="Assistant"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white transition-colors group-hover:bg-[#edf2e6] md:h-8 md:w-8">
                  <Image
                    src="/images/assistant-logo-header.png"
                    alt="AI Assistant"
                    width={32}
                    height={32}
                    unoptimized
                    className="h-8 w-8 object-contain md:h-7 md:w-7"
                  />
                </span>
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-6 md:py-8">{children}</main>

        {showBottomNav ? (
          <>
            <SongsMiniPlayerDock />
            <SongsFullPlayerModal />

            <div
              className={cn(
                "fixed inset-x-0 hidden px-4 md:block",
                isSongsRoute ? "bottom-3 z-30" : "bottom-4 z-40"
              )}
            >
              <div
                className={cn(
                  "mx-auto flex w-fit items-center rounded-2xl border border-brand-border bg-[#f6f9f0]/95 shadow-[0_12px_28px_rgba(55,74,61,0.16)] backdrop-blur-xl",
                  isSongsRoute ? "gap-2 px-2 py-2" : "gap-3 px-3 py-2"
                )}
              >
                {navLinks.map((link) => {
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "rounded-full border font-medium leading-none tracking-tight transition-colors",
                        isSongsRoute ? "px-5 py-2 text-xl" : "px-6 py-2 text-2xl",
                        active
                          ? "border-[#2A342C] bg-[#2A342C] text-white"
                          : "border-brand-border bg-white text-brand-muted hover:bg-[#eef3e6] hover:text-brand-ink"
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div
              className={cn(
                "fixed inset-x-0 px-4 md:hidden",
                isSongsRoute ? "bottom-3 z-30" : "bottom-4 z-40"
              )}
            >
              <div
                className={cn(
                  "mx-auto flex items-center justify-between rounded-2xl border border-brand-border bg-[#f6f9f0]/95 shadow-[0_12px_28px_rgba(55,74,61,0.16)] backdrop-blur-xl",
                  isSongsRoute ? "max-w-[360px] px-2 py-2" : "max-w-md px-3 py-2"
                )}
              >
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "grid place-items-center rounded-xl transition-colors",
                        isSongsRoute ? "h-10 w-10" : "h-11 w-11",
                        active ? "bg-[#2A342C] text-white" : "text-brand-muted hover:bg-[#eaf1e3] hover:text-brand-ink"
                      )}
                      aria-label={link.label}
                    >
                      <Icon className="h-5 w-5" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </SongsPlaybackProvider>
  );
}

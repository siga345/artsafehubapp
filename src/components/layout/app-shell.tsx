"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, BookOpen, Home, Music2, Search, UserCircle2, UsersRound } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

import { PathOverlayProvider, usePathOverlay } from "@/components/home/path-overlay";
import { SongsFullPlayerModal } from "@/components/songs/songs-full-player-modal";
import { SongsMiniPlayerDock } from "@/components/songs/songs-mini-player-dock";
import { SongsPlaybackProvider } from "@/components/songs/songs-playback-provider";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/today", label: "Сегодня", icon: Home },
  { href: "/find", label: "Поиск", icon: Search },
  { href: "/songs", label: "Песни", icon: Music2 },
  { href: "/learn", label: "Обучение", icon: BookOpen },
  { href: "/community", label: "Сообщество", icon: UsersRound },
  { href: "/id", label: "Профиль", icon: UserCircle2 }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SongsPlaybackProvider>
      <PathOverlayProvider>
        <AppShellContent>{children}</AppShellContent>
      </PathOverlayProvider>
    </SongsPlaybackProvider>
  );
}

function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { openPathOverlay } = usePathOverlay();
  const isSignInRoute = pathname === "/signin";
  const showBottomNav = !isSignInRoute;
  const isSongsRoute = pathname === "/songs" || pathname.startsWith("/songs/");
  const visibleNavLinks = navLinks.filter((link) => {
    if (link.href !== "/learn") return true;
    return session?.user?.role === "ARTIST";
  });

  function isActiveLink(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div
      className={cn(
        "min-h-screen",
        showBottomNav ? (isSongsRoute ? "pb-40 md:pb-32" : "pb-32 md:pb-28") : "pb-4 md:pb-6"
      )}
    >
      {!isSignInRoute && (
        <header className="sticky top-0 z-30 border-b border-brand-border bg-[#eff4e7]/85 backdrop-blur-lg">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-3 py-2.5 md:px-6 md:py-3">
            <Link href="/today" className="flex items-center gap-2.5 md:gap-3">
              <div className="h-9 w-9 overflow-hidden rounded-xl border border-brand-border bg-white md:h-10 md:w-10 md:rounded-2xl">
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
                <p className="text-[13px] font-semibold tracking-tight text-brand-ink md:text-sm">ART SAFE PLACE</p>
                <p className="text-[11px] leading-tight text-brand-muted md:text-xs">
                  Место, где искусство сохраняет нас людьми
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-1.5 md:gap-2">
              <button
                type="button"
                className="app-pill grid h-9 w-9 place-items-center hover:bg-[#e7eee0] md:h-10 md:w-10"
                aria-label="Уведомления"
              >
                <Bell className="h-4 w-4 md:h-4 md:w-4" />
              </button>
              <button
                type="button"
                className="app-pill grid h-9 w-9 place-items-center overflow-hidden hover:bg-[#e7eee0] md:h-10 md:w-10"
                aria-label="Открыть PATH"
                title="PATH"
                onClick={openPathOverlay}
              >
                <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-white md:h-8 md:w-8">
                  <Image
                    src="/images/background-removed-toolpix%201.png"
                    alt="PATH"
                    width={32}
                    height={32}
                    className="h-6 w-6 object-cover md:h-7 md:w-7"
                  />
                </span>
              </button>
              <Link
                href="/assistant"
                className="app-pill grid h-9 w-9 place-items-center hover:bg-[#e7eee0] md:h-10 md:w-10"
                aria-label="Ассистент"
                title="Ассистент"
              >
                <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-white md:h-9 md:w-9">
                  <Image
                    src="/images/assistant-logo-header.png"
                    alt="AI Assistant"
                    width={32}
                    height={32}
                    unoptimized
                    className="h-7 w-7 scale-110 object-contain md:h-8 md:w-8"
                  />
                </span>
              </Link>
            </div>
          </div>
        </header>
      )}

      <main
        className={cn(
          "mx-auto w-full max-w-7xl space-y-6 px-4 md:px-6",
          isSignInRoute ? "py-4 md:py-6" : "py-4 md:py-8"
        )}
      >
        {children}
      </main>

      {showBottomNav ? (
        <>
          <SongsMiniPlayerDock />
          <SongsFullPlayerModal />
          <div
            className={cn(
              "fixed inset-x-0 hidden px-4 md:block",
              isSongsRoute ? "bottom-4 z-30" : "bottom-4 z-40"
            )}
          >
            <div
              className={cn(
                "mx-auto flex w-fit items-center rounded-2xl border border-brand-border bg-[#f6f9f0]/95 shadow-[0_12px_28px_rgba(55,74,61,0.16)] backdrop-blur-xl",
                "gap-3 px-3 py-2"
              )}
            >
              {visibleNavLinks.map((link) => {
                const active = isActiveLink(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-full border font-medium leading-none tracking-tight transition-colors",
                      "px-6 py-2 text-2xl",
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
              isSongsRoute ? "bottom-4 z-30" : "bottom-4 z-40"
            )}
          >
            <div
              className={cn(
                "mx-auto flex items-center justify-between rounded-2xl border border-brand-border bg-[#f6f9f0]/95 shadow-[0_12px_28px_rgba(55,74,61,0.16)] backdrop-blur-xl",
                "max-w-md px-2.5 py-1.5"
              )}
            >
              {visibleNavLinks.map((link) => {
                const Icon = link.icon;
                const active = isActiveLink(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "grid place-items-center rounded-xl transition-colors",
                      "h-10 w-10",
                      active ? "bg-[#2A342C] text-white" : "text-brand-muted hover:bg-[#eaf1e3] hover:text-brand-ink"
                    )}
                    aria-label={link.label}
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

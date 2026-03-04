import "./globals.css";

import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "ART SAFE PLACE",
  description: "Artist workspace to turn ideas into releases"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="font-[var(--font-space-grotesk)]">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}

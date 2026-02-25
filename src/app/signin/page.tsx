"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { ArrowRight, KeyRound, Mail, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md flex-col justify-center px-4 py-4 md:px-0 md:py-8">
      <div className="mb-4 space-y-1 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-brand-muted">ART SAFE PLACE</p>
        <h1 className="text-3xl font-semibold tracking-tight text-brand-ink">Welcome Back</h1>
      </div>

      <Card className="relative overflow-hidden border-brand-border bg-white/90 p-0 shadow-[0_16px_36px_rgba(61,84,46,0.12)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.42),transparent_36%)]" />
        <div className="relative p-4">
          <div className="mb-4 overflow-hidden rounded-2xl border border-brand-border bg-gradient-to-br from-[#eef7e4] via-[#e8f1de] to-[#dfead2] p-3 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Badge className="border-[#cbdab8] bg-white/80 text-[#4b6440]">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                ART SAFE
              </Badge>
            </div>
            <p className="text-sm font-medium text-brand-ink">Войти в ART SAFE</p>
          </div>

          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              await signIn("credentials", { email, password, callbackUrl: "/today" });
            }}
          >
            <div className="rounded-2xl border border-brand-border bg-white/75 p-3 shadow-sm">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="bg-white pl-9"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-brand-border bg-white/75 p-3 shadow-sm">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <Input
                  type="password"
                  placeholder="Пароль"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="bg-white pl-9"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-brand-border bg-white/70 p-3 shadow-sm">
              <Button type="submit" className="w-full rounded-xl">
                <span className="inline-flex items-center gap-2">
                  <span>Войти в ART SAFE</span>
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}

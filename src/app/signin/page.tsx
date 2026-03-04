"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Mail, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InlineActionMessage } from "@/components/ui/inline-action-message";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("/today");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackUrlParam = params.get("callbackUrl");
    setCallbackUrl(callbackUrlParam && callbackUrlParam.startsWith("/") ? callbackUrlParam : "/today");
  }, []);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md flex-col justify-center px-4 py-4 md:px-0 md:py-8">
      <div className="mb-4 space-y-1 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-brand-muted">ART SAFE PLACE</p>
        <h1 className="text-3xl font-semibold tracking-tight text-brand-ink">С возвращением</h1>
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
              setSubmitting(true);
              setFormError("");
              try {
                const result = await signIn("credentials", { email, password, callbackUrl, redirect: false });
                if (!result) {
                  throw new Error("Не удалось выполнить вход.");
                }
                if (result.error) {
                  setFormError("Проверь e-mail и пароль.");
                  return;
                }

                const nextUrl = result.url && result.url.startsWith("/") ? result.url : callbackUrl;
                router.push(nextUrl);
                router.refresh();
              } catch (error) {
                setFormError(error instanceof Error ? error.message : "Не удалось выполнить вход.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {formError ? <InlineActionMessage message={formError} /> : null}
            <div className="rounded-2xl border border-brand-border bg-white/75 p-3 shadow-sm">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <Input
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={submitting}
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
                  disabled={submitting}
                  className="bg-white pl-9"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-brand-border bg-white/70 p-3 shadow-sm">
              <Button type="submit" className="w-full rounded-xl" disabled={submitting}>
                <span className="inline-flex items-center gap-2">
                  <span>{submitting ? "Входим..." : "Войти в ART SAFE"}</span>
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

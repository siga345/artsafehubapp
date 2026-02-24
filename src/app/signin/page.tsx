"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="space-y-1 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-brand-muted">ART SAFE</p>
        <h1 className="text-3xl font-semibold tracking-tight text-brand-ink">Welcome Back</h1>
      </div>
      <Card className="app-glass">
        <CardHeader>
          <CardTitle>Вход в рабочее пространство</CardTitle>
          <CardDescription>Используйте демо-логин из README.</CardDescription>
        </CardHeader>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            await signIn("credentials", { email, password, callbackUrl: "/today" });
          }}
        >
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" className="w-full">
            Войти в ART SAFE
          </Button>
        </form>
      </Card>
    </div>
  );
}

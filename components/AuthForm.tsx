"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { Field, Notice } from "@/components/ui";
import type { FormState } from "@/app/actions";

export function AuthForm({ mode, action }: { mode: "login" | "signup"; action: (s: FormState, f: FormData) => Promise<FormState> }) {
  const [state, submit, pending] = useActionState(action, undefined);
  const login = mode === "login";
  return (
    <form action={submit} className="flex flex-col gap-4" noValidate>
      {!login && (
        <Field label="Full name" required>
          <input name="name" className="input" autoComplete="name" required maxLength={100} />
        </Field>
      )}
      <Field label="Email" required>
        <input name="email" type="email" className="input" autoComplete="email" required />
      </Field>
      <Field label="Password" required help={login ? undefined : "At least 8 characters."}>
        <input name="password" type="password" className="input" autoComplete={login ? "current-password" : "new-password"} required minLength={login ? 1 : 8} />
      </Field>
      {state?.error && <Notice tone="bad">{state.error}</Notice>}
      <button type="submit" className="btn btn-primary" style={{ height: 40 }} disabled={pending}>
        {login ? <LogIn size={16} aria-hidden /> : <UserPlus size={16} aria-hidden />}
        {pending ? "Please wait…" : login ? "Sign in" : "Create account"}
      </button>
      <p className="muted" style={{ fontSize: 13, textAlign: "center", margin: 0 }}>
        {login ? (
          <>New here? <Link href="/signup" className="ink" style={{ fontWeight: 600 }}>Sign up</Link> — an admin then gives you access.</>
        ) : (
          <>Have an account? <Link href="/login" className="ink" style={{ fontWeight: 600 }}>Sign in</Link></>
        )}
      </p>
    </form>
  );
}

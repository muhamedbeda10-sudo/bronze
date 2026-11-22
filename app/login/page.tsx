import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { AuthPage } from "@/components/AuthPage";
import { loginAction } from "@/app/actions";
import { getUser } from "@/lib/server/auth";
import { homePath } from "@/lib/domain/access";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect(homePath(user.access));
  return (
    <AuthPage title="Sign in" sub="Welcome back — sign in to run the foundry.">
      <AuthForm mode="login" action={loginAction} />
    </AuthPage>
  );
}

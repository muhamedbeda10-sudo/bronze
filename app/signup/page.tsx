import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { AuthPage } from "@/components/AuthPage";
import { signupAction } from "@/app/actions";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <AuthPage title="Create your account" sub="You will see the Dashboard until an admin gives you your menus.">
      <AuthForm mode="signup" action={signupAction} />
    </AuthPage>
  );
}

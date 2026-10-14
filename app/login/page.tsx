import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { getAuthProviders } from "@/lib/auth-providers";

export const metadata: Metadata = { title: "Log in or sign up" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" />}>
        <Login />
      </Suspense>
    </div>
  );
}

async function Login() {
  return <LoginForm providers={await getAuthProviders()} />;
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in or sign up" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}

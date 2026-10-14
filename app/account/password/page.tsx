import type { Metadata } from "next";
import { PasswordForm } from "@/components/account/password-form";

export const metadata: Metadata = { title: "Set a new password" };

/** Reached from Account → Change password, or from the "reset your password" email (via /auth/callback). */
export default function PasswordPage() {
  return (
    <div className="mx-auto max-w-md">
      <PasswordForm />
    </div>
  );
}

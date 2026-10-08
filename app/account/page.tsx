import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccount, ProfileForm } from "@/components/account/account-forms";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const id = claims?.claims?.sub as string;
  const { data: profile } = await supabase.from("profiles").select("display_name, locale, role, phone, sheet_public").eq("id", id).single();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-extrabold text-brand-dark">{t("nav.account")}</h1>
      <p className="text-sm text-muted-foreground">
        {(claims?.claims?.email as string | undefined) ?? profile?.phone}
      </p>
      <ProfileForm displayName={profile?.display_name ?? ""} locale={profile?.locale ?? "en"} sheetPublic={profile?.sheet_public ?? false} />

      <nav aria-label={t("account.shortcuts")} className="grid gap-2 sm:grid-cols-2">
        {[
          ["/my/listings", t("nav.my_store")],
          ["/business", t("biz.title")],
          ["/cart", t("cart.title")],
          ["/orders", t("orders.title")],
          ["/my/shipping", t("shipset.title")],
          ["/sell/verify", t("verify.title")],
          ["/my/cases", t("cases.title")],
          ["/notifications", t("notif.title")],
          ["/check", t("nav.check_full")],
          [`/buyer/${id}`, t("sheet.buyer_title")],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="flex min-h-12 items-center rounded-xl border border-border bg-white px-4 font-semibold text-brand-dark hover:bg-muted">
            {label}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap gap-2">
        {(profile?.role === "admin" || profile?.role === "moderator") && (
          <Link href="/admin" className={buttonClass("primary")}>
            {t("admin.title")}
          </Link>
        )}
      </div>

      <section className="space-y-2 rounded-2xl border border-border bg-white p-4">
        <h2 className="font-bold text-brand-dark">{t("account.privacy")}</h2>
        <p className="text-sm text-muted-foreground">{t("account.privacy_body")}</p>
        <a href="/account/export" download className={buttonClass("outline", "md", "gap-2")}>
          <Download size={16} aria-hidden /> {t("account.export")}
        </a>
      </section>
      <DeleteAccount />
    </div>
  );
}

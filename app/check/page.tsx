import { Search, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Check muna bago bayad",
  description: "Look up a phone number, GCash name or store before you pay. Shows only seller flags confirmed by MarketplacePH after review.",
};

export default function CheckPage(props: PageProps<"/check">) {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
        <Checker searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Checker({ searchParams }: Pick<PageProps<"/check">, "searchParams">) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.slice(0, 80).trim() ?? "";
  const { t } = await getT();

  let results: { match_kind: string; label: string; flagged_at: string; expires_at: string }[] | null = null;
  if (q.length >= 4) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("check_before_pay", { p_query: q });
    results = data ?? [];
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("check.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("check.subtitle")}</p>
      </div>

      <form action="/check" role="search" className="space-y-2 rounded-2xl border border-border bg-white p-4">
        <label htmlFor="q" className="text-sm font-semibold text-brand-dark">
          {t("check.label")}
        </label>
        <div className="flex gap-2">
          <Input id="q" name="q" defaultValue={q} minLength={4} maxLength={80} required placeholder={t("check.placeholder")} autoComplete="off" />
          <Button type="submit" aria-label={t("check.button")}>
            <Search size={18} aria-hidden /> <span className="hidden sm:inline">{t("check.button")}</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("check.exact")}</p>
      </form>

      {results && results.length > 0 && (
        <section aria-live="polite" className="space-y-3">
          {results.map((r, i) => (
            <div key={i} role="alert" className="flex gap-3 rounded-2xl border border-danger/40 bg-danger-soft p-4 text-danger">
              <ShieldAlert className="mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="font-bold">{t("check.flagged", { label: r.label })}</p>
                <p className="text-sm">{t("flag.body", { date: new Date(r.flagged_at).toLocaleDateString("en-PH", { month: "long", year: "numeric" }) })}</p>
                <p className="mt-1 text-xs">{t("check.flag_expires", { date: new Date(r.expires_at).toLocaleDateString("en-PH", { month: "short", year: "numeric" }) })}</p>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{t("check.flag_note")}</p>
        </section>
      )}

      {results && results.length === 0 && (
        <section aria-live="polite" className="flex gap-3 rounded-2xl border border-border bg-white p-4">
          <ShieldCheck className="mt-0.5 shrink-0 text-brand" aria-hidden />
          <div>
            <p className="font-bold text-brand-dark">{t("check.none_title")}</p>
            <p className="text-sm text-muted-foreground">{t("check.none_body")}</p>
          </div>
        </section>
      )}

      <section className="rounded-2xl bg-brand-soft p-4 text-sm text-brand-dark">
        <p className="font-bold">{t("check.tips_title")}</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>{t("check.tip1")}</li>
          <li>{t("check.tip2")}</li>
          <li>{t("check.tip3")}</li>
        </ul>
      </section>
    </>
  );
}

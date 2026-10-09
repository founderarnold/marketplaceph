import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  addBannedKeyword, addCategory, decideAppeal, decideCase, openCase, removeBannedKeyword, setEvidenceShareable,
  setListingStatus, setStoreVerification, setUserRole, toggleCategory,
} from "@/app/actions/admin";
import { Disputes } from "@/app/admin/disputes";
import { JobsAdmin } from "@/app/admin/jobs";
import { Plans } from "@/app/admin/plans";
import { purgeExpiredDocuments, reviewVerification } from "@/app/actions/verification";
import { DocButton } from "@/components/admin/doc-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { nowMs, timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const TABS = ["cases", "appeals", "disputes", "plans", "jobs", "verification", "watchlist", "listings", "stores", "users", "categories", "banned", "audit"] as const;
type Tab = (typeof TABS)[number];

export default function AdminPage(props: PageProps<"/admin">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <Admin searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Admin({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "cases";
  const err = typeof sp.err === "string" ? sp.err : null;
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", me).single();
  if (profile?.role !== "admin" && profile?.role !== "moderator") redirect("/");
  const isAdmin = profile.role === "admin";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-brand-dark">{t("admin.title")}</h1>
      <nav className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1 text-sm font-semibold" aria-label="Admin sections">
        {TABS.map((x) => (
          <Link key={x} href={`/admin?tab=${x}`} aria-current={tab === x ? "page" : undefined} className={cn("whitespace-nowrap rounded-lg px-3 py-2", tab === x ? "bg-white text-brand shadow-sm" : "text-muted-foreground")}>
            {t(`admin.tab.${x}`)}
          </Link>
        ))}
      </nav>
      {err && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger">
          {err}
        </p>
      )}
      {tab === "cases" && <Cases isAdmin={isAdmin} />}
      {tab === "appeals" && <Appeals isAdmin={isAdmin} />}
      {tab === "disputes" && <Disputes isAdmin={isAdmin} />}
      {tab === "plans" && <Plans isAdmin={isAdmin} />}
      {tab === "jobs" && <JobsAdmin />}
      {tab === "verification" && <Verification />}
      {tab === "watchlist" && <Watchlist />}
      {tab === "listings" && <Listings />}
      {tab === "stores" && <Stores canEdit={isAdmin} />}
      {tab === "users" && <Users canEdit={isAdmin} me={me} />}
      {tab === "categories" && <Categories canEdit={isAdmin} />}
      {tab === "banned" && <Banned canEdit={isAdmin} />}
      {tab === "audit" && <Audit />}
    </div>
  );
}

const card = "rounded-2xl border border-border bg-white p-3 text-sm";
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—");
const OPEN = ["open", "reviewing", "under_review"];

/* ───────── Cases ───────── */
async function Cases({ isAdmin }: { isAdmin: boolean }) {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: reports } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(60);
  if (!reports?.length) return <p className="rounded-2xl bg-muted p-6 text-center">{t("admin.none")}</p>;

  const ids = reports.map((r) => r.id);
  const [{ data: evidence }, { data: responses }] = await Promise.all([
    supabase.from("report_evidence").select("id, report_id, note, shareable").in("report_id", ids),
    supabase.from("report_responses").select("report_id, body, created_at").in("report_id", ids),
  ]);
  const people = [...new Set(reports.flatMap((r) => [r.reporter_id, r.accused_id]).filter(Boolean) as string[])];
  const { data: names } = await supabase.from("profiles").select("id, display_name").in("id", people);
  const nm = new Map((names ?? []).map((n) => [n.id, n.display_name]));
  const now = nowMs();

  return (
    <ul className="space-y-3">
      {reports.map((r) => {
        const ev = (evidence ?? []).filter((e) => e.report_id === r.id);
        const resp = (responses ?? []).find((x) => x.report_id === r.id);
        const awaiting = r.status === "awaiting_response";
        const windowOpen = awaiting && r.response_due_at && new Date(r.response_due_at).getTime() > now;
        const decided = !!r.decided_at;
        return (
          <li key={r.id} className={card}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{t(`report.reason.${r.reason}`)}</Badge>
              <span className="font-semibold">{t(`cases.target.${r.target_type}`)}</span>
              {r.target_type === "listing" && <Link className="text-brand underline" href={`/listing/${r.target_id}`}>{t("admin.open")}</Link>}
              {r.accused_store_id && <Link className="text-brand underline" href={`/admin?tab=stores`}>{t("admin.tab.stores")}</Link>}
              <Badge tone={["flagged", "restricted"].includes(r.status) ? "danger" : decided ? "neutral" : "brand"} className="ml-auto">{t(`case.status.${r.status}`)}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("admin.reporter")}: <b>{nm.get(r.reporter_id) ?? "—"}</b> → {t("admin.accused")}: <b>{r.accused_id ? (nm.get(r.accused_id) ?? "—") : "—"}</b> · {timeAgo(r.created_at)}
            </p>
            {r.details && <p className="mt-2 whitespace-pre-line rounded-xl bg-muted p-2">{r.details}</p>}

            {ev.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">{t("admin.evidence")}</p>
                {ev.map((e, i) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-2">
                    <DocButton kind="evidence" id={e.id} label={`${t("cases.evidence")} ${i + 1}${e.note ? ` — ${e.note}` : ""}`} />
                    <form action={setEvidenceShareable.bind(null, e.id, !e.shareable)}>
                      <button className="min-h-10 text-xs font-semibold text-brand underline">{e.shareable ? t("admin.shared_with_accused") : t("admin.share_with_accused")}</button>
                    </form>
                  </div>
                ))}
              </div>
            )}

            {resp && (
              <div className="mt-2 rounded-xl border border-accent/40 bg-accent-soft p-2">
                <p className="text-xs font-semibold text-accent-strong">{t("admin.their_response")} · {timeAgo(resp.created_at)}</p>
                <p className="whitespace-pre-line">{resp.body}</p>
              </div>
            )}

            {r.decision_note && <p className="mt-2 text-xs text-muted-foreground">{t("cases.decision")}: {r.decision_note}</p>}

            {OPEN.includes(r.status) && (
              <form action={openCase.bind(null, r.id)} className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <label className="text-xs font-semibold">{t("admin.window_days")}</label>
                <Input name="days" type="number" min={3} max={30} defaultValue={7} className="h-10 w-20" />
                <Button size="sm" type="submit">{t("admin.open_case")}</Button>
                <span className="text-xs text-muted-foreground">{t("admin.open_case_hint")}</span>
              </form>
            )}

            {!decided && (OPEN.includes(r.status) || awaiting) && (
              <form action={decideCase.bind(null, r.id)} className="mt-3 space-y-2 border-t border-border pt-3">
                {awaiting && (
                  <p className={cn("text-xs font-semibold", windowOpen && !resp ? "text-danger" : "text-success")}>
                    {resp ? t("admin.can_decide_responded") : windowOpen ? t("admin.window_open", { date: fmt(r.response_due_at) }) : t("admin.can_decide_expired")}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Select name="outcome" defaultValue={awaiting ? "warning" : "dismissed"} className="h-10 w-auto">
                    <option value="dismissed">{t("case.status.dismissed")}</option>
                    {awaiting && <option value="warning">{t("case.status.warning")}</option>}
                    {awaiting && <option value="restricted">{t("case.status.restricted")}</option>}
                    {awaiting && isAdmin && <option value="flagged">{t("case.status.flagged")}</option>}
                  </Select>
                  <Input name="restrict_days" type="number" min={1} max={90} defaultValue={7} className="h-10 w-24" aria-label={t("admin.restrict_days")} title={t("admin.restrict_days")} />
                  <Input name="flag_months" type="number" min={1} max={36} defaultValue={12} className="h-10 w-24" aria-label={t("admin.flag_months")} title={t("admin.flag_months")} />
                  <Input name="gcash_name" placeholder={t("admin.gcash_name")} className="h-10 min-w-40 flex-1" />
                </div>
                <Textarea name="note" placeholder={t("admin.decision_note")} className="min-h-16" />
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" type="submit">{t("admin.decide")}</Button>
                  <span className="text-xs text-muted-foreground">{t("admin.decide_hint")}</span>
                </div>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ───────── Appeals ───────── */
async function Appeals({ isAdmin }: { isAdmin: boolean }) {
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase
    .from("appeals")
    .select("id, body, status, created_at, decision_note, reports ( reason, status, decision_note, target_type )")
    .order("created_at", { ascending: false })
    .limit(50);
  if (!data?.length) return <p className="rounded-2xl bg-muted p-6 text-center">{t("admin.none")}</p>;
  return (
    <ul className="space-y-3">
      {data.map((a) => (
        <li key={a.id} className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={a.status === "pending" ? "accent" : a.status === "overturned" ? "success" : "neutral"}>{t(`appeal.status.${a.status}`)}</Badge>
            {a.reports && <span className="font-semibold">{t(`report.reason.${a.reports.reason}`)} · {t(`cases.target.${a.reports.target_type}`)}</span>}
            <span className="ml-auto text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
          </div>
          {a.reports?.decision_note && <p className="mt-1 text-xs text-muted-foreground">{t("cases.decision")}: {a.reports.decision_note}</p>}
          <p className="mt-2 whitespace-pre-line rounded-xl bg-muted p-2">{a.body}</p>
          {a.status === "pending" && isAdmin && (
            <form action={decideAppeal.bind(null, a.id)} className="mt-3 space-y-2 border-t border-border pt-3">
              <div className="flex flex-wrap gap-2">
                <Select name="outcome" defaultValue="upheld" className="h-10 w-auto">
                  <option value="upheld">{t("appeal.status.upheld")}</option>
                  <option value="overturned">{t("appeal.status.overturned")}</option>
                </Select>
                <Input name="note" placeholder={t("admin.decision_note")} className="h-10 min-w-48 flex-1" />
                <Button size="sm" type="submit">{t("admin.decide")}</Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("admin.appeal_hint")}</p>
            </form>
          )}
          {a.status === "pending" && !isAdmin && <p className="mt-2 text-xs text-muted-foreground">{t("admin.admin_only")}</p>}
          {a.decision_note && <p className="mt-2 text-xs text-muted-foreground">{t("cases.decision")}: {a.decision_note}</p>}
        </li>
      ))}
    </ul>
  );
}

/* ───────── Verification ───────── */
async function Verification() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_verifications")
    .select("id, target_level, status, submitted_at, reviewer_note, stores ( name, slug, verification_level ), verification_documents ( id, doc_type, retain_until )")
    .order("submitted_at", { ascending: false })
    .limit(50);
  const expired = (data ?? []).flatMap((v) => v.verification_documents).filter((d) => d.retain_until && new Date(d.retain_until).getTime() < nowMs()).length;
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-brand-soft p-3 text-xs text-brand-dark">{t("admin.docs_notice")}</p>
      {expired > 0 && (
        <form action={purgeExpiredDocuments} className="flex items-center gap-2">
          <Button size="sm" variant="outline" type="submit">{t("admin.purge", { n: expired })}</Button>
        </form>
      )}
      {!data?.length && <p className="rounded-2xl bg-muted p-6 text-center">{t("admin.none")}</p>}
      <ul className="space-y-3">
        {data?.map((v) => (
          <li key={v.id} className={card}>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/store/${v.stores?.slug}`} className="font-semibold hover:underline">{v.stores?.name}</Link>
              <Badge tone="brand">{v.target_level === 3 ? t("verify.business") : t("verify.id")}</Badge>
              <Badge tone={v.status === "approved" ? "success" : v.status === "pending" ? "accent" : "danger"} className="ml-auto">{t(`verify.status.${v.status}`)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{timeAgo(v.submitted_at)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {v.verification_documents.map((d) => (
                <DocButton key={d.id} kind="verification" id={d.id} label={t(`doc.${d.doc_type}`)} />
              ))}
              {v.verification_documents.length === 0 && <span className="text-xs text-muted-foreground">{t("admin.docs_deleted")}</span>}
            </div>
            {v.status === "pending" && (
              <form action={reviewVerification.bind(null, v.id)} className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                <Select name="decision" defaultValue="approved" className="h-10 w-auto">
                  <option value="approved">{t("verify.status.approved")}</option>
                  <option value="needs_more">{t("verify.status.needs_more")}</option>
                  <option value="rejected">{t("verify.status.rejected")}</option>
                </Select>
                <Input name="note" placeholder={t("admin.note_to_seller")} className="h-10 min-w-48 flex-1" />
                <Button size="sm" type="submit">{t("common.save")}</Button>
              </form>
            )}
            {v.reviewer_note && <p className="mt-2 text-xs">{t("verify.reviewer_note")}: {v.reviewer_note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────── Watchlist ───────── */
async function Watchlist() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("watchlist_entries").select("*").order("flagged_at", { ascending: false }).limit(100);
  if (!data?.length) return <p className="rounded-2xl bg-muted p-6 text-center">{t("admin.none")}</p>;
  const now = nowMs();
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t("admin.watchlist_hint")}</p>
      <ul className="space-y-2">
        {data.map((w) => {
          const live = w.status === "active" && new Date(w.expires_at).getTime() > now;
          const reviewDue = live && new Date(w.review_on).getTime() < now;
          return (
            <li key={w.id} className={card}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{w.store_name ?? w.gcash_name ?? w.phone ?? "—"}</span>
                <Badge tone={live ? "danger" : "neutral"}>{live ? t("admin.live") : w.status === "revoked" ? t("admin.revoked") : t("admin.expired")}</Badge>
                {reviewDue && <Badge tone="accent">{t("admin.review_due")}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {w.phone ?? "—"} · GCash: {w.gcash_name ?? "—"} · {t("admin.flagged")} {fmt(w.flagged_at)} · {t("admin.review_on")} {fmt(w.review_on)} · {t("admin.expires")} {fmt(w.expires_at)}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ───────── Existing management tabs ───────── */
async function Listings() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("listings").select("id, title, status, created_at, stores(name)").order("created_at", { ascending: false }).limit(100);
  return (
    <ul className="space-y-2">
      {(data ?? []).map((l) => (
        <li key={l.id} className={cn(card, "flex flex-wrap items-center gap-2")}>
          <Link href={`/listing/${l.id}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">{l.title}</Link>
          <span className="text-xs text-muted-foreground">{l.stores?.name}</span>
          <form action={setListingStatus.bind(null, l.id)} className="flex gap-2">
            <Select name="status" defaultValue={l.status} className="h-10 w-auto">
              {["active", "hidden", "removed"].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Button size="sm" variant="outline" type="submit">{t("common.save")}</Button>
          </form>
        </li>
      ))}
    </ul>
  );
}

async function Stores({ canEdit }: { canEdit: boolean }) {
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("stores").select("id, name, slug, seller_type, verification_level").order("created_at", { ascending: false }).limit(100);
  return (
    <ul className="space-y-2">
      {(data ?? []).map((s) => (
        <li key={s.id} className={cn(card, "flex flex-wrap items-center gap-2")}>
          <Link href={`/store/${s.slug}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">{s.name}</Link>
          <span className="text-xs text-muted-foreground">{t(`seller.${s.seller_type}`)}</span>
          {canEdit && (
            <form action={setStoreVerification.bind(null, s.id)} className="flex gap-2">
              <Select name="level" defaultValue={String(s.verification_level)} className="h-10 w-auto">
                {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{t(["verify.none", "verify.phone", "verify.id", "verify.business"][n])}</option>)}
              </Select>
              <Button size="sm" variant="outline" type="submit">{t("common.save")}</Button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

async function Users({ canEdit, me }: { canEdit: boolean; me: string }) {
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, display_name, role, created_at, restricted_until").order("created_at", { ascending: false }).limit(200);
  return (
    <ul className="space-y-2">
      {(data ?? []).map((u) => (
        <li key={u.id} className={cn(card, "flex flex-wrap items-center gap-2")}>
          <span className="min-w-0 flex-1 truncate font-semibold">{u.display_name}</span>
          {u.restricted_until && new Date(u.restricted_until).getTime() > nowMs() && <Badge tone="danger">{t("admin.restricted_until", { date: fmt(u.restricted_until) })}</Badge>}
          <span className="text-xs text-muted-foreground">{timeAgo(u.created_at)}</span>
          {canEdit && u.id !== me ? (
            <form action={setUserRole.bind(null, u.id)} className="flex gap-2">
              <Select name="role" defaultValue={u.role} className="h-10 w-auto">
                {["user", "moderator", "admin"].map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
              <Button size="sm" variant="outline" type="submit">{t("common.save")}</Button>
            </form>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{u.role}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

async function Categories({ canEdit }: { canEdit: boolean }) {
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, slug, name_en, name_fil, is_active, tab").is("parent_id", null).order("sort_order");
  return (
    <div className="space-y-3">
      {canEdit && (
        <form action={addCategory} className={cn(card, "grid gap-2 sm:grid-cols-4")}>
          <Input name="slug" placeholder="slug-like-this" required className="h-10" />
          <Input name="name_en" placeholder="English name" required className="h-10" />
          <Input name="name_fil" placeholder="Filipino name" required className="h-10" />
          <Button type="submit" size="sm">{t("admin.add")}</Button>
        </form>
      )}
      <ul className="space-y-2">
        {(data ?? []).map((c) => (
          <li key={c.id} className={cn(card, "flex items-center gap-2")}>
            <span className="flex-1">{c.name_en} <span className="text-muted-foreground">/ {c.name_fil}</span></span>
            {canEdit && (
              <form action={toggleCategory.bind(null, c.id, !c.is_active)}>
                <Button size="sm" variant="outline" type="submit">{c.is_active ? t("admin.disable") : t("admin.enable")}</Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

async function Banned({ canEdit }: { canEdit: boolean }) {
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("banned_keywords").select("id, keyword, reason").order("keyword");
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("admin.banned_hint")}</p>
      {canEdit && (
        <form action={addBannedKeyword} className={cn(card, "grid gap-2 sm:grid-cols-3")}>
          <Input name="keyword" placeholder="keyword" required className="h-10" />
          <Input name="reason" placeholder="reason" required className="h-10" />
          <Button type="submit" size="sm">{t("admin.add")}</Button>
        </form>
      )}
      <ul className="space-y-2">
        {(data ?? []).map((k) => (
          <li key={k.id} className={cn(card, "flex items-center gap-2")}>
            <span className="font-semibold">{k.keyword}</span>
            <span className="flex-1 text-muted-foreground">{k.reason}</span>
            {canEdit && (
              <form action={removeBannedKeyword.bind(null, k.id)}>
                <Button size="sm" variant="ghost" type="submit">{t("my.delete")}</Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

async function Audit() {
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data }, { data: docLogs }] = await Promise.all([
    supabase.from("audit_logs").select("id, actor_id, action, table_name, record_id, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("document_access_logs").select("id, admin_id, kind, document_id, created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  const ids = [...new Set([...(data ?? []).map((a) => a.actor_id), ...(docLogs ?? []).map((d) => d.admin_id)].filter(Boolean) as string[])];
  const { data: names } = ids.length ? await supabase.from("profiles").select("id, display_name").in("id", ids) : { data: [] };
  const nm = new Map((names ?? []).map((n) => [n.id, n.display_name]));
  const th = "p-2";
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 font-bold text-brand-dark">{t("admin.doc_log")}</h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted text-muted-foreground"><tr><th className={th}>When</th><th className={th}>Admin</th><th className={th}>Kind</th><th className={th}>Document</th></tr></thead>
            <tbody>
              {(docLogs ?? []).map((d) => (
                <tr key={d.id} className="border-t border-border"><td className={th}>{fmt(d.created_at)}</td><td className={th}>{nm.get(d.admin_id) ?? d.admin_id.slice(0, 8)}</td><td className={th}>{d.kind}</td><td className={cn(th, "font-mono")}>{d.document_id.slice(0, 8)}</td></tr>
              ))}
              {!docLogs?.length && <tr><td className={th} colSpan={4}>{t("admin.none")}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-bold text-brand-dark">{t("admin.tab.audit")}</h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted text-muted-foreground"><tr><th className={th}>When</th><th className={th}>Actor</th><th className={th}>Action</th><th className={th}>Table</th><th className={th}>Record</th></tr></thead>
            <tbody>
              {(data ?? []).map((a) => (
                <tr key={a.id} className="border-t border-border"><td className={th}>{fmt(a.created_at)}</td><td className={th}>{a.actor_id ? (nm.get(a.actor_id) ?? a.actor_id.slice(0, 8)) : "—"}</td><td className={th}>{a.action}</td><td className={th}>{a.table_name}</td><td className={cn(th, "font-mono")}>{a.record_id?.slice(0, 8)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

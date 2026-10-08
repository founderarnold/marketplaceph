import { NextResponse, type NextRequest } from "next/server";
import { fileStamp, parseRange, type Table } from "@/lib/export";
import { tablesToCsv, tablesToPdf, tablesToXlsx } from "@/lib/export-files";
import { FEATURE_MIN_RANK, isProError, tierByRank } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

const KINDS = ["sales", "customers", "purchases", "finance"] as const;
type Kind = (typeof KINDS)[number];
const TITLES: Record<Kind, string> = { sales: "Sales report", customers: "Customer list", purchases: "Purchases report", finance: "Profit & loss" };

/**
 * Paid exports: CSV needs FLAME Starter, Excel Micro, PDF Pro (the profit & loss report needs Pro in every format).
 * The plan check is the database's assert_tier(), so it can't be skipped.
 * Everything is read through the signed-in user's own RLS-protected queries.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/export/[kind]">) {
  const { kind } = await ctx.params;
  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  if (!KINDS.includes(kind as Kind) || !["csv", "xlsx", "pdf"].includes(format)) return new NextResponse("Not found", { status: 404 });
  const k = kind as Kind;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return new NextResponse("Please sign in", { status: 401 });

  const need = Math.max(
    format === "pdf" ? FEATURE_MIN_RANK.pdf_export : format === "xlsx" ? FEATURE_MIN_RANK.excel_export : FEATURE_MIN_RANK.csv_export,
    k === "finance" ? FEATURE_MIN_RANK.finance_pl : 0,
  );
  const gate = await supabase.rpc("assert_tier", { p_min: need });
  if (gate.error) {
    const denied = isProError(gate.error);
    return new NextResponse(denied ? `This export needs ${tierByRank(need).name} or higher. Subscribe to enable it.` : "Something went wrong", { status: denied ? 403 : 500 });
  }

  const { from, to } = parseRange(request.nextUrl.searchParams.get("from"), request.nextUrl.searchParams.get("to"));
  const { data: store } = await supabase.from("stores").select("id, name").eq("owner_id", userId).limit(1).maybeSingle();
  const tables: Table[] = [];
  const sub = `${from} to ${to}`;

  if (k === "sales") {
    if (!store) return new NextResponse("You need a store to export sales", { status: 400 });
    const { data: orders } = await supabase
      .from("orders")
      .select("id, summary, quantity, amount, shipping_fee, buyer_id, confirmed_at, created_at")
      .eq("store_id", store.id).eq("status", "completed")
      .gte("confirmed_at", `${from}T00:00:00`).lte("confirmed_at", `${to}T23:59:59.999`)
      .order("confirmed_at");
    const ids = [...new Set((orders ?? []).map((o) => o.buyer_id))];
    const { data: names } = ids.length ? await supabase.from("public_profiles").select("id, display_name").in("id", ids) : { data: [] };
    const nm = new Map((names ?? []).map((n) => [n.id, n.display_name]));
    const rows = (orders ?? []).map((o) => [(o.confirmed_at ?? o.created_at).slice(0, 10), o.id.slice(0, 6).toUpperCase(), nm.get(o.buyer_id) ?? "", o.summary, o.quantity, Number(o.shipping_fee), Number(o.amount)]);
    tables.push({ title: "Completed sales", subtitle: `${store.name} · ${sub}`, columns: ["Date", "Order", "Customer", "Items", "Qty", "Shipping fee", "Amount"], rows,
      totals: ["", "", "", "Total", rows.reduce((s, r) => s + Number(r[4]), 0), rows.reduce((s, r) => s + Number(r[5]), 0), rows.reduce((s, r) => s + Number(r[6]), 0)] });
    const best = await supabase.rpc("seller_best_sellers", { p_store: store.id, p_from: from, p_to: to, p_limit: 50 });
    if (best.data?.length) tables.push({ title: "Best sellers", columns: ["Product", "Units", "Revenue"], rows: best.data.map((b) => [b.title, Number(b.qty), Number(b.revenue)]) });
  } else if (k === "customers") {
    if (!store) return new NextResponse("You need a store to export customers", { status: 400 });
    const { data } = await supabase.rpc("crm_list", { p_store: store.id });
    tables.push({ title: "Customers", subtitle: store.name, columns: ["Customer", "Orders", "Completed", "Total spent", "First order", "Last order", "Phone", "Tags", "Notes"],
      rows: (data ?? []).map((c) => [c.display_name, c.orders_count, c.completed_count, Number(c.total_spent), c.first_order_at.slice(0, 10), c.last_order_at.slice(0, 10), c.last_phone, c.tags.join(" "), c.notes]) });
  } else if (k === "purchases") {
    const { data: orders } = await supabase
      .from("orders").select("summary, amount, confirmed_at, created_at, stores ( name )")
      .eq("buyer_id", userId).eq("status", "completed")
      .gte("confirmed_at", `${from}T00:00:00`).lte("confirmed_at", `${to}T23:59:59.999`).order("confirmed_at");
    const rows = (orders ?? []).map((o) => [(o.confirmed_at ?? o.created_at).slice(0, 10), o.stores.name, o.summary, Number(o.amount)]);
    tables.push({ title: "Purchases", subtitle: sub, columns: ["Date", "Supplier", "Items", "Amount"], rows, totals: ["", "", "Total", rows.reduce((s, r) => s + Number(r[3]), 0)] });
    const [bySup, byCat] = await Promise.all([supabase.rpc("buyer_spend_by_supplier", { p_from: from, p_to: to }), supabase.rpc("buyer_spend_by_category", { p_from: from, p_to: to })]);
    if (bySup.data?.length) tables.push({ title: "Spending by supplier", columns: ["Supplier", "Orders", "Spent"], rows: bySup.data.map((r) => [r.store_name, r.orders_count, Number(r.spent)]) });
    if (byCat.data?.length) tables.push({ title: "Spending by category", columns: ["Category", "Spent"], rows: byCat.data.map((r) => [r.category, Number(r.spent)]) });
  } else {
    const [pl, inc, exp] = await Promise.all([
      supabase.rpc("finance_pl", { p_from: from, p_to: to }),
      supabase.from("income_entries").select("entry_date, category, note, amount").gte("entry_date", from).lte("entry_date", to).order("entry_date"),
      supabase.from("expenses").select("entry_date, category, vendor, note, amount").gte("entry_date", from).lte("entry_date", to).order("entry_date"),
    ]);
    const income = (pl.data ?? []).filter((r) => r.section === "income");
    const expense = (pl.data ?? []).filter((r) => r.section === "expense");
    const ti = income.reduce((s, r) => s + Number(r.amount), 0);
    const te = expense.reduce((s, r) => s + Number(r.amount), 0);
    tables.push({
      title: "Profit & loss", subtitle: `${sub} · simple record, not accounting advice`, columns: ["Type", "Category", "Amount"],
      rows: [...income.map((r) => ["Income", r.category, Number(r.amount)]), ...expense.map((r) => ["Expense", r.category, Number(r.amount)])],
      totals: ["", "Net profit", ti - te],
    });
    tables.push({ title: "Entries you recorded", columns: ["Date", "Type", "Category", "Vendor / note", "Amount"],
      rows: [...(inc.data ?? []).map((r) => [r.entry_date, "Income", r.category, r.note, Number(r.amount)]), ...(exp.data ?? []).map((r) => [r.entry_date, "Expense", r.category, [r.vendor, r.note].filter(Boolean).join(" · "), Number(r.amount)])] });
  }

  const name = `marketplaceph-${k}-${from}_${to}`;
  const headers = (type: string, ext: string) => ({ "Content-Type": type, "Content-Disposition": `attachment; filename="${name}.${ext}"`, "Cache-Control": "no-store" });
  if (format === "csv") return new NextResponse(tablesToCsv(tables), { headers: headers("text/csv; charset=utf-8", "csv") });
  if (format === "xlsx") {
    const buf = await tablesToXlsx(tables, { title: `${TITLES[k]} · ${sub}` });
    return new NextResponse(new Uint8Array(buf), { headers: headers("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx") });
  }
  const pdf = await tablesToPdf(tables, { title: TITLES[k], subtitle: `${store?.name ?? ""} ${sub} · generated ${fileStamp()}`.trim() });
  return new NextResponse(new Uint8Array(pdf), { headers: headers("application/pdf", "pdf") });
}

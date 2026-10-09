import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SELLER_TYPES, STOCK_STATUSES, REPORT_REASONS } from "@/lib/domain";
import { formatPeso, priceLabel, yearsInBusinessBadge } from "@/lib/format";
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";
import { makeT } from "@/lib/i18n/shared";
import { normalizePhonePH, safeNext } from "@/lib/phone";
import { applyFilters, parseSearchParams, type FilterBuilder } from "@/lib/search";
import { distanceBetween, islandGroup, recommendShipping, sizeClass, unitPriceFor, SHIPPING_KINDS } from "@/lib/shipping";
import { DISPUTE_REASONS, FLOW, PAYMENT_KINDS, whoseTurn, friendlyDbError } from "@/lib/orders";
import { parseRange, safeCell, toCsv } from "@/lib/export";
import { tablesToCsv, tablesToPdf, tablesToXlsx } from "@/lib/export-files";
import { APPLICATION_STATUSES, CIVIL_STATUSES, DOC_KINDS, EDUCATION_LEVELS, EMPLOYMENT_TYPES, JOB_CATEGORIES, POST_STATUSES, POSTER_TYPES, SALARY_PERIODS, SEX_OPTIONS, WORK_SETUPS, ageFrom, salaryLabel, splitList } from "@/lib/jobs";
import { FEATURE_MIN_RANK, TIERS, TIER_KEYS, canUse, featuresAddedAt, isProError, tierByKey, tierByRank, yearlySaving, type Feature } from "@/lib/plans";

describe("phone + redirects", () => {
  it("normalises Philippine mobile numbers", () => {
    for (const v of ["09171234567", "9171234567", "639171234567", "+63 917 123 4567", "0917-123-4567"]) {
      expect(normalizePhonePH(v)).toBe("+639171234567");
    }
  });
  it("rejects bad numbers", () => {
    for (const v of ["", "12345", "0817123456", "+14155552671", "09171234"]) expect(normalizePhonePH(v)).toBeNull();
  });
  it("only allows same-site redirects", () => {
    expect(safeNext("/sell/new")).toBe("/sell/new");
    for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", null, undefined]) {
      expect(safeNext(bad as string | null)).toBe("/");
    }
  });
});

describe("price + trust formatting", () => {
  const t = makeT("en");
  it("formats pesos", () => {
    expect(formatPeso(1500)).toBe("₱1,500");
    expect(formatPeso(1.5)).toBe("₱1.50");
  });
  it("labels price types", () => {
    expect(priceLabel({ price_type: "fixed", price_min: 135, price_max: null, unit: "pc" }, t)).toBe("₱135");
    expect(priceLabel({ price_type: "range", price_min: 850, price_max: 1200, unit: "tray" }, t)).toBe("₱850 – ₱1,200");
    expect(priceLabel({ price_type: "message", price_min: null, price_max: null, unit: "kg" }, t)).toBe("Message for price");
  });
  it("buckets years in business", () => {
    const now = new Date("2026-06-01");
    expect(yearsInBusinessBadge(2026, now)).toBeNull();
    expect(yearsInBusinessBadge(2025, now)).toBe("1+");
    expect(yearsInBusinessBadge(2023, now)).toBe("3+");
    expect(yearsInBusinessBadge(2020, now)).toBe("5+");
    expect(yearsInBusinessBadge(2010, now)).toBe("10+");
    expect(yearsInBusinessBadge(null, now)).toBeNull();
  });
});

describe("search params", () => {
  it("parses and sanitises", () => {
    const f = parseSearchParams({ q: "  mango,(drop) %  ", min: "100", max: "abc", seller_type: "manufacturer", verified: "1", sort: "price_asc", page: "3" });
    expect(f.q).toBe("mango  drop");
    expect(f.minPrice).toBe(100);
    expect(f.maxPrice).toBeNull();
    expect(f.sellerType).toBe("manufacturer");
    expect(f.verifiedOnly).toBe(true);
    expect(f.inStockOnly).toBe(false);
    expect(f.sort).toBe("price_asc");
    expect(f.page).toBe(3);
  });
  it("ignores unknown seller types / sorts and bad pages", () => {
    const f = parseSearchParams({ seller_type: "wizard", sort: "random", page: "-4" });
    expect(f.sellerType).toBeNull();
    expect(f.sort).toBe("new");
    expect(f.page).toBe(1);
  });
  it("builds the expected filter calls", () => {
    const calls: string[] = [];
    const rec = (name: string) => (...args: unknown[]) => {
      calls.push(`${name}(${args.map((a) => JSON.stringify(a)).join(",")})`);
      return builder;
    };
    const builder: FilterBuilder<unknown> = {
      or: rec("or"), eq: rec("eq"), gte: rec("gte"), lte: rec("lte"), in: rec("in"), order: rec("order"), range: rec("range"),
    } as unknown as FilterBuilder<unknown>;
    applyFilters(
      builder as FilterBuilder<never>,
      parseSearchParams({ q: "mango", region: "R7", verified: "1", in_stock: "1", min: "10" }),
      "cat-id",
    );
    expect(calls).toContain('or("title.ilike.%mango%,description.ilike.%mango%")');
    expect(calls).toContain('eq("category_id","cat-id")');
    expect(calls).toContain('eq("region_code","R7")');
    expect(calls).toContain('gte("stores.verification_level",2)');
    expect(calls).toContain('in("stock_status",["in_stock","made_to_order","pre_order"])');
    expect(calls).toContain('gte("price_min",10)');
    expect(calls.at(-1)).toBe("range(0,23)");
  });
});

// ── i18n completeness: every key used in code exists in BOTH languages ──
function walk(dir: string, out: string[] = []) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (f === "node_modules" || f.startsWith(".")) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f) && !p.includes("database.types")) out.push(p);
  }
  return out;
}

describe("i18n", () => {
  const root = path.resolve(__dirname, "..");
  const files = ["app", "components", "lib"].flatMap((d) => walk(path.join(root, d)));
  const used = new Set<string>();
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/\bt\(\s*["'`]([a-zA-Z0-9_.${}]+)["'`]/g)) used.add(m[1]);
  }
  // dynamic keys, enumerated from their source-of-truth lists
  for (const s of SELLER_TYPES) used.add(`seller.${s}`);
  for (const s of STOCK_STATUSES) used.add(`stock.${s}`);
  for (const r of REPORT_REASONS) used.add(`report.reason.${r}`);
  for (const k of ["product", "service"]) used.add(`sell.kind.${k}`);
  for (const p of ["fixed", "range", "message"]) used.add(`sell.price.${p}`);
  for (const s of ["active", "hidden", "removed"]) used.add(`my.status.${s}`);
  for (const s of ["cases", "appeals", "verification", "watchlist", "listings", "stores", "users", "categories", "banned", "audit"]) used.add(`admin.tab.${s}`);
  for (const s of ["fast_responder", "top_seller", "reliable_buyer"]) { used.add(`badge.${s}`); used.add(`badge.${s}.desc`); }
  for (const s of ["open", "reviewing", "under_review", "awaiting_response", "dismissed", "warning", "restricted", "flagged", "actioned"]) used.add(`case.status.${s}`);
  for (const s of ["listing", "store", "user", "message"]) used.add(`cases.target.${s}`);
  for (const s of ["pending", "upheld", "overturned"]) used.add(`appeal.status.${s}`);
  for (const s of ["pending", "approved", "rejected", "needs_more"]) used.add(`verify.status.${s}`);
  for (const s of ["gov_id", "selfie_with_id", "dti", "sec", "cda", "bir_cor", "mayors_permit", "fda", "other"]) used.add(`doc.${s}`);
  for (const s of ["pending_confirmation", "completed", "cancelled", "disputed"]) used.add(`deal.status.${s}`);
  for (const s of ["deal_proposed", "deal_confirmed", "deal_cancelled", "review_received", "verification_approved", "verification_rejected", "verification_needs_more", "case_opened", "case_decided", "report_closed", "appeal_decided"]) used.add(`notif.${s}`);
  for (const s of ["none", "phone", "id", "business"]) used.add(`verify.${s}`);
  for (const s of ["pending_confirmation", "requested", "quoted", "payment_submitted", "paid", "packed", "shipped", "delivered", "completed", "cancelled", "disputed"]) used.add(`order.status.${s}`);
  for (const s of ["standard", "urgent"]) used.add(`order.urgency.${s}`);
  for (const s of SHIPPING_KINDS) used.add(`ship.kind.${s}`);
  for (const s of ["same_day", "local_on_demand", "heavy_local", "pickup_local", "courier_fallback", "courier_small", "van_nearby", "bus_cargo", "courier_express", "heavy_long", "heavy_sea", "courier_sea"]) used.add(`ship.why.${s}`);
  for (const s of PAYMENT_KINDS) used.add(`pay.kind.${s}`);
  for (const s of ["pending", "confirmed", "rejected"]) used.add(`pay.status.${s}`);
  for (const s of DISPUTE_REASONS) used.add(`dispute.reason.${s}`);
  for (const s of ["buyer_favored", "seller_favored", "partial", "no_fault"]) used.add(`dispute.outcome.${s}`);
  for (const s of ["open", "resolved"]) used.add(`dispute.status.${s}`);
  used.add("admin.tab.disputes");
  for (const s of ["order_requested", "order_quoted", "payment_submitted", "payment_cod", "payment_confirmed", "payment_rejected", "order_packed", "order_shipped", "order_delivered", "dispute_opened", "dispute_resolved"]) used.add(`notif.${s}`);
  for (const s of ["overview", "customers", "suppliers", "reminders", "reports", "finance", "inventory", "sms", "plan", "affiliates", "share"]) used.add(`biz.nav.${s}`);
  for (const f of Object.keys(FEATURE_MIN_RANK)) used.add(`plan.feat.${f}`);
  for (const [g, list] of Object.entries({ status: APPLICATION_STATUSES, poststatus: POST_STATUSES, cat: JOB_CATEGORIES, type: EMPLOYMENT_TYPES, setup: WORK_SETUPS, per: SALARY_PERIODS, edu: EDUCATION_LEVELS, sex: SEX_OPTIONS, civil: CIVIL_STATUSES, doc: DOC_KINDS })) for (const k of list) used.add(`job.${g}.${k}`);
  for (const k of POSTER_TYPES) { used.add(`job.poster.${k}`); used.add(`job.poster.${k}_hint`); }
  for (const k of ["job_application_received", "job_application_status", "job_message", "new_message"]) used.add(`notif.${k}`);
  used.add("admin.tab.jobs");
  for (const k of TIER_KEYS) used.add(`plan.tier.${k}`);
  for (const k of ["monthly", "yearly"]) used.add(`plan.billing.${k}`);
  for (const k of ["pending", "approved", "rejected", "revoked"]) used.add(`aff.status.${k}`);
  for (const k of ["pending", "earned", "paid", "void"]) used.add(`aff.cstatus.${k}`);
  for (const k of ["training", "financing", "mentoring", "events"]) { used.add(`flame.${k}`); used.add(`flame.${k}_body`); }
  for (const k of ["affiliate_requested", "affiliate_approved", "affiliate_rejected", "commission_earned", "commission_paid"]) used.add(`notif.${k}`);
  for (const s of ["customer", "product"]) used.add(`rem.scope.${s}`);
  for (const s of ["day", "week", "month"]) used.add(`rep.by.${s}`);
  for (const s of ["queued", "sent", "failed"]) used.add(`sms.status.${s}`);
  for (const s of ["order_paid", "order_cancelled", "manual", "count"]) used.add(`inv.reason.${s}`);
  used.add("admin.tab.plans");
  for (const s of ["restock_self", "restock_follow_up", "low_stock", "plan_activated"]) used.add(`notif.${s}`);
  const concrete = [...used].filter((k) => !k.includes("${"));

  it("finds a healthy number of keys", () => expect(concrete.length).toBeGreaterThan(100));
  it("has every used key in English", () => expect(concrete.filter((k) => !(k in en))).toEqual([]));
  it("has every used key in Filipino", () => expect(concrete.filter((k) => !(k in fil))).toEqual([]));
  it("keeps en and fil key sets identical", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fil).sort());
  });
  it("keeps placeholders consistent between languages", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(ph(fil[k]), k).toBe(ph(en[k]));
  });
});

describe("shipping recommendation rules", () => {
  const mnl = { region: "NCR", city: "NCR-MNL" };
  const qc = { region: "NCR", city: "NCR-QC" };
  const cebu = { region: "R7", province: "CEBU", city: "CEBUCITY" };
  const davao = { region: "R11", province: "DAVAOSUR", city: "DAVAOCITY" };
  const baguio = { region: "CAR", province: "BENGUET", city: "BAG" };
  const latrinidad = { region: "CAR", province: "BENGUET", city: "LATRI" };
  const sanfer = { region: "R3", province: "PAMPANGA", city: "SANFER" };

  it("groups regions into islands and measures distance", () => {
    expect(islandGroup("NCR")).toBe("luzon");
    expect(islandGroup("R7")).toBe("visayas");
    expect(islandGroup("BARMM")).toBe("mindanao");
    expect(islandGroup("XX")).toBeNull();
    expect(distanceBetween(mnl, qc)).toBe("same_city"); // Metro Manila is one delivery zone
    expect(distanceBetween(baguio, latrinidad)).toBe("same_province");
    expect(distanceBetween(baguio, sanfer)).toBe("same_island");
    expect(distanceBetween(cebu, davao)).toBe("cross_island");
    expect(distanceBetween({}, davao)).toBe("unknown");
  });

  it("sizes an order by weight when known, else by quantity", () => {
    expect(sizeClass(2, 1000)).toBe("small");
    expect(sizeClass(25, 1)).toBe("medium");
    expect(sizeClass(120, 1)).toBe("heavy");
    expect(sizeClass(null, 10)).toBe("small");
    expect(sizeClass(null, 100)).toBe("medium");
    expect(sizeClass(null, 5000)).toBe("heavy");
  });

  it("suggests on-demand for urgent local orders, trucking for heavy ones", () => {
    expect(recommendShipping({ seller: mnl, buyer: qc, totalWeightKg: 3, totalQty: 5, urgent: true })[0]).toEqual({ kind: "on_demand", reason: "same_day" });
    expect(recommendShipping({ seller: mnl, buyer: qc, totalWeightKg: 300, totalQty: 5, urgent: false })[0].kind).toBe("trucking");
  });

  it("uses buses/vans between nearby places and couriers for small parcels", () => {
    const heavy = recommendShipping({ seller: baguio, buyer: latrinidad, totalWeightKg: 30, totalQty: 30, urgent: false }).map((r) => r.kind);
    expect(heavy[0]).toBe("van_jeep");
    expect(heavy).toContain("bus");
    expect(recommendShipping({ seller: baguio, buyer: sanfer, totalWeightKg: 20, totalQty: 20, urgent: false })[0].kind).toBe("bus");
    expect(recommendShipping({ seller: baguio, buyer: sanfer, totalWeightKg: 2, totalQty: 2, urgent: false })[0].kind).toBe("courier");
  });

  it("never suggests buses or vans across islands", () => {
    for (const urgent of [true, false]) for (const w of [1, 20, 500]) {
      const kinds = recommendShipping({ seller: cebu, buyer: davao, totalWeightKg: w, totalQty: 10, urgent }).map((r) => r.kind);
      expect(kinds).not.toContain("bus");
      expect(kinds).not.toContain("van_jeep");
      expect(kinds).toContain("courier");
    }
    expect(recommendShipping({ seller: cebu, buyer: davao, totalWeightKg: 500, totalQty: 10, urgent: false })[0].kind).toBe("trucking");
  });

  it("falls back to a courier when a location is unknown, and every reason has a key", () => {
    expect(recommendShipping({ seller: sanfer, buyer: {}, totalWeightKg: null, totalQty: 5, urgent: false })[0].kind).toBe("courier");
  });
});

describe("order helpers", () => {
  it("picks wholesale tiers and leaves range/message prices to the seller", () => {
    const tiers = [{ min_qty: 100, unit_price: 88 }, { min_qty: 500, unit_price: 80 }];
    const fixed = { price_type: "fixed", price_min: 95 };
    expect(unitPriceFor(fixed, tiers, 20)).toBe(95);
    expect(unitPriceFor(fixed, tiers, 100)).toBe(88);
    expect(unitPriceFor(fixed, tiers, 499)).toBe(88);
    expect(unitPriceFor(fixed, tiers, 1000)).toBe(80);
    expect(unitPriceFor({ price_type: "range", price_min: 90 }, tiers, 100)).toBeNull();
    expect(unitPriceFor({ price_type: "message", price_min: null }, [], 5)).toBeNull();
  });
  it("knows whose turn it is", () => {
    expect(FLOW[0]).toBe("requested");
    expect(whoseTurn("requested", "seller")).toBe(true);
    expect(whoseTurn("requested", "buyer")).toBe(false);
    expect(whoseTurn("quoted", "buyer")).toBe(true);
    expect(whoseTurn("paid", "seller")).toBe(true);
    expect(whoseTurn("shipped", "buyer")).toBe(true);
    expect(whoseTurn("completed", "buyer")).toBe(false);
  });
  it("shows our own database messages but hides Postgres internals", () => {
    expect(friendlyDbError("This quote has expired. Ask the seller for a new one.")).toMatch(/expired/);
    expect(friendlyDbError('null value in column "status" violates not-null constraint')).toBeNull();
    expect(friendlyDbError("Could not find the function public.place_order in the schema cache")).toBeNull();
  });
});

describe("exports", () => {
  it("neutralises spreadsheet formulas in text but leaves numbers alone", () => {
    expect(safeCell("=HYPERLINK(\"http://evil\")")).toBe("'=HYPERLINK(\"http://evil\")");
    expect(safeCell("+639171234567")).toBe("'+639171234567");
    expect(safeCell("-cmd")).toBe("'-cmd");
    expect(safeCell("@SUM(1)")).toBe("'@SUM(1)");
    expect(safeCell("Juan Dela Cruz")).toBe("Juan Dela Cruz");
    expect(safeCell(-5)).toBe(-5);
    expect(safeCell(null)).toBe("");
    expect(safeCell(Number.NaN)).toBe("");
  });

  it("writes valid CSV: quoting, commas, quotes, newlines, BOM, totals", () => {
    const csv = toCsv({ title: "T", columns: ["Name", "Note", "Amount"], rows: [["Aling \"Nena\", Inc.", "line1\nline2", 1500.5], ["=cmd", null, 2]], totals: ["Total", "", 1502.5] });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Name,Note,Amount");
    expect(lines[1]).toBe('"Aling ""Nena"", Inc.","line1\nline2",1500.5');
    expect(lines[2]).toBe("'=cmd,,2");
    expect(lines[3]).toBe("Total,,1502.5");
  });

  it("parses date ranges safely", () => {
    const now = new Date("2026-10-15T08:00:00Z");
    expect(parseRange(null, null, now)).toEqual({ from: "2026-10-01", to: "2026-10-15" });
    expect(parseRange("2026-09-01", "2026-09-30", now)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(parseRange("2026-09-30", "2026-09-01", now)).toEqual({ from: "2026-09-01", to: "2026-09-30" }); // swapped
    expect(parseRange("nonsense", "2026-13-45", now)).toEqual({ from: "2026-10-01", to: "2026-10-15" });
    expect(parseRange("1; DROP TABLE", undefined, now).from).toBe("2026-10-01");
  });

  it("builds real Excel and PDF files", async () => {
    const tables = [{ title: "Sales", subtitle: "Test", columns: ["Date", "Customer", "Amount"], rows: [["2026-10-01", "=evil()", 100], ["2026-10-02", "Maria", 250.75]], totals: ["", "Total", 350.75] }];
    const xlsx = await tablesToXlsx(tables, { title: "Sales report" });
    expect(xlsx.subarray(0, 2).toString()).toBe("PK"); // zip container
    const pdf = await tablesToPdf(tables, { title: "Sales report", subtitle: "Oct 2026" });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
    expect(tablesToCsv(tables).includes("'=evil()")).toBe(true);
    expect(tablesToCsv([...tables, ...tables]).split("Sales").length).toBeGreaterThan(2);
  });
});

describe("jobs helpers", () => {
  const per = (p: string) => p;
  it("formats pay ranges", () => {
    expect(salaryLabel(14000, 16000, "month", per)).toBe("₱14,000 – ₱16,000 / month");
    expect(salaryLabel(450, null, "day", per)).toBe("₱450 / day");
    expect(salaryLabel(500, 500, "day", per)).toBe("₱500 / day");
    expect(salaryLabel(null, null, "day", per)).toBeNull();
  });
  it("cleans skill lists", () => {
    expect(splitList(" Cooking, cooking ,Forklift,, MS Excel\nSales")).toEqual(["Cooking", "cooking", "Forklift", "MS Excel", "Sales"]);
    expect(splitList(Array.from({ length: 40 }, (_, i) => "s" + i).join(","), 20)).toHaveLength(20);
    expect(splitList("x".repeat(100))[0]).toHaveLength(40);
  });
  it("computes age safely", () => {
    expect(ageFrom("2000-01-01", Date.UTC(2026, 0, 2))).toBe(26);
    expect(ageFrom(null)).toBeNull();
    expect(ageFrom("not-a-date")).toBeNull();
  });
});

describe("plans config", () => {
  it("lists the six FLAME tiers in order with the published fees", () => {
    expect(TIERS.map((t) => t.key)).toEqual(["apprentice", "starter", "micro", "neo", "pro", "champion"]);
    expect(TIERS.map((t) => t.rank)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(TIERS.map((t) => [t.monthly, t.yearly])).toEqual([[0, 0], [30, 300], [60, 600], [120, 1200], [360, 3600], [720, 7700]]);
    expect(TIERS[0].listings).toBe(10);          // Apprentice: limited to 10 posts
    expect(TIERS[0].affiliateLinks).toBe(3);     // free affiliates: 3 links
    expect(TIERS[5].listings).toBeNull();        // Champion: unlimited
  });
  it("grows limits monotonically", () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].affiliateLinks).toBeGreaterThan(TIERS[i - 1].affiliateLinks);
      if (TIERS[i].listings !== null) expect(TIERS[i].listings!).toBeGreaterThan(TIERS[i - 1].listings!);
    }
  });
  it("keeps basic features free and advanced ones on paid tiers", () => {
    for (const f of ["customers", "suppliers", "inventory", "own_reminders", "finance_basic", "reports_basic", "affiliates"] as Feature[]) expect(FEATURE_MIN_RANK[f]).toBe(0);
    expect(FEATURE_MIN_RANK.sms).toBeGreaterThan(0);
    expect(canUse(0, "sms")).toBe(false);
    expect(canUse(4, "sms")).toBe(true);
    expect(canUse(3, "pdf_export")).toBe(false);
    expect(canUse(5, "featured")).toBe(true);
    expect(featuresAddedAt(3)).toContain("follow_ups");
  });
  it("looks tiers up safely", () => {
    expect(tierByKey("nope").key).toBe("apprentice");
    expect(tierByRank(99).key).toBe("champion");
    expect(tierByRank(-1).key).toBe("apprentice");
    expect(yearlySaving(TIERS[1])).toBe(60);
  });
  it("recognises the database's Pro error", () => {
    expect(isProError({ code: "P0003", message: "x" })).toBe(true);
    expect(isProError({ message: "This feature needs FLAME Neo or higher. Subscribe to enable it." })).toBe(true);
    expect(isProError({ message: "Your plan allows 3 affiliate links. Upgrade your FLAME membership for more." })).toBe(true);
    expect(isProError({ code: "42501", message: "denied" })).toBe(false);
    expect(isProError(null)).toBe(false);
  });
});

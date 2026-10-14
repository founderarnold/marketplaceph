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
import { CATEGORY_TABS, LISTING_CONDITIONS, buildTree, categoryIdsFor, filterTree, nameOf, pathTo, type Cat } from "@/lib/categories";
import { breakEven, costing } from "@/lib/calculators";
import { SELLER_TOOLS } from "@/lib/seller-tools";
import { BADGES, FEATURED_KINDS } from "@/lib/social";
import { LINK_KINDS, linkHref, normalizeLink } from "@/lib/social-links";
import { cutoffFor, formatMinutes, phClock, summarizeLog, summarizePeriod } from "@/lib/staff";
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
      parseSearchParams({ q: "mango", region: "R7", verified: "1", in_stock: "1", min: "10", condition: "used" }),
      ["cat-id", "sub-id"],
    );
    expect(calls).toContain('or("title.ilike.%mango%,description.ilike.%mango%")');
    expect(calls).toContain('in("category_id",["cat-id","sub-id"])');
    expect(calls).toContain('eq("condition","used")');
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
  for (const s of ["overview", "customers", "suppliers", "reminders", "reports", "finance", "inventory", "staff", "sms", "plan", "affiliates", "share"]) used.add(`biz.nav.${s}`);
  for (const f of Object.keys(FEATURE_MIN_RANK)) used.add(`plan.feat.${f}`);
  for (const [g, list] of Object.entries({ status: APPLICATION_STATUSES, poststatus: POST_STATUSES, cat: JOB_CATEGORIES, type: EMPLOYMENT_TYPES, setup: WORK_SETUPS, per: SALARY_PERIODS, edu: EDUCATION_LEVELS, sex: SEX_OPTIONS, civil: CIVIL_STATUSES, doc: DOC_KINDS })) for (const k of list) used.add(`job.${g}.${k}`);
  for (const k of POSTER_TYPES) { used.add(`job.poster.${k}`); used.add(`job.poster.${k}_hint`); }
  for (const k of ["job_application_received", "job_application_status", "job_message", "new_message"]) used.add(`notif.${k}`);
  used.add("admin.tab.jobs");
  for (const k of CATEGORY_TABS) { used.add(`cat.tab.${k}`); used.add(`cat.tab_hint.${k}`); }
  for (const k of LISTING_CONDITIONS) used.add(`cond.${k}`);
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
  for (const tool of SELLER_TOOLS) {
    used.add(`sell.tool.${tool.key}.title`);
    used.add(`sell.tool.${tool.key}.desc`);
    used.add(`guide.${tool.key}.tip`);
    for (let i = 1; i <= tool.guideSteps; i++) used.add(`guide.${tool.key}.${i}`);
  }
  for (let n = 1; n <= 4; n++) { used.add(`sell.step${n}_title`); used.add(`sell.step${n}_body`); }
  for (const b of BADGES) { used.add(`badge.${b}`); used.add(`badge.${b}.desc`); used.add(`badges.needs.${b}`); used.add(`badges.note_ph.${b}`); }
  for (const k of FEATURED_KINDS) { used.add(`featured.row.${k}`); used.add(`featured.kind.${k}`); }
  for (const k of ["feed", "friends", "followers", "mine"]) used.add(`updates.tab.${k}`);
  for (const k of ["update", "listing", "job"]) used.add(`updates.kind.${k}`);
  for (const k of ["new_friend", "new_comment", "new_review", "badge_approved", "badge_rejected"]) used.add(`notif.${k}`);
  for (const k of ["rate_employer", "rate_applicant"]) used.add(`rate.${k}`);
  used.add("admin.tab.badges");
  for (const k of LINK_KINDS) used.add(`links.kind.${k}`);
  for (const k of ["requested", "quoted", "payment_submitted", "paid", "payment_rejected", "packed", "shipped", "delivered", "completed", "cancelled", "disputed", "pending_confirmation"]) used.add(`sys.order.${k}`);
  for (const k of ["applied", "shortlisted", "interview", "rejected", "hired", "withdrawn", "hire_confirmed"]) used.add(`sys.job.${k}`);
  for (const k of ["sold", "bought", "hired", "hires"]) used.add(`tx.${k}`);
  used.add("notif.hire_confirmed");
  for (const k of ["product", "service"]) used.add(`rq.kind.${k}`);
  for (const k of ["open", "closed", "fulfilled", "expired"]) used.add(`rq.status.${k}`);
  for (const k of ["all", "for_me", "mine", "offers"]) used.add(`rq.tab.${k}`);
  for (const k of ["sent", "accepted", "declined", "withdrawn"]) used.add(`rq.offer_status.${k}`);
  for (const k of ["new_offer", "offer_accepted", "offer_declined"]) used.add(`notif.${k}`);
  used.add("sys.request.accepted");
  for (const k of ["any", "motorcycle", "sedan", "mpv_suv", "pickup", "l300_h100", "closed_van", "truck"]) used.add(`dl.vehicle.${k}`);
  for (const k of ["open", "assigned", "picked_up", "delivered", "completed", "cancelled"]) used.add(`dl.status.${k}`);
  for (const k of ["sent", "accepted", "declined", "withdrawn"]) used.add(`dl.offer_status.${k}`);
  for (const k of ["pending", "approved", "needs_more", "rejected", "suspended"]) { used.add(`dl.rider_status.${k}`); used.add(`dl.rider_status.${k}.desc`); }
  for (const k of ["approved", "needs_more", "rejected", "suspended"]) { used.add(`dl.admin.do.${k}`); used.add(`notif.rider_${k}`); }
  for (const k of ["license_front", "license_back", "or_cr", "plate_front", "plate_back", "other"]) { used.add(`dl.doc.${k}`); used.add(`dl.doc.${k}.hint`); }
  for (const k of ["invalid", "bad_phone", "need_city", "need_area", "bad_plate", "need_docs", "already_offered", "auth"]) used.add(`dl.err.${k}`);
  for (const k of ["length_cm", "width_cm", "height_cm", "pickup_title", "dropoff_title", "how1_title", "how2_title", "how3_title", "how1", "how2", "how3", "reg_step1", "reg_step2", "reg_step3", "safety1", "safety2", "safety3", "safety4"]) used.add(`dl.${k}`);
  for (const k of ["offer", "hired", "picked_up", "delivered", "released", "completed", "cancelled", "invite"]) used.add(`notif.delivery_${k}`);
  for (const k of ["assigned", "picked_up", "delivered"]) used.add(`sys.delivery.${k}`);
  used.add("badge.verified_rider"); used.add("badge.verified_rider.desc");
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

describe("category tree", () => {
  const mk = (id: string, slug: string, parent: string | null, sort: number, en = slug, fil = slug): Cat => ({ id, slug, name_en: en, name_fil: fil, icon: null, parent_id: parent, tab: "products", sort_order: sort });
  const cats = [mk("b", "beauty", null, 2, "Beauty", "Kagandahan"), mk("f", "food", null, 1, "Food"), mk("f2", "food--coffee", "f", 2, "Coffee"), mk("f1", "food--rice", "f", 1, "Rice"), mk("b1", "beauty--skincare", "b", 1, "Skincare"), mk("x", "orphan--x", "missing", 1)];
  it("builds majors and children in display order and drops orphans", () => {
    const tree = buildTree(cats);
    expect(tree.map((m) => m.slug)).toEqual(["food", "beauty"]);
    expect(tree[0].children.map((c) => c.slug)).toEqual(["food--rice", "food--coffee"]);
  });
  it("includes sub-categories when searching a major, but not siblings", () => {
    expect(categoryIdsFor(cats, "food")).toEqual(["f", "f2", "f1"].sort((a, b) => (a === "f" ? -1 : b === "f" ? 1 : 0)));
    expect(categoryIdsFor(cats, "food--coffee")).toEqual(["f2"]);
    expect(categoryIdsFor(cats, "nope")).toBeNull();
  });
  it("gives breadcrumbs, names and search matches in both languages", () => {
    expect(pathTo(cats, "food--rice").map((c) => c.slug)).toEqual(["food", "food--rice"]);
    expect(pathTo(cats, "beauty").map((c) => c.slug)).toEqual(["beauty"]);
    expect(pathTo(cats, "nope")).toEqual([]);
    expect(nameOf(cats[0], "fil")).toBe("Kagandahan");
    const tree = buildTree(cats);
    expect(filterTree(tree, "kagand", "en").map((m) => m.slug)).toEqual(["beauty"]);
    expect(filterTree(tree, "coff", "en").map((m) => [m.slug, m.children.length])).toEqual([["food", 1]]);
    expect(filterTree(tree, "", "en")).toHaveLength(2);
  });
  it("has the four discovery tabs and the four conditions", () => {
    expect(CATEGORY_TABS).toEqual(["products", "suppliers", "services", "negosyo"]);
    expect(LISTING_CONDITIONS).toEqual(["new", "used", "refurbished", "surplus"]);
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

describe("seller calculators", () => {
  it("costs a batch and prices one piece", () => {
    const r = costing({ materials: [{ label: "garlic", amount: 300 }, { label: "oil", amount: 200 }], labor: 200, overhead: 50, packaging: 250, yieldUnits: 20, markupPct: 50 })!;
    expect(r.batchCost).toBe(1000);
    expect(r.unitCost).toBe(50);
    expect(r.price).toBe(75);
    expect(r.profitPerUnit).toBe(25);
    expect(r.marginPct).toBeCloseTo(33.33, 2);
    expect(r.wholesalePrice).toBe(62.5);
  });
  it("needs a yield and ignores negative or blank costs", () => {
    expect(costing({ materials: [], labor: 0, overhead: 0, packaging: 0, yieldUnits: 0, markupPct: 50 })).toBeNull();
    expect(costing({ materials: [{ label: "x", amount: -5 }, { label: "y", amount: NaN }], labor: 10, overhead: 0, packaging: 0, yieldUnits: 2, markupPct: 0 })!.unitCost).toBe(5);
  });
  it("finds the break-even point and a profit target", () => {
    const r = breakEven({ fixedCosts: [{ label: "rent", amount: 10000 }, { label: "salary", amount: 15000 }], price: 75, variableCost: 50, workDays: 25, targetProfit: 5000 })!;
    expect(r.fixedTotal).toBe(25000);
    expect(r.contribution).toBe(25);
    expect(r.units).toBe(1000);
    expect(r.revenue).toBe(75000);
    expect(r.unitsPerDay).toBe(40);
    expect(r.targetUnits).toBe(1200);
  });
  it("has no break-even when every sale loses money", () => {
    expect(breakEven({ fixedCosts: [{ label: "rent", amount: 100 }], price: 50, variableCost: 50, workDays: 26, targetProfit: 0 })).toBeNull();
  });
});

describe("staff time record", () => {
  const shift = { shift_start: "08:00:00", shift_end: "17:00:00" };
  it("reads clock times in Philippine time", () => {
    expect(phClock("2026-10-14T00:05:00Z")).toBe("08:05");
  });
  it("computes worked, late and undertime minutes", () => {
    expect(summarizeLog({ time_in: "2026-10-14T00:15:00Z", time_out: "2026-10-14T08:30:00Z" }, shift)).toEqual({ worked: 495, late: 15, undertime: 30, open: false });
    expect(summarizeLog({ time_in: "2026-10-14T23:55:00Z", time_out: null }, shift)).toEqual({ worked: 0, late: 0, undertime: 0, open: true });
    expect(summarizeLog({ time_in: "2026-10-14T01:00:00Z", time_out: "2026-10-14T09:00:00Z" }, { shift_start: null, shift_end: null }).late).toBe(0);
  });
  it("totals a period and counts distinct days", () => {
    const logs = [
      { work_date: "2026-10-14", time_in: "2026-10-14T00:00:00Z", time_out: "2026-10-14T04:00:00Z" },
      { work_date: "2026-10-14", time_in: "2026-10-14T05:00:00Z", time_out: "2026-10-14T09:00:00Z" },
      { work_date: "2026-10-15", time_in: "2026-10-15T00:10:00Z", time_out: "2026-10-15T09:00:00Z" },
    ];
    const s = summarizePeriod(logs, shift);
    expect(s.days).toBe(2);
    expect(s.worked).toBe(480 + 530);
    expect(s.late).toBe(10 + 300);
    expect(formatMinutes(485)).toBe("8h 05m");
    expect(formatMinutes(9)).toBe("9m");
  });
  it("picks the payroll cut-off", () => {
    expect(cutoffFor("2026-10-14")).toEqual({ from: "2026-10-01", to: "2026-10-15" });
    expect(cutoffFor("2026-02-20")).toEqual({ from: "2026-02-16", to: "2026-02-28" });
    expect(cutoffFor("2028-02-29")).toEqual({ from: "2028-02-16", to: "2028-02-29" });
  });
});

describe("profile social links", () => {
  it("accepts real accounts and normalizes them", () => {
    expect(normalizeLink("facebook_page", "facebook.com/MyStore")).toBe("https://facebook.com/MyStore");
    expect(normalizeLink("website", "https://kusina.ph/menu")).toBe("https://kusina.ph/menu");
    expect(normalizeLink("whatsapp", "0917 123 4567")).toBe("+639171234567");
    expect(normalizeLink("viber", "+63 917-123-4567")).toBe("+639171234567");
    expect(normalizeLink("telegram", "https://t.me/kusina_ph")).toBe("@kusina_ph");
    expect(normalizeLink("shopee", "https://shopee.ph/kusina")).toBe("https://shopee.ph/kusina");
  });
  it("rejects fake or dangerous links", () => {
    expect(normalizeLink("facebook_page", "https://facebook.com.evil.test/page")).toBeNull();
    expect(normalizeLink("instagram", "https://example.com/insta")).toBeNull();
    expect(normalizeLink("website", "javascript:alert(1)")).toBeNull();
    expect(normalizeLink("other", "data:text/html,<script>")).toBeNull();
    expect(normalizeLink("whatsapp", "call me")).toBeNull();
    expect(linkHref("website", "javascript:alert(1)")).toBeNull();
  });
  it("opens chat apps directly", () => {
    expect(linkHref("whatsapp", "+639171234567")).toBe("https://wa.me/639171234567");
    expect(linkHref("viber", "+639171234567")).toBe("viber://chat?number=%2B639171234567");
    expect(linkHref("telegram", "@kusina_ph")).toBe("https://t.me/kusina_ph");
  });
});

describe("Help & FAQ content", () => {
  it("has every question and answer in both languages, and links only to real pages", async () => {
    const { FAQ, FAQ_DISCLAIMER } = await import("@/lib/faq");
    const root = path.resolve(__dirname, "..");
    expect(FAQ_DISCLAIMER.en.length).toBeGreaterThan(100);
    expect(FAQ_DISCLAIMER.fil.length).toBeGreaterThan(100);
    for (const s of FAQ) {
      expect(s.title.en && s.title.fil).toBeTruthy();
      for (const it of s.items) {
        expect(it.q.en && it.q.fil).toBeTruthy();
        expect(it.a.en.length).toBe(it.a.fil.length); // same structure in both languages
        for (const line of [...it.a.en, ...it.a.fil]) {
          for (const m of line.matchAll(/\]\((\/[^)#?\s]*)/g)) {
            const page = path.join(root, "app", m[1], "page.tsx");
            expect(statSync(page, { throwIfNoEntry: false }), `FAQ links to ${m[1]}, which has no page`).toBeTruthy();
          }
        }
      }
    }
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { parseFlags, JOBS2_FLAGS } = await import("@/lib/flags");
const { attributionFrom, cleanValue, decodeAttr, encodeAttr } = await import("@/lib/jobs-attribution");
const { countBucket, JOB_EVENTS } = await import("@/lib/jobs-events");
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";

describe("jobs2 feature flags", () => {
  it("are all off by default and only known names turn on", () => {
    expect(parseFlags(undefined).size).toBe(0);
    expect(parseFlags("").size).toBe(0);
    expect([...parseFlags(" jobs2_landing , JOBS2_MATCHING,unknown_flag")]).toEqual(["jobs2_landing", "jobs2_matching"]);
    expect(JOBS2_FLAGS).toContain("jobs2_sso_link");
  });
});

describe("privacy-safe attribution", () => {
  it("keeps UTM fields and an opaque chapter code", () => {
    const a = attributionFrom(new URLSearchParams("utm_source=Facebook&utm_medium=comment&utm_campaign=pilot-nov&ch=pmp01&fbclid=IwAR123"));
    expect(a).toEqual({ utm_source: "facebook", utm_medium: "comment", utm_campaign: "pilot-nov", ch: "pmp01" });
  });
  it("ignores names, emails, phone numbers and malformed values", () => {
    expect(cleanValue("juan@example.com")).toBeNull();
    expect(cleanValue("09171234567")).toBeNull();
    expect(cleanValue("Juan Dela Cruz")).toBeNull();
    expect(cleanValue("<script>")).toBeNull();
    expect(cleanValue("x".repeat(41))).toBeNull();
    expect(cleanValue(["a"])).toBeNull();
    const a = attributionFrom({ name: "Juan", email: "a@b.co", phone: "0917", utm_source: ["fb", "x"], ch: "09171234567" });
    expect(a).toEqual({ utm_source: "fb" });
  });
  it("re-checks values read back from the cookie", () => {
    expect(decodeAttr(encodeAttr({ utm_source: "fb", ch: "pmp01" }))).toEqual({ utm_source: "fb", ch: "pmp01" });
    expect(decodeAttr("utm_source=a%40b.com&ch=ok1&evil=1")).toEqual({ ch: "ok1" });
    expect(decodeAttr(undefined)).toEqual({});
  });
});

describe("funnel events", () => {
  it("bucket result counts and use the P2 event names", () => {
    expect([0, 3, 12, 99].map(countBucket)).toEqual(["0", "1-5", "6-20", "21+"]);
    expect(JOB_EVENTS).toEqual(["jobs_landing_view", "job_search", "job_view", "signup_start", "referral_attribution"]);
  });
  it("the database allow-list matches the app and never stores search text", () => {
    const sql = readFileSync(new URL("../supabase/migrations/20261125000002_jobs2_landing_events.sql", import.meta.url), "utf8");
    for (const e of JOB_EVENTS) expect(sql).toContain(`'${e}'`);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).not.toMatch(/\b(drop|alter) table public\.(?!job_funnel_events|job_search_alerts)/i);
    const actions = readFileSync(new URL("../app/actions/jobs2.ts", import.meta.url), "utf8");
    expect(actions).not.toMatch(/p_props: \{[^}]*\bq\b/);
  });
});

describe("landing copy", () => {
  it("exists in English and Filipino, with the required headline", () => {
    const keys = Object.keys(en).filter((k) => k.startsWith("job2."));
    expect(keys.length).toBeGreaterThan(10);
    for (const k of keys) expect((fil as Record<string, string>)[k], k).toBeTruthy();
    expect((en as Record<string, string>)["job2.hero"]).toBe("Hanap trabaho? Simulan natin dito.");
    expect(keys.map((k) => (en as Record<string, string>)[k]).join(" ")).not.toMatch(/guarantee/i);
  });
  it("the old board is unchanged when the flag is off (location is ignored)", () => {
    const page = readFileSync(new URL("../app/jobs/page.tsx", import.meta.url), "utf8");
    expect(page).toMatch(/const loc = landing \? first\(sp\.loc\)/);
    expect(page).toMatch(/if \(landing\) \{/);
  });
});

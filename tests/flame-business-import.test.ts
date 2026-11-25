import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/data", () => ({ getLocations: async () => ({ regions: [], provinces: [], cities: [] }) }));

const MINE = "11111111-1111-4111-8111-111111111111";
const SOMEONE_ELSE = "22222222-2222-4222-8222-222222222222";
const writes: string[] = [];
vi.mock("@/lib/flame-business", async (orig) => {
  const real = await orig<typeof import("@/lib/flame-business")>();
  return {
    ...real,
    // The hub only ever returns the signed-in member's own listings.
    myFlameBusinesses: async () => ({ status: "ok", businesses: [real.cleanBusiness({ id: MINE, slug: "my-bakery", name: "My Bakery", profileUrl: "https://www.flameph.org/members/my-bakery" })!] }),
  };
});
vi.mock("@/lib/supabase/server", () => {
  const chain = (table: string): Record<string, unknown> => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit"]) c[m] = () => c;
    c.maybeSingle = async () => ({ data: null });
    c.single = async () => ({ data: { id: "store-1", slug: "my-bakery" } });
    c.insert = () => { writes.push(`insert:${table}`); return c; };
    c.update = () => { writes.push(`update:${table}`); return c; };
    c.upsert = async () => { writes.push(`upsert:${table}`); return { error: null }; };
    return c;
  };
  return { createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } } }) }, from: chain }) };
});

const { importFlameBusiness } = await import("@/app/actions/flame-business");
const { cleanBusiness } = await import("@/lib/flame-business");
const form = (o: Record<string, string>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.set(k, v); return fd; };

describe("Bring my FLAME PH business", () => {
  beforeEach(() => { writes.length = 0; });

  it("refuses a listing that isn't the member's own (another member's business id) and writes nothing", async () => {
    const r = await importFlameBusiness(undefined, form({ business_id: SOMEONE_ELSE, seller_type: "retailer", consent: "on" }));
    expect(r).toEqual({ error: "not_found" });
    expect(writes).toEqual([]);
  });
  it("needs the owner's agreement", async () => {
    const r = await importFlameBusiness(undefined, form({ business_id: MINE, seller_type: "retailer" }));
    expect(r).toEqual({ error: "consent" });
    expect(writes).toEqual([]);
  });
  it("creates the store from the member's own listing and records the link", async () => {
    const r = await importFlameBusiness(undefined, form({ business_id: MINE, seller_type: "retailer", consent: "on" }));
    expect(r?.ok).toBe(true);
    expect(writes).toEqual(["insert:stores", "upsert:flame_business_links"]);
  });
  it("checks every field from flameph.org again", () => {
    expect(cleanBusiness({ id: "not-a-uuid", slug: "x-y", name: "A" })).toBeNull();
    expect(cleanBusiness({ id: MINE, slug: "Bad Slug!", name: "A" })).toBeNull();
    const b = cleanBusiness({ id: MINE, slug: "ok-slug", name: "A".repeat(300), logoUrl: "javascript:alert(1)", photoUrls: ["https://x.test/a.jpg", "http://insecure.test/b.jpg"] })!;
    expect(b.name).toHaveLength(80);
    expect(b.logoUrl).toBeNull();
    expect(b.photoUrls).toEqual(["https://x.test/a.jpg"]);
  });
});

describe("safety in the code", () => {
  const lib = readFileSync(new URL("../lib/flame-business.ts", import.meta.url), "utf8");
  const sql = readFileSync(new URL("../supabase/migrations/20261125000007_flame_business_links.sql", import.meta.url), "utf8");
  it("asks the hub only with the signed-in member's own FLAME PH link, and never changes sign-in code", () => {
    expect(lib).toMatch(/if \(!link \|\| link\.uid !== userId\) return \{ status: "not_linked" \}/);
    expect(lib).toMatch(/hubCall<[^>]+>\("\/api\/ecosystem\/my-businesses", "business-share", \{ sub: link\.sub \}/);
    const sso = readFileSync(new URL("../lib/flame-sso.ts", import.meta.url), "utf8");
    expect(sso).not.toMatch(/business-share/);
  });
  it("link records are private and only for stores the member owns; no duplicate links per store", () => {
    expect(sql).toMatch(/unique \(store_id\)/);
    expect(sql).toMatch(/s\.owner_id = auth\.uid\(\)/);
    expect(sql).toMatch(/for select using \(user_id = auth\.uid\(\) or public\.is_admin\(\)\)/);
    expect(sql).not.toMatch(/drop table|delete from|truncate|alter table public\.stores/i);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { READINESS_FIELDS, readiness } from "@/lib/jobs-readiness";
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";

const E = en as Record<string, string>;
const F = fil as Record<string, string>;

const full = {
  desired_roles: "Rider", phone: "09170000000", city_code: "X", skills: ["driving", "maps", "customer service"],
  work_history: [{ company: "Family store" }], headline: "Reliable rider",
  about: "I deliver orders on time and treat customers well. I know the roads in my city.",
  consent_at: "2026-11-01",
};

describe("career readiness (derived, no sensitive fields)", () => {
  it("never reads birthdate, sex, civil status or the street address", () => {
    for (const f of ["birthdate", "sex", "civil_status", "address_note"]) expect(READINESS_FIELDS as readonly string[]).not.toContain(f);
    const code = readFileSync(new URL("../lib/jobs-readiness.ts", import.meta.url), "utf8").split("*/").slice(1).join("*/");
    expect(code).not.toMatch(/birthdate|\.sex\b|civil_status|address_note/);
  });
  it("an empty profile starts at step 1 with every gap explained in both languages", () => {
    const r = readiness(null);
    expect(r.done).toBe(0);
    expect(r.next?.n).toBe(1);
    for (const s of r.steps) for (const m of s.missing) { expect(E[`job3.miss.${m}`], m).toBeTruthy(); expect(F[`job3.miss.${m}`], m).toBeTruthy(); }
  });
  it("a first-time worker can complete experience with years = 0 or any listed experience", () => {
    expect(readiness({ ...full, work_history: [], experience_years: null }, [{ kind: "resume" }]).steps[2].done).toBe(false);
    expect(readiness({ ...full, work_history: [], experience_years: 0 }, [{ kind: "resume" }]).steps[2].done).toBe(true);
  });
  it("a complete profile with a resume is ready; without a resume the privacy step is next", () => {
    const r = readiness(full, [{ kind: "resume" }]);
    expect(r.done).toBe(5);
    expect(r.next).toBeNull();
    expect(readiness(full, []).next?.key).toBe("privacy");
  });
});

describe("onboarding shell", () => {
  const page = readFileSync(new URL("../app/jobs/start/page.tsx", import.meta.url), "utf8");
  it("is behind jobs2_sso_link and does not touch sign-in logic", () => {
    expect(page).toMatch(/if \(!isOn\("jobs2_sso_link"\)\) notFound\(\)/);
    expect(page).toMatch(/import \{ ssoEnabled \} from "@\/lib\/flame-sso"/);
    expect(page).not.toMatch(/hubCall|signLink|randomToken|AUTH_COOKIE/);
  });
  it("copy is honest and exists in English and Filipino", () => {
    for (const k of Object.keys(E).filter((k) => k.startsWith("job3."))) expect(F[k], k).toBeTruthy();
    expect(E["job3.flame_on"]).toMatch(/If the sign-in screen offers/);
    expect(E["job3.flame_off"]).toMatch(/isn't available/);
  });
});

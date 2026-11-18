import type { TFunction } from "@/lib/i18n/shared";

/**
 * The same "One FLAME PH ecosystem" strip as on flameph.org and NegosyoDepot. MarketplacePH is marked "You are here";
 * the other two open in the same tab, with the same FLAME PH account.
 */
const APPS = [
  { key: "flameph", name: "FLAME PH", href: "https://www.flameph.org/" },
  { key: "marketplaceph", name: "MarketplacePH", href: null },
  { key: "negosyodepot", name: "NegosyoDepot", href: "https://www.negosyodepot.com/" },
] as const;

export function EcosystemStrip({ t }: { t: TFunction }) {
  return (
    <section aria-labelledby="eco-h" className="border-b border-border pb-6">
      <h2 id="eco-h" className="font-bold text-brand-dark">{t("eco.title")}</h2>
      <p className="text-xs">{t("eco.text")}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {APPS.map((a) => {
          const body = (
            <>
              <span className="block font-semibold text-foreground">
                {a.name}
                {!a.href && <span className="ml-2 text-xs font-bold uppercase text-brand">{t("eco.here")}</span>}
              </span>
              <span className="block text-xs">{t(`eco.${a.key}`)}</span>
            </>
          );
          return (
            <li key={a.key}>
              {a.href ? (
                <a href={a.href} className="block min-h-11 rounded-lg border border-border bg-background p-3 hover:border-brand">{body}</a>
              ) : (
                <div aria-current="page" className="min-h-11 rounded-lg border-2 border-brand bg-background p-3">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

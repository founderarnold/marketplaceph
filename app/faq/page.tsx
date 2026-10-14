import { ChevronDown, LifeBuoy, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { FAQ, FAQ_DISCLAIMER } from "@/lib/faq";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description: "How buying, selling, posting, jobs and hiring work on MarketplacePH, how to check if someone is legit, and how to avoid scams and illegal recruiters.",
};

/** Renders "[label](/path)" as a site link; everything else stays plain text. Only same-site paths become links. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\(\/[^)\s]*\))/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[([^\]]+)\]\((\/[^)\s]*)\)$/);
        return m ? <Link key={i} href={m[2]} className="font-semibold text-brand underline">{m[1]}</Link> : <span key={i}>{p}</span>;
      })}
    </>
  );
}

/** Answer lines: "- " lines become a bullet list, other lines are paragraphs. */
function Answer({ lines }: { lines: string[] }) {
  const blocks: (string | string[])[] = [];
  for (const l of lines) {
    if (l.startsWith("- ")) {
      const last = blocks[blocks.length - 1];
      if (Array.isArray(last)) last.push(l.slice(2));
      else blocks.push([l.slice(2)]);
    } else blocks.push(l);
  }
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((b, i) =>
        Array.isArray(b) ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.map((x, j) => <li key={j}><Rich text={x} /></li>)}
          </ul>
        ) : (
          <p key={i}><Rich text={b} /></p>
        ),
      )}
    </div>
  );
}

function Disclaimer({ text, title }: { text: string; title: string }) {
  return (
    <aside className="flex gap-3 rounded-2xl border-2 border-accent bg-accent-soft p-4 text-sm" role="note">
      <ShieldAlert size={22} className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />
      <div>
        <p className="font-bold text-brand-dark">{title}</p>
        <p className="mt-1 leading-relaxed">{text}</p>
      </div>
    </aside>
  );
}

async function FaqContent() {
  const { t, locale } = await getT();
  const L = locale === "fil" ? "fil" : "en";
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold text-brand-dark">
          <LifeBuoy size={30} className="text-brand" aria-hidden /> {t("faq.title")}
        </h1>
        <p className="text-muted-foreground">{t("faq.intro")}</p>
      </header>

      <Disclaimer title={t("faq.disclaimer_title")} text={FAQ_DISCLAIMER[L]} />

      <nav aria-label={t("faq.topics")} className="flex flex-wrap gap-2">
        {FAQ.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border border-border bg-white px-3 py-1.5 text-sm font-semibold text-brand-dark hover:border-brand hover:text-brand">
            {s.title[L]}
          </a>
        ))}
      </nav>

      {FAQ.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-32 space-y-2">
          <h2 id={`${s.id}-h`} className="text-xl font-extrabold text-brand-dark">{s.title[L]}</h2>
          <ul className="space-y-2">
            {s.items.map((it, i) => (
              <li key={i}>
                <details className="group rounded-2xl border border-border bg-white">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                    {it.q[L]}
                    <ChevronDown size={18} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="border-t border-border px-4 py-3">
                    <Answer lines={it.a[L]} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="space-y-3 rounded-2xl bg-brand-soft p-4 text-sm text-brand-dark">
        <p className="font-bold">{t("faq.still_need")}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/check" className="inline-flex min-h-10 items-center rounded-xl bg-white px-4 font-semibold hover:bg-muted">{t("nav.check_full")}</Link>
          <Link href="/my/cases" className="inline-flex min-h-10 items-center rounded-xl bg-white px-4 font-semibold hover:bg-muted">{t("faq.my_reports")}</Link>
          <Link href="/terms" className="inline-flex min-h-10 items-center rounded-xl bg-white px-4 font-semibold hover:bg-muted">{t("footer.terms")}</Link>
          <Link href="/privacy" className="inline-flex min-h-10 items-center rounded-xl bg-white px-4 font-semibold hover:bg-muted">{t("footer.privacy")}</Link>
        </div>
      </section>

      <Disclaimer title={t("faq.disclaimer_title")} text={FAQ_DISCLAIMER[L]} />
    </div>
  );
}

export default function FaqPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FaqContent />
    </Suspense>
  );
}

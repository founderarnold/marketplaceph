import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Use", description: "The rules for buying, selling, posting jobs and using MarketplacePH." };

const h2 = "mt-8 text-xl font-extrabold text-brand-dark";
const ul = "mt-2 list-disc space-y-1 pl-6";

/** Public terms of use. */
export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl rounded-3xl border border-border bg-white p-6 leading-relaxed md:p-10">
      <h1 className="text-3xl font-extrabold text-brand-dark">Terms of Use</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated: {LEGAL_UPDATED}</p>

      <p className="mt-6">
        By creating an account or using marketplaceph.com you agree to these terms. If you do not agree, please do not use the site.
      </p>

      <h2 className={h2}>1. What MarketplacePH is</h2>
      <p className="mt-2">
        MarketplacePH connects buyers and sellers, and employers and job seekers, in the Philippines. We are not the seller of the items listed and
        we are not a party to the deals between users. Payments are made directly between buyer and seller; we do not hold your money.
      </p>

      <h2 className={h2}>2. Your account</h2>
      <ul className={ul}>
        <li>You must be 18 or older (job seekers 15 or older) and give true information.</li>
        <li>Keep your password safe. You are responsible for what happens in your account.</li>
        <li>One person or business may not use accounts to fake reviews, orders or ratings.</li>
      </ul>

      <h2 className={h2}>3. Selling and posting</h2>
      <ul className={ul}>
        <li>Only post things you are allowed to sell, with honest photos, prices, stock and descriptions.</li>
        <li>Do not post illegal, counterfeit, dangerous or prohibited items, or anything that breaks Philippine law, including the Consumer Act and FDA rules.</li>
        <li>Deliver what you promised, on the agreed terms. Answer buyers and disputes in good faith.</li>
        <li>Job posts must be real openings that follow DOLE rules. Never charge applicants a placement or processing fee unless the law allows it.</li>
      </ul>

      <h2 className={h2}>4. Buying</h2>
      <ul className={ul}>
        <li>Check the seller before you pay. Use <Link href="/check" className="text-brand underline">Check muna bago bayad</Link> and read the store’s ratings.</li>
        <li>Agree on price, payment and delivery in the chat or order so there is a record.</li>
        <li>Report problems through the order’s dispute option or the report button.</li>
      </ul>

      <h2 className={h2}>5. Plans and fees</h2>
      <p className="mt-2">
        Posting is free. Some business tools need a paid FLAME membership plan. Plan prices and what each includes are shown on the
        <Link href="/business/plan" className="text-brand underline"> Plans</Link> page.
      </p>

      <h2 className={h2}>6. Our rights</h2>
      <p className="mt-2">
        We may remove listings or content, limit features, or suspend accounts that break these terms or put other users at risk. You can appeal
        through Reports &amp; appeals in your account.
      </p>

      <h2 className={h2}>7. Liability</h2>
      <p className="mt-2">
        We work to keep the site safe and available, but we provide it “as is”. To the extent the law allows, we are not liable for losses from
        deals between users, or for content users post.
      </p>

      <h2 className={h2}>8. Privacy</h2>
      <p className="mt-2">
        How we handle your personal data is explained in our <Link href="/privacy" className="text-brand underline">Privacy Policy</Link>.
      </p>

      <h2 className={h2}>9. Changes and contact</h2>
      <p className="mt-2">
        We may update these terms; the date above shows the latest version. Questions:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-brand underline">{CONTACT_EMAIL}</a>
      </p>
      <p className="mt-2">These terms are governed by the laws of the Republic of the Philippines.</p>
    </article>
  );
}

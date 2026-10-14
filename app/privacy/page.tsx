import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How MarketplacePH collects, uses and protects your personal data under the Data Privacy Act of 2012 (RA 10173).",
};

const h2 = "mt-8 text-xl font-extrabold text-brand-dark";
const ul = "mt-2 list-disc space-y-1 pl-6";

/** Public privacy policy (also the link Google shows on its "Sign in with Google" screen). */
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl rounded-3xl border border-border bg-white p-6 leading-relaxed md:p-10">
      <h1 className="text-3xl font-extrabold text-brand-dark">Privacy Policy</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated: {LEGAL_UPDATED}</p>

      <p className="mt-6">
        MarketplacePH (“we”, “us”) runs marketplaceph.com, an online marketplace and job board for Philippine MSMEs, part of the FLAME PH MSME
        Ecosystem. We respect your privacy and follow the <b>Data Privacy Act of 2012 (Republic Act No. 10173)</b> and the rules of the National
        Privacy Commission (NPC). This policy explains what personal data we collect, why, and the choices you have.
      </p>

      <h2 className={h2}>1. What we collect</h2>
      <ul className={ul}>
        <li><b>Account details:</b> your email address or mobile number, display name and password (stored encrypted). If you sign in with Google, we receive your name, email address and profile picture from Google. We do not get your Google password.</li>
        <li><b>Store details (sellers):</b> store name, logo, description, location, contact number, website and social links, and the products or services you post.</li>
        <li><b>Messages and orders:</b> chats between buyers and sellers, order details, delivery name, phone and address, and payment proofs you upload.</li>
        <li><b>Verification (optional):</b> business or ID documents you choose to submit to get a “verified” badge. These are private and only seen by our review team.</li>
        <li><b>Jobs (optional):</b> if you make a job profile: your photo, birthdate, education, work history, resume and clearances that you choose to upload and share with employers.</li>
        <li><b>Business tools (optional):</b> records you enter yourself, such as income and expenses, inventory, customer notes and staff time records.</li>
        <li><b>Technical data:</b> basic cookies that keep you signed in and remember your language, and an affiliate cookie if you arrived through a seller’s promotion link.</li>
      </ul>

      <h2 className={h2}>2. Why we use it</h2>
      <ul className={ul}>
        <li>To create and run your account, store, listings, chats, orders and job applications.</li>
        <li>To show buyers who they are dealing with (store profile, ratings, verification level).</li>
        <li>To keep the marketplace safe: preventing fraud, handling reports and disputes, and enforcing our rules.</li>
        <li>To send you notifications about your messages, orders and account.</li>
        <li>To comply with the law and lawful requests from authorities.</li>
      </ul>
      <p className="mt-2">We do <b>not</b> sell your personal data, and we do not use it for third-party advertising.</p>

      <h2 className={h2}>3. Who can see your data</h2>
      <ul className={ul}>
        <li><b>Everyone:</b> what you publish on purpose: your store page, listings, reviews and public job posts.</li>
        <li><b>The other person in a deal:</b> a buyer and seller see each other’s chat, order and delivery details; an employer sees the job documents you choose to share when you apply.</li>
        <li><b>Our service providers</b>, only to run the site: Supabase (database, storage and sign-in), Vercel (website hosting) and Google (if you use “Continue with Google”). They are bound to protect your data.</li>
        <li><b>Authorities</b>, when the law requires it.</li>
      </ul>

      <h2 className={h2}>4. How long we keep it</h2>
      <p className="mt-2">
        We keep your data while your account is active. If you delete your account, we delete or anonymize your personal data, except records we
        must keep by law or to settle an open dispute or fraud report, which we keep only as long as needed.
      </p>

      <h2 className={h2}>5. How we protect it</h2>
      <p className="mt-2">
        Data is sent over encrypted connections (HTTPS) and stored with access rules so people only see what they are allowed to. Private files
        such as verification documents and job clearances are not public and are opened only through short-lived, logged links.
      </p>

      <h2 className={h2}>6. Your rights</h2>
      <p className="mt-2">Under the Data Privacy Act you have the right to:</p>
      <ul className={ul}>
        <li>be informed about how your data is used, and to access it;</li>
        <li>correct wrong or outdated data;</li>
        <li>object to processing, or withdraw consent where we rely on it;</li>
        <li>have your data erased or blocked, and to get a copy you can take elsewhere;</li>
        <li>file a complaint with the National Privacy Commission (privacy.gov.ph).</li>
      </ul>
      <p className="mt-2">
        You can update most details in <Link href="/account" className="font-semibold text-brand underline">Account</Link>, download your data
        there, or delete your account at any time. For anything else, email us.
      </p>

      <h2 className={h2}>7. Children</h2>
      <p className="mt-2">MarketplacePH is for people 18 and older. Job seekers must be at least 15 and follow Philippine labor laws on working minors.</p>

      <h2 className={h2}>8. Changes</h2>
      <p className="mt-2">If we change this policy, we will update the date above and, for important changes, tell you on the site.</p>

      <h2 className={h2}>9. Contact us</h2>
      <p className="mt-2">
        Questions or requests about your data: <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-brand underline">{CONTACT_EMAIL}</a>
      </p>
      <p className="mt-6 text-sm text-muted-foreground">
        See also our <Link href="/terms" className="text-brand underline">Terms of Use</Link>.
      </p>
    </article>
  );
}

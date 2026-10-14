import { AtSign, BriefcaseBusiness, Camera, Globe, Link2, MessageCircle, Phone, Send, ShoppingBag, ThumbsUp, Users, Video, type LucideIcon } from "lucide-react";

/**
 * Social & contact links a member can show on their profile. `host` limits a kind to its real site so a "Facebook"
 * link can't point somewhere else; WhatsApp / Viber take a phone number and open the chat app.
 * Labels live in messages/*.json as links.kind.<kind>.
 */
export const LINK_KINDS = ["facebook_page", "facebook", "website", "instagram", "tiktok", "youtube", "whatsapp", "viber", "telegram", "linkedin", "x", "shopee", "lazada", "other"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

type Spec = { icon: LucideIcon; input: "url" | "phone" | "handle"; host?: RegExp; placeholder: string };

export const LINK_SPECS: Record<LinkKind, Spec> = {
  facebook_page: { icon: ThumbsUp, input: "url", host: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i, placeholder: "https://facebook.com/YourStorePage" },
  facebook: { icon: Users, input: "url", host: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i, placeholder: "https://facebook.com/your.name" },
  website: { icon: Globe, input: "url", placeholder: "https://yourstore.ph" },
  instagram: { icon: Camera, input: "url", host: /(^|\.)instagram\.com$/i, placeholder: "https://instagram.com/yourstore" },
  tiktok: { icon: Video, input: "url", host: /(^|\.)tiktok\.com$/i, placeholder: "https://tiktok.com/@yourstore" },
  youtube: { icon: Video, input: "url", host: /(^|\.)(youtube\.com|youtu\.be)$/i, placeholder: "https://youtube.com/@yourstore" },
  whatsapp: { icon: MessageCircle, input: "phone", placeholder: "0917 123 4567" },
  viber: { icon: Phone, input: "phone", placeholder: "0917 123 4567" },
  telegram: { icon: Send, input: "handle", placeholder: "@yourname" },
  linkedin: { icon: BriefcaseBusiness, input: "url", host: /(^|\.)linkedin\.com$/i, placeholder: "https://linkedin.com/in/your-name" },
  x: { icon: AtSign, input: "url", host: /(^|\.)(x\.com|twitter\.com)$/i, placeholder: "https://x.com/yourstore" },
  shopee: { icon: ShoppingBag, input: "url", host: /(^|\.)shopee\.ph$/i, placeholder: "https://shopee.ph/yourstore" },
  lazada: { icon: ShoppingBag, input: "url", host: /(^|\.)lazada\.com\.ph$/i, placeholder: "https://lazada.com.ph/shop/yourstore" },
  other: { icon: Link2, input: "url", placeholder: "https://…" },
};

export type ProfileLink = { kind: string; value: string; label: string | null };

/** Cleans what the member typed. Returns the value to store, or null if it isn't valid for that kind. */
export function normalizeLink(kind: LinkKind, raw: string): string | null {
  const v = raw.trim();
  const spec = LINK_SPECS[kind];
  if (spec.input === "phone") {
    const digits = v.replace(/[^\d+]/g, "");
    const intl = digits.startsWith("+") ? digits : digits.startsWith("0") ? `+63${digits.slice(1)}` : digits.startsWith("63") ? `+${digits}` : `+${digits}`;
    return /^\+[0-9]{8,15}$/.test(intl) ? intl : null;
  }
  if (spec.input === "handle") {
    const m = v.match(/^(?:https?:\/\/)?(?:t\.me\/|@)?([A-Za-z0-9_]{3,40})\/?$/);
    return m ? `@${m[1]}` : null;
  }
  const withScheme = /^[a-z]+:\/\//i.test(v) ? v : `https://${v}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname.includes(".") || withScheme.length > 300) return null;
  if (spec.host && !spec.host.test(url.hostname)) return null;
  return url.toString();
}

/** Where tapping the link goes. */
export function linkHref(kind: string, value: string): string | null {
  if (kind === "whatsapp") return `https://wa.me/${value.replace(/[^\d]/g, "")}`;
  if (kind === "viber") return `viber://chat?number=${encodeURIComponent(value.replace(/[^\d+]/g, ""))}`;
  if (kind === "telegram") return `https://t.me/${value.replace(/^@/, "")}`;
  return /^https?:\/\//i.test(value) ? value : null; // never anything but http(s)
}

/** What to show on the chip: the phone / handle for chat apps, the site name for web links. */
export function linkText(kind: string, value: string): string {
  if (kind === "whatsapp" || kind === "viber" || kind === "telegram") return value;
  try {
    const u = new URL(value);
    const path = u.pathname.replace(/\/$/, "");
    return (u.hostname.replace(/^www\./, "") + path).slice(0, 40);
  } catch {
    return value.slice(0, 40);
  }
}

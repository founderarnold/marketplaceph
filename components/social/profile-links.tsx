import type { TFunction } from "@/lib/i18n/shared";
import { LINK_SPECS, linkHref, linkText, type LinkKind, type ProfileLink } from "@/lib/social-links";
import type { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function loadProfileLinks(supabase: Supabase, userId: string): Promise<ProfileLink[]> {
  const { data } = await supabase.from("profile_links").select("kind, value, label").eq("user_id", userId).order("position");
  return data ?? [];
}

/**
 * A member's public social & contact links as tappable chips (Facebook page, website, WhatsApp, Viber…).
 * `extra` adds older store-level links (store Facebook / website) without showing the same address twice.
 */
export function ProfileLinks({ links, extra = [], t, title, className }: { links: ProfileLink[]; extra?: ProfileLink[]; t: TFunction; title?: boolean; className?: string }) {
  const seen = new Set<string>();
  const all = [...links, ...extra].filter((l) => {
    const key = l.value.toLowerCase().replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!all.length) return null;
  return (
    <div className={cn("space-y-1.5", className)}>
      {title && <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("links.title")}</p>}
      <ul className="flex flex-wrap gap-1.5">
        {all.map((l, i) => {
          const href = linkHref(l.kind, l.value);
          if (!href) return null;
          const spec = LINK_SPECS[l.kind as LinkKind] ?? LINK_SPECS.other;
          const Icon = spec.icon;
          const name = l.kind === "other" && l.label ? l.label : t(`links.kind.${l.kind}`);
          return (
            <li key={i}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                title={linkText(l.kind, l.value)}
                className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-border bg-white px-3 text-sm font-semibold text-brand-dark hover:border-brand hover:bg-brand-soft"
              >
                <Icon size={15} className="shrink-0 text-brand" aria-hidden />
                <span className="truncate">{name}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

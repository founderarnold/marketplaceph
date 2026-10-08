import en from "@/messages/en.json";
import fil from "@/messages/fil.json";

export const LOCALES = ["en", "fil"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";

export type Dict = Record<string, string>;
const dictionaries: Record<Locale, Dict> = { en, fil };

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "fil";
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

/** Translate `key`, falling back to English, then to the key itself. Supports {name} placeholders. */
export function makeT(locale: Locale): TFunction {
  const dict = dictionaries[locale];
  return (key, vars) => {
    let s = dict[key] ?? dictionaries.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

export function getDictionary(locale: Locale): Dict {
  return dictionaries[locale];
}

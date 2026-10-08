"use client";

import { createContext, useContext, useMemo } from "react";
import { makeT, type Locale, type TFunction } from "./shared";

const Ctx = createContext<{ locale: Locale; t: TFunction }>({ locale: "en", t: makeT("en") });

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: makeT(locale) }), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT() {
  return useContext(Ctx);
}

"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { STRINGS, type Lang } from "./partner";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const v = window.localStorage.getItem("cv-lang");
      if (v === "es" || v === "en") setLangState(v);
    } catch { /* storage blocked: default English */ }
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem("cv-lang", l); } catch { /* ignore */ }
    document.documentElement.lang = l;
  };
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useLang() {
  const { lang, setLang } = useContext(Ctx);
  return { lang, setLang, t: STRINGS[lang] };
}

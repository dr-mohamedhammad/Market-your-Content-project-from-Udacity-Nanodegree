"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DICTS, type Dict, type Lang } from "@/lib/i18n";
import { readPref, writePref } from "@/lib/client";

export type Theme = "light" | "dark" | "system";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0f1117" : "#f7f7fb");
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    setLangState(readPref<Lang>("ui.lang", "en"));
    setThemeState(readPref<Theme>("ui.theme", "system"));
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => applyTheme("system");
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [theme]);

  const setLang = useCallback((l: Lang) => { setLangState(l); writePref("ui.lang", l); }, []);
  const setTheme = useCallback((t: Theme) => { setThemeState(t); writePref("ui.theme", t); }, []);

  return <AppCtx.Provider value={{ lang, setLang, t: DICTS[lang], theme, setTheme }}>{children}</AppCtx.Provider>;
}

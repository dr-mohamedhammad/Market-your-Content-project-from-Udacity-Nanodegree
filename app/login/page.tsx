"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/Providers";
import { api } from "@/lib/client";
import { Spinner } from "@/components/AppShell";

function LoginForm() {
  const { t, lang, setLang } = useApp();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", json: { password } });
      const next = params.get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-7 fade-in">
        <img src="/icons/icon-192.png" alt="" className="w-16 h-16 rounded-2xl mx-auto mb-4" />
        <h1 className="text-xl font-bold text-center">{t.appName}</h1>
        <p className="muted text-center text-sm mb-6">{t.welcomeTitle}</p>
        <label className="text-sm font-medium" htmlFor="pw">{t.password}</label>
        <input id="pw" type="password" autoComplete="current-password" className="input mt-1 mb-4" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy || !password}>{busy ? <Spinner /> : t.signIn}</button>
        <button type="button" onClick={() => setLang(lang === "en" ? "ar" : "en")} className="block mx-auto mt-5 text-sm muted underline">
          {lang === "en" ? "العربية" : "English"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}

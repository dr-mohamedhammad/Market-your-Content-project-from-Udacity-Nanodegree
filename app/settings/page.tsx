"use client";
import { useEffect, useState } from "react";
import { AppShell, ErrorBox, PageTitle, Spinner } from "@/components/AppShell";
import { useApp, type Theme } from "@/components/Providers";
import { useVoice, type VoiceEngine } from "@/components/useVoice";
import { IconPlay, IconX } from "@/components/Icons";
import { api } from "@/lib/client";
import type { Profile } from "@/lib/types";

interface Health { ai: boolean; auth: boolean; database: string; cloudVoice: boolean }

export default function SettingsPage() {
  const { t, lang, setLang, theme, setTheme } = useApp();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [name, setName] = useState("");
  const [interests, setInterests] = useState("");
  const [goal, setGoal] = useState(25);
  const voice = useVoice({ cloudAvailable: !!health?.cloudVoice });
  const [installEvt, setInstallEvt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);

  useEffect(() => {
    api<Profile>("/api/profile").then((p) => { setProfile(p); setName(p.name); setInterests(p.interests.join(", ")); setGoal(p.dailyGoalMinutes); }).catch((e) => setError(e.message));
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => undefined);
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e as Event & { prompt: () => Promise<void> }); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  async function save(patch: Partial<Profile>) {
    try {
      setProfile(await api<Profile>("/api/profile", { method: "PATCH", json: patch }));
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 1500);
    } catch (e) { setError((e as Error).message); }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  }

  const seg = <T extends string>(value: T, options: { v: T; l: string }[], onChange: (v: T) => void) => (
    <div className="flex flex-wrap rounded-2xl border border-soft p-1 gap-1">
      {options.map((o) => <button key={o.v} onClick={() => onChange(o.v)} className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${value === o.v ? "bg-brand-600 text-white" : "hover:bg-brand-500/10"}`}>{o.l}</button>)}
    </div>
  );

  return (
    <AppShell>
      <PageTitle title={t.settings} action={savedMsg ? <span className="text-sm text-emerald-600">{t.saved} ✓</span> : undefined} />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <div className="space-y-5">
        <section className="card p-5 space-y-4">
          <h2 className="font-semibold">{t.profile}</h2>
          {!profile ? <Spinner /> : (
            <>
              <label className="block text-sm">{t.yourName}
                <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== profile.name && save({ name })} />
              </label>
              <label className="block text-sm">{t.interests}
                <input className="input mt-1" dir="ltr" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="football, cooking, pharmacy, AI…"
                  onBlur={() => save({ interests: interests.split(",").map((s) => s.trim()).filter(Boolean) })} />
              </label>
              <label className="block text-sm">{t.dailyGoal}: <b>{goal}</b>
                <input type="range" min={10} max={60} step={5} className="w-full accent-brand-600 mt-2" value={goal} onChange={(e) => setGoal(Number(e.target.value))} onPointerUp={() => save({ dailyGoalMinutes: goal })} onKeyUp={() => save({ dailyGoalMinutes: goal })} />
              </label>
            </>
          )}
        </section>

        <section className="card p-5 space-y-4">
          <h2 className="font-semibold">{t.appearance}</h2>
          <div className="text-sm space-y-2"><p>{t.theme}</p>{seg<Theme>(theme, [{ v: "light", l: t.light }, { v: "dark", l: t.dark }, { v: "system", l: t.system }], setTheme)}</div>
          <div className="text-sm space-y-2"><p>{t.language}</p>{seg(lang, [{ v: "en", l: "English" }, { v: "ar", l: "العربية" }], setLang)}</div>
        </section>

        <section className="card p-5 space-y-4">
          <h2 className="font-semibold">{t.voice}</h2>
          <div className="text-sm space-y-2">
            <p>{t.voiceEngine}</p>
            {seg<VoiceEngine>(voice.settings.engine, [{ v: "auto", l: t.voiceAuto }, { v: "browser", l: t.voiceBrowser }, { v: "cloud", l: t.voiceCloud }], (engine) => voice.setSettings({ engine }))}
            <p className="text-xs muted">
              Mic: <b>{voice.sttEngine ?? "–"}</b> · Voice: <b>{voice.ttsEngine ?? "–"}</b>
              {!health?.cloudVoice && voice.settings.engine === "cloud" && " · Cloud voice needs OPENAI_API_KEY on the server."}
            </p>
          </div>
          {voice.ttsEngine === "browser" && (
            <label className="block text-sm">{t.tutorVoice}
              <select className="input mt-1" value={voice.settings.voiceURI ?? ""} onChange={(e) => voice.setSettings({ voiceURI: e.target.value || null })}>
                <option value="">Auto</option>
                {voice.voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
              </select>
            </label>
          )}
          <label className="block text-sm">{t.speechRate}: <b>{voice.settings.rate.toFixed(2)}×</b>
            <input type="range" min={0.7} max={1.2} step={0.05} className="w-full accent-brand-600 mt-2" value={voice.settings.rate} onChange={(e) => voice.setSettings({ rate: Number(e.target.value) })} />
          </label>
          <label className="flex items-center justify-between text-sm">{t.autoSpeak}
            <input type="checkbox" className="w-5 h-5 accent-brand-600" checked={voice.settings.autoSpeak} onChange={(e) => voice.setSettings({ autoSpeak: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between text-sm">{t.handsFree}
            <input type="checkbox" className="w-5 h-5 accent-brand-600" checked={voice.settings.handsFree} onChange={(e) => voice.setSettings({ handsFree: e.target.checked })} />
          </label>
          <button className="btn btn-ghost" onClick={() => voice.speak("test", "Hi! I'm Emma, your English teacher. Shall we practise a little today?")}><IconPlay className="w-4 h-4" />{t.testVoice}</button>
        </section>

        {profile && (
          <section className="card p-5">
            <h2 className="font-semibold">{t.memory}</h2>
            <p className="text-xs muted mb-3">{t.memoryHint}</p>
            {profile.tutorNotes.length === 0 ? <p className="text-sm muted">{t.empty}</p> : (
              <ul className="space-y-1.5" dir="ltr">
                {profile.tutorNotes.map((n, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm rounded-xl border border-soft px-3 py-2">
                    <span>{n}</span>
                    <button onClick={() => save({ tutorNotes: profile.tutorNotes.filter((_, j) => j !== i) })} className="muted hover:text-red-600 p-1" aria-label={t.delete}><IconX className="w-4 h-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="card p-5 space-y-3">
          <h2 className="font-semibold">{t.installApp}</h2>
          {installEvt ? <button className="btn btn-primary" onClick={() => installEvt.prompt()}>{t.installApp}</button> : <p className="text-sm muted">{t.installHint}</p>}
        </section>

        {health && (
          <section className="card p-5 text-sm">
            <h2 className="font-semibold mb-2">{t.status}</h2>
            <ul className="space-y-1" dir="ltr">
              <li>AI tutor (Claude): {health.ai ? "✅ configured" : "❌ ANTHROPIC_API_KEY missing"}</li>
              <li>Database: {health.database === "supabase" ? "✅ Supabase" : "📁 Local file (data/tutor-db.json)"}</li>
              <li>Cloud voice: {health.cloudVoice ? "✅ OpenAI" : "— browser voice only"}</li>
            </ul>
          </section>
        )}

        <button className="btn btn-ghost w-full text-red-600" onClick={logout}>{t.logout}</button>
      </div>
    </AppShell>
  );
}

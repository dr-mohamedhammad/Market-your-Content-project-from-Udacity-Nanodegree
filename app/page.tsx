"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, ErrorBox, Spinner } from "@/components/AppShell";
import { useApp } from "@/components/Providers";
import { IconArrow, IconBook, IconClock, IconFlame, IconSpark } from "@/components/Icons";
import { ModePicker, ScoreBadge, modeLabel } from "@/components/ModePicker";
import { api, fmtDate } from "@/lib/client";
import { LEVEL_INFO } from "@/lib/learning";
import type { Mode } from "@/lib/types";
import type { getDashboard } from "@/lib/service";

type Dash = Awaited<ReturnType<typeof getDashboard>>;

export default function Dashboard() {
  const { t, lang } = useApp();
  const router = useRouter();
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [weekly, setWeekly] = useState<{ summary: string | null; focusNextWeek: string[]; stats: { minutes: number; completed: number; averageScore: number | null } } | null>(null);
  const [weeklyBusy, setWeeklyBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api<Dash>("/api/dashboard").then((d) => { setData(d); setMode((m) => m ?? d.daily.mode); }).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function start(kind: "daily" | "surprise" | "custom", label: string) {
    setStarting(label);
    setError(null);
    try {
      const body: Record<string, unknown> = { kind, mode: kind === "surprise" ? undefined : mode };
      if (kind === "custom") body.topic = { title: custom, category: "Custom", seed: custom };
      const { id } = await api<{ id: string }>("/api/sessions", { method: "POST", json: body });
      router.push(`/session/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setStarting(null);
    }
  }

  async function loadWeekly() {
    setWeeklyBusy(true);
    try { setWeekly(await api("/api/weekly")); } catch (e) { setError((e as Error).message); }
    setWeeklyBusy(false);
  }

  const hour = new Date().getHours();
  const greet = hour < 12 ? t.greetingMorning : hour < 18 ? t.greetingAfternoon : t.greetingEvening;

  if (starting) {
    return (
      <div className="min-h-dvh grid place-items-center px-6 text-center">
        <div className="fade-in">
          <div className="w-20 h-20 mx-auto rounded-full bg-brand-600/10 grid place-items-center mb-5"><Spinner className="w-9 h-9 text-brand-600" /></div>
          <p className="font-semibold text-lg">{t.preparing}</p>
          <p className="muted text-sm mt-2" dir="ltr">{starting}</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell wide>
      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} retryLabel={t.retry} /></div>}
      {!data ? (
        <div className="grid place-items-center py-24"><Spinner className="w-8 h-8 text-brand-600" /></div>
      ) : (
        <div className="space-y-5 fade-in">
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="muted text-sm">{greet}{data.profile.name ? `, ${data.profile.name}` : ""} 👋</p>
              <h1 className="text-2xl font-bold tracking-tight">{t.appName}</h1>
            </div>
            <Link href="/progress" className="text-end">
              <span className="inline-block rounded-full bg-brand-600 text-white font-bold px-3 py-1 text-sm">{data.profile.level}</span>
              <p className="text-xs muted mt-1">{lang === "ar" ? LEVEL_INFO[data.profile.level].nameAr : LEVEL_INFO[data.profile.level].name}</p>
            </Link>
          </header>

          {data.unfinished && (
            <Link href={`/session/${data.unfinished.id}`} className="card block p-5 border-brand-400/60 bg-gradient-to-br from-brand-50 to-transparent dark:from-brand-700/20 hover:shadow-lg transition">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                {data.unfinished.daysAgo === 1 ? t.continueYesterday : t.continueTitle}
              </p>
              <div dir="ltr" className="text-start">
                <p className="font-semibold text-lg mt-1">{data.unfinished.title}</p>
                <p className="text-sm mt-2">
                  {welcomeBackLine(data.unfinished.daysAgo, data.unfinished.title)}
                </p>
                {data.unfinished.lastTutorQuestion && (
                  <p className="text-sm muted mt-2 italic">“{data.unfinished.lastTutorQuestion}”</p>
                )}
              </div>
              <span className="btn btn-primary mt-4">{t.continueBtn} <IconArrow className="w-4 h-4 rtl:rotate-180" /></span>
            </Link>
          )}

          <section className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide muted">{t.todayLesson}</p>
              {data.daily.isRevisit && <span className="text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 px-2 py-0.5">{t.revisit}</span>}
            </div>
            <div dir="ltr" className="text-start">
              <h2 className="text-xl font-bold mt-1">{data.daily.topic.title}</h2>
              <p className="muted text-sm">{data.daily.topic.category}</p>
            </div>
            {data.daily.isRevisit && <p className="text-sm mt-2">{t.revisitNote}</p>}
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">{t.chooseMode}</p>
              <ModePicker value={mode ?? data.daily.mode} onChange={setMode} />
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              <button className="btn btn-primary flex-1 min-w-[12rem]" onClick={() => start("daily", data.daily.topic.title)}>{t.startToday}</button>
              <button className="btn btn-ghost" onClick={() => start("surprise", t.surpriseMe)}><IconSpark /> {t.surpriseMe}</button>
            </div>
            <button className="text-sm muted underline mt-3" onClick={() => setShowCustom((s) => !s)}>{t.custom}</button>
            {showCustom && (
              <form className="flex gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) start("custom", custom); }}>
                <input dir="ltr" className="input" placeholder={t.customPlaceholder} value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={120} />
                <button className="btn btn-primary" disabled={!custom.trim()}>{t.start}</button>
              </form>
            )}
          </section>

          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat icon={<IconFlame className="w-5 h-5 text-orange-500" />} label={t.streak} value={data.streak.current} sub={`${t.best}: ${data.streak.best}`} />
            <Stat label={t.sessions} value={data.totals.sessions} />
            <Stat icon={<IconClock className="w-5 h-5 text-brand-500" />} label={t.minutes} value={data.totals.minutes} />
            <Stat icon={<IconBook className="w-5 h-5 text-emerald-500" />} label={t.words} value={data.totals.vocabulary} sub={`${t.mastered}: ${data.totals.mastered}`} />
          </section>

          <div className="grid md:grid-cols-2 gap-5">
            <section className="card p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{t.todayGoal}</h3>
                <span className="text-sm muted">{data.totals.todayMinutes} {t.minOf} {data.profile.dailyGoalMinutes}</span>
              </div>
              <div className="h-2.5 rounded-full bg-black/5 dark:bg-white/10 mt-3 overflow-hidden">
                <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.min(100, (data.totals.todayMinutes / data.profile.dailyGoalMinutes) * 100)}%` }} />
              </div>
              <h3 className="font-semibold mt-6 mb-3">{t.thisWeek}</h3>
              <WeekBars week={data.week} goal={data.profile.dailyGoalMinutes} lang={lang} />
            </section>

            <section className="card p-5">
              <h3 className="font-semibold mb-3">{t.needsWork}</h3>
              {data.focusAreas.length === 0 ? (
                <p className="muted text-sm">{t.noFocus}</p>
              ) : (
                <ul className="space-y-3" dir="ltr">
                  {data.focusAreas.map((f) => (
                    <li key={f.pattern} className="text-start">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{f.pattern}</span>
                        <span className="text-xs muted">×{f.count}</span>
                      </div>
                      {f.example && (
                        <p className="text-xs mt-0.5"><span className="line-through text-red-500/80">{f.example.wrong}</span> → <span className="text-emerald-600 dark:text-emerald-400">{f.example.right}</span></p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {data.profile.lastRecommendation && (
                <div className="mt-5 rounded-xl bg-brand-500/10 p-3">
                  <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">{t.recommendation}</p>
                  <p className="text-sm mt-1" dir="ltr">{data.profile.lastRecommendation}</p>
                </div>
              )}
            </section>
          </div>

          {data.totals.due > 0 && (
            <Link href="/vocabulary?filter=due" className="card p-4 flex items-center justify-between hover:shadow-md transition">
              <span className="flex items-center gap-3"><IconBook className="w-6 h-6 text-emerald-500" /><span><b>{data.totals.due}</b> {t.dueReview}</span></span>
              <span className="btn btn-ghost !min-h-0 !py-1.5">{t.review}</span>
            </Link>
          )}

          <section className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{t.weeklySummary}</h3>
              <button className="btn btn-ghost !min-h-0 !py-1.5 text-sm" onClick={loadWeekly} disabled={weeklyBusy}>{weeklyBusy ? <Spinner className="w-4 h-4" /> : t.generate}</button>
            </div>
            {weekly && (
              <div dir="ltr" className="text-start text-sm fade-in">
                <p className="muted mb-2">{weekly.stats.completed} sessions · {weekly.stats.minutes} min · avg {weekly.stats.averageScore ?? "–"}/10</p>
                {weekly.summary ? <p>{weekly.summary}</p> : <p className="muted">{t.empty}</p>}
                {weekly.focusNextWeek.length > 0 && <ul className="list-disc ps-5 mt-2 space-y-1">{weekly.focusNextWeek.map((f) => <li key={f}>{f}</li>)}</ul>}
              </div>
            )}
          </section>

          {data.recent.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{t.recentLessons}</h3>
                <Link href="/history" className="text-sm text-brand-600 dark:text-brand-400">{t.viewAll}</Link>
              </div>
              <div className="space-y-2">
                {data.recent.map((s) => (
                  <Link key={s.id} href={s.status === "completed" ? `/session/${s.id}?report=1` : `/session/${s.id}`} className="card p-4 flex items-center justify-between gap-3 hover:shadow-md transition">
                    <div className="min-w-0" dir="ltr">
                      <p className="font-medium truncate text-start">{s.title}</p>
                      <p className="text-xs muted text-start">{fmtDate(s.date, lang)} · {modeLabel(s.mode, t)} · {s.minutes} {t.minutesShort}</p>
                    </div>
                    {s.overall != null ? <ScoreBadge score={s.overall} /> : <span className="text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 px-2 py-0.5 shrink-0">{t.inProgress}</span>}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}

function welcomeBackLine(daysAgo: number, title: string) {
  const when = daysAgo <= 0 ? "Earlier today" : daysAgo === 1 ? "Yesterday" : `${daysAgo} days ago`;
  return `Welcome back! ${when} we were talking about “${title}”. Let's continue from where we stopped!`;
}

function Stat({ label, value, sub, icon }: { label: string; value: number | string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 muted text-xs font-medium">{icon}{label}</div>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs muted">{sub}</p>}
    </div>
  );
}

function WeekBars({ week, goal, lang }: { week: { date: string; minutes: number }[]; goal: number; lang: string }) {
  const max = Math.max(goal, ...week.map((w) => w.minutes), 1);
  return (
    <div className="flex items-end gap-2 h-32" role="img" aria-label="Minutes practised in the last 7 days">
      {week.map((w) => (
        <div key={w.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
          <span className="text-[10px] tabular-nums muted opacity-0 group-hover:opacity-100 transition">{w.minutes}</span>
          <div
            title={`${w.date}: ${w.minutes} min`}
            className="w-full max-w-8 rounded-t-[4px]"
            style={{ height: `${Math.max(2, (w.minutes / max) * 100)}%`, background: w.minutes >= goal ? "var(--series-1)" : "color-mix(in srgb, var(--series-1) 45%, transparent)" }}
          />
          <span className="text-[10px] muted">{new Date(w.date + "T12:00:00").toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { weekday: "narrow" })}</span>
        </div>
      ))}
    </div>
  );
}

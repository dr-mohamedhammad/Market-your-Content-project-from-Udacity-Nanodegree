"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, ErrorBox, PageTitle, Spinner } from "@/components/AppShell";
import { useApp } from "@/components/Providers";
import { ModePicker, ScoreBadge, modeLabel } from "@/components/ModePicker";
import { IconArrow, IconCheck } from "@/components/Icons";
import { api } from "@/lib/client";
import { LIBRARY, type LibraryLesson } from "@/lib/curriculum";
import { LEVEL_INFO, LEVEL_ORDER } from "@/lib/learning";
import type { Level, Mode, Profile, SessionSummary } from "@/lib/types";

export default function LibraryPage() {
  const { t, lang } = useApp();
  const router = useRouter();
  const [profileLevel, setProfileLevel] = useState<Level | null>(null);
  const [level, setLevel] = useState<Level>("B1");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("free");
  const [starting, setStarting] = useState<LibraryLesson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Profile>("/api/profile").then((p) => { setProfileLevel(p.level); setLevel(p.level); }).catch((e) => setError(e.message));
    api<SessionSummary[]>("/api/sessions").then(setSessions).catch(() => undefined);
  }, []);

  // Best result and any unfinished session for each library lesson.
  const status = useMemo(() => {
    const map = new Map<string, { best: number | null; active: string | null; done: boolean }>();
    for (const s of sessions) {
      if (!s.lessonId) continue;
      const cur = map.get(s.lessonId) ?? { best: null, active: null, done: false };
      if (s.status === "completed") { cur.done = true; if (s.overall != null) cur.best = Math.max(cur.best ?? 0, s.overall); }
      else if (!cur.active) cur.active = s.id;
      map.set(s.lessonId, cur);
    }
    return map;
  }, [sessions]);

  const lessons = LIBRARY.filter((l) => l.level === level);
  const doneCount = lessons.filter((l) => status.get(l.id)?.done).length;

  async function start(l: LibraryLesson) {
    setStarting(l);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/sessions", { method: "POST", json: { kind: "library", lessonId: l.id, mode } });
      router.push(`/session/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setStarting(null);
    }
  }

  if (starting) {
    return (
      <div className="min-h-dvh grid place-items-center px-6 text-center">
        <div className="fade-in">
          <div className="w-20 h-20 mx-auto rounded-full bg-brand-600/10 grid place-items-center mb-5"><Spinner className="w-9 h-9 text-brand-600" /></div>
          <p className="font-semibold text-lg">{t.preparing}</p>
          <p className="muted text-sm mt-2" dir="ltr">{starting.level} · {starting.title}</p>
        </div>
      </div>
    );
  }

  const levelIdx = (l: Level) => LEVEL_ORDER.indexOf(l);

  return (
    <AppShell>
      <PageTitle title={t.libraryTitle} subtitle={t.librarySubtitle} />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 -mx-1 px-1" role="tablist">
        {LEVEL_ORDER.map((l) => (
          <button
            key={l}
            role="tab"
            aria-selected={level === l}
            onClick={() => { setLevel(l); setOpen(null); }}
            className={`shrink-0 rounded-2xl border px-4 py-2 text-start transition ${level === l ? "bg-brand-600 border-brand-600 text-white" : "border-soft hover:bg-brand-500/5"}`}
          >
            <span className="block font-bold text-sm">{l}</span>
            <span className={`block text-[11px] ${level === l ? "text-white/80" : "muted"}`}>{l === profileLevel ? `★ ${t.yourLevel}` : lang === "ar" ? LEVEL_INFO[l].nameAr : LEVEL_INFO[l].name}</span>
          </button>
        ))}
      </div>

      <div className="card p-4 mb-4">
        <div className="flex justify-between text-sm">
          <span className="font-semibold">{level} – {lang === "ar" ? LEVEL_INFO[level].nameAr : LEVEL_INFO[level].name}</span>
          <span className="muted tabular-nums">{doneCount} / {lessons.length} {t.doneLessons}</span>
        </div>
        <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 mt-2 overflow-hidden">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(doneCount / lessons.length) * 100}%` }} />
        </div>
      </div>

      <ol className="space-y-2">
        {lessons.map((l) => {
          const st = status.get(l.id);
          const isOpen = open === l.id;
          return (
            <li key={l.id} className={`card overflow-hidden transition ${isOpen ? "ring-2 ring-brand-500/40" : ""}`}>
              <button className="w-full p-4 flex items-start gap-3 text-start" onClick={() => { setOpen(isOpen ? null : l.id); setMode(l.mode); }} aria-expanded={isOpen}>
                <span className={`shrink-0 w-9 h-9 rounded-xl grid place-items-center text-sm font-bold ${st?.done ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-brand-500/10 text-brand-700 dark:text-brand-300"}`}>
                  {st?.done ? <IconCheck className="w-5 h-5" /> : l.unit}
                </span>
                <span className="min-w-0 flex-1" dir="ltr">
                  <span className="block font-semibold text-start">{l.title}</span>
                  <span className="block text-xs muted text-start mt-0.5">{l.category} · {modeLabel(l.mode, t)}</span>
                  <span className="block text-xs mt-1 text-start text-brand-700 dark:text-brand-300">{l.focus}</span>
                </span>
                {st?.best != null ? <ScoreBadge score={st.best} /> : st?.active ? <span className="text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 px-2 py-0.5 shrink-0">{t.inProgress}</span> : null}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 space-y-3 fade-in">
                  <p className="text-sm" dir="ltr">{l.description}</p>
                  {profileLevel && levelIdx(l.level) > levelIdx(profileLevel) && <p className="text-xs rounded-xl bg-amber-500/10 p-2.5">{t.aboveLevel}</p>}
                  {profileLevel && levelIdx(l.level) < levelIdx(profileLevel) && <p className="text-xs rounded-xl bg-emerald-500/10 p-2.5">{t.belowLevel}</p>}
                  {st?.active ? (
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/session/${st.active}`} className="btn btn-primary flex-1">{t.continueLesson} <IconArrow className="w-4 h-4 rtl:rotate-180" /></Link>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm font-medium mb-2">{t.chooseMode}</p>
                        <ModePicker value={mode} onChange={setMode} />
                      </div>
                      <button className="btn btn-primary w-full" onClick={() => start(l)}>{st?.done ? t.practiceAgain : t.startLesson}</button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </AppShell>
  );
}

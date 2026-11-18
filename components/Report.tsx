"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "./Providers";
import { IconBook, IconCheck, IconPlay } from "./Icons";
import { Spinner } from "./AppShell";
import { api } from "@/lib/client";
import type { Session } from "@/lib/types";

type S = Omit<Session, "context">;

export function Report({ session, speak, speakingId }: { session: S; speak: (id: string, text: string) => void; speakingId: string | null }) {
  const { t } = useApp();
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const r = session.report!;
  const rows: { label: string; value: number | null }[] = [
    { label: t.grammar, value: r.scores.grammar },
    { label: t.vocabularyScore, value: r.scores.vocabulary },
    { label: t.sentenceConstruction, value: r.scores.sentenceConstruction },
    { label: t.fluency, value: r.scores.fluency },
    { label: t.comprehension, value: r.scores.comprehension },
    { label: t.pronunciation, value: r.scores.pronunciation },
  ];

  async function again() {
    setStarting(true);
    try {
      const { id } = await api<{ id: string }>("/api/sessions", { method: "POST", json: { kind: "revisit", revisitOf: session.id } });
      router.push(`/session/${id}`);
    } catch {
      setStarting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-16 space-y-5 fade-in">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">{t.report}</p>
        <h1 className="text-2xl font-bold mt-1" dir="ltr">{session.plan.title}</h1>
        <p className="muted text-sm">{session.date} · {session.level}</p>
      </div>

      <section className="card p-5 grid sm:grid-cols-[auto_1fr] gap-6 items-center">
        <div className="text-center">
          <div className="w-28 h-28 rounded-full grid place-items-center mx-auto" style={{ background: `conic-gradient(var(--series-1) ${r.overall * 36}deg, var(--grid) 0)` }}>
            <div className="w-[5.6rem] h-[5.6rem] rounded-full grid place-items-center" style={{ background: "var(--card)" }}>
              <span className="text-3xl font-bold tabular-nums">{r.overall.toFixed(1)}</span>
            </div>
          </div>
          <p className="text-sm muted mt-2">{t.overall} / 10</p>
        </div>
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="flex justify-between text-sm"><span>{row.label}</span><span className="tabular-nums font-semibold">{row.value == null ? <span className="muted font-normal text-xs">{t.notAssessed}</span> : `${row.value}/10`}</span></div>
              <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 mt-1 overflow-hidden">
                {row.value != null && <div className="h-full rounded-full" style={{ width: `${row.value * 10}%`, background: "var(--series-1)" }} />}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5" dir="ltr">
        <p className="leading-relaxed">{r.summary}</p>
        <div className="grid sm:grid-cols-2 gap-4 mt-4 text-sm">
          <div><p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">{t.strengths}</p><ul className="list-disc ps-5 space-y-1">{r.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
          <div><p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">{t.improve}</p><ul className="list-disc ps-5 space-y-1">{r.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul></div>
        </div>
      </section>

      <section className="card p-5" dir="ltr">
        <h2 className="font-semibold mb-3">{t.topMistakes}</h2>
        <ol className="space-y-3">
          {r.topMistakes.map((m, i) => (
            <li key={i} className="rounded-xl border border-soft p-3 text-sm">
              <p className="text-[11px] uppercase tracking-wide muted font-semibold">{m.category}</p>
              <p className="line-through decoration-red-500/70 text-red-600/90 dark:text-red-400/90">{m.original}</p>
              <p className="font-medium text-emerald-700 dark:text-emerald-400">→ {m.corrected}</p>
              <p className="muted text-xs mt-1">{m.explanation}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="card p-5" dir="ltr">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{t.newExpressions}</h2>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><IconCheck className="w-4 h-4" />{t.savedToNotebook}</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {r.newExpressions.map((v) => (
            <div key={v.expression} className="rounded-xl border border-soft p-3 text-sm">
              <p className="font-semibold">{v.expression}</p>
              <p className="muted text-xs">{v.meaning}</p>
              <p className="text-xs italic mt-1">“{v.example}”</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5" dir="ltr">
        <h2 className="font-semibold mb-3">{t.practiceSentences}</h2>
        <ul className="space-y-2">
          {r.practiceSentences.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-3 rounded-xl bg-brand-500/10 px-3 py-2 text-sm">
              <span>{s}</span>
              <button onClick={() => speak(`practice-${i}`, s)} className={`shrink-0 p-2 rounded-full ${speakingId === `practice-${i}` ? "text-brand-600" : "muted"}`} aria-label={t.replay}><IconPlay className="w-4 h-4" /></button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5 border-brand-400/60" dir="ltr">
        <h2 className="font-semibold">{t.tomorrow}</h2>
        <p className="text-sm mt-1">{r.tomorrowRecommendation}</p>
      </section>

      <div className="flex flex-wrap gap-2 justify-center">
        <Link href="/" className="btn btn-primary">{t.backHome}</Link>
        <Link href="/vocabulary" className="btn btn-ghost"><IconBook className="w-4 h-4" />{t.notebook}</Link>
        <Link href={`/session/${session.id}?transcript=1`} className="btn btn-ghost">Transcript</Link>
        <button className="btn btn-ghost" onClick={again} disabled={starting}>{starting ? <Spinner className="w-4 h-4" /> : null}{t.practiceAgain}</button>
      </div>
    </div>
  );
}

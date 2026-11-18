"use client";
import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, ErrorBox, PageTitle, Spinner } from "@/components/AppShell";
import { useApp } from "@/components/Providers";
import { api, fmtDate } from "@/lib/client";
import { LEVEL_INFO, LEVEL_ORDER } from "@/lib/learning";
import type { getDashboard } from "@/lib/service";

type Dash = Awaited<ReturnType<typeof getDashboard>>;
type Row = Dash["progress"][number];

const SKILLS = [
  { key: "grammar", color: "var(--series-1)" },
  { key: "vocabulary", color: "var(--series-2)" },
  { key: "sentenceConstruction", color: "var(--series-3)" },
  { key: "fluency", color: "var(--series-4)" },
  { key: "comprehension", color: "var(--series-5)" },
] as const;

export default function ProgressPage() {
  const { t, lang } = useApp();
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"chart" | "table">("chart");

  useEffect(() => { api<Dash>("/api/dashboard").then(setData).catch((e) => setError(e.message)); }, []);

  const label = (k: (typeof SKILLS)[number]["key"]) =>
    ({ grammar: t.grammar, vocabulary: t.vocabularyScore, sentenceConstruction: t.sentenceConstruction, fluency: t.fluency, comprehension: t.comprehension })[k];

  const rows = (data?.progress ?? []).map((r, i) => ({ ...r, n: i + 1, label: fmtDate(r.date, lang) }));

  return (
    <AppShell wide>
      <PageTitle title={t.progress} action={rows.length > 0 ? (
        <div className="flex rounded-full border border-soft p-0.5 text-sm">
          {(["chart", "table"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`px-3 py-1 rounded-full ${view === v ? "bg-brand-600 text-white" : ""}`}>{v === "chart" ? t.chart : t.table}</button>)}
        </div>) : undefined} />
      {error && <ErrorBox message={error} />}
      {!data ? <div className="grid place-items-center py-16"><Spinner className="w-7 h-7 text-brand-600" /></div> : (
        <div className="space-y-5 fade-in">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{t.level}</h2>
              <span className="text-sm muted">{lang === "ar" ? LEVEL_INFO[data.profile.level].nameAr : LEVEL_INFO[data.profile.level].name}</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 mt-4" dir="ltr">
              {LEVEL_ORDER.map((l) => {
                const reached = LEVEL_ORDER.indexOf(l) <= LEVEL_ORDER.indexOf(data.profile.level);
                return (
                  <div key={l} className="text-center">
                    <div className={`h-2.5 rounded-full ${reached ? "bg-brand-600" : "bg-black/10 dark:bg-white/10"}`} />
                    <p className={`text-xs mt-1.5 ${l === data.profile.level ? "font-bold text-brand-600 dark:text-brand-400" : "muted"}`}>{l}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs muted mt-3">{t.levelRule}</p>
            <h3 className="font-semibold text-sm mt-4 mb-2">{t.levelHistory}</h3>
            <ul className="text-sm space-y-1" dir="ltr">
              {[...data.profile.levelHistory].reverse().map((c) => (
                <li key={c.at} className="flex gap-2"><span className="muted shrink-0">{fmtDate(c.at, "en")}</span><span><b>{c.from ? `${c.from} → ` : ""}{c.to}</b> – {c.reason}</span></li>
              ))}
            </ul>
          </section>

          {rows.length === 0 ? <p className="muted card p-5">{t.noData}</p> : view === "table" ? (
            <section className="card p-0 overflow-x-auto">
              <table className="w-full text-sm" dir="ltr">
                <thead><tr className="text-start muted border-b border-soft">
                  <th className="p-3 text-start font-medium">{t.date}</th>
                  <th className="p-3 text-start font-medium">Lesson</th>
                  <th className="p-3 font-medium">{t.overall}</th>
                  {SKILLS.map((s) => <th key={s.key} className="p-3 font-medium">{label(s.key)}</th>)}
                </tr></thead>
                <tbody>
                  {[...rows].reverse().map((r) => (
                    <tr key={r.n} className="border-b border-soft last:border-0">
                      <td className="p-3 whitespace-nowrap">{r.date}</td>
                      <td className="p-3 min-w-40">{r.title}</td>
                      <td className="p-3 text-center font-semibold tabular-nums">{r.overall}</td>
                      {SKILLS.map((s) => <td key={s.key} className="p-3 text-center tabular-nums">{r[s.key]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : (
            <>
              <section className="card p-5">
                <h2 className="font-semibold mb-1">{t.scoreHistory}</h2>
                <p className="text-xs muted mb-3">{t.overall} (1–10)</p>
                <div className="h-56" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
                      <CartesianGrid stroke="var(--grid)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={{ stroke: "var(--grid)" }} minTickGap={24} />
                      <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTip rows={rows} keys={[{ key: "overall", label: t.overall, color: "var(--series-1)" }]} />} cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }} />
                      <Line type="monotone" dataKey="overall" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: "var(--series-1)" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card p-5">
                <h2 className="font-semibold mb-3">{t.skills}</h2>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs" aria-label="Legend">
                  {SKILLS.map((s) => <li key={s.key} className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ background: s.color, height: 3 }} />{label(s.key)}</li>)}
                </ul>
                <div className="h-64" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
                      <CartesianGrid stroke="var(--grid)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={{ stroke: "var(--grid)" }} minTickGap={24} />
                      <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTip rows={rows} keys={SKILLS.map((s) => ({ key: s.key, label: label(s.key), color: s.color }))} />} cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }} />
                      {SKILLS.map((s) => (
                        <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: s.color }} activeDot={{ r: 6 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs muted mt-2">{t.pronunciation}: {t.notAssessed}</p>
              </section>
            </>
          )}

          {data.focusAreas.length > 0 && (
            <section className="card p-5">
              <h2 className="font-semibold mb-3">{t.needsWork}</h2>
              <ul className="space-y-2" dir="ltr">
                {data.focusAreas.map((f) => {
                  const max = Math.max(...data.focusAreas.map((x) => x.count));
                  return (
                    <li key={f.pattern} className="text-sm">
                      <div className="flex justify-between"><span>{f.pattern}</span><span className="muted tabular-nums">×{f.count}</span></div>
                      <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(f.count / max) * 100}%`, background: "var(--series-2)" }} /></div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}

function ChartTip({ active, payload, rows, keys }: { active?: boolean; payload?: { payload: Row & { n: number } }[]; rows: (Row & { n: number })[]; keys: { key: string; label: string; color: string }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  void rows;
  return (
    <div className="card px-3 py-2 text-xs shadow-lg" style={{ minWidth: 160 }}>
      <p className="font-semibold">{r.title}</p>
      <p className="muted mb-1">{r.date}</p>
      {keys.map((k) => (
        <p key={k.key} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: k.color }} />{k.label}</span>
          <b className="tabular-nums">{(r as unknown as Record<string, number>)[k.key]}</b>
        </p>
      ))}
    </div>
  );
}

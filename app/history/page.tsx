"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, ErrorBox, PageTitle, Spinner } from "@/components/AppShell";
import { useApp } from "@/components/Providers";
import { ScoreBadge, modeLabel } from "@/components/ModePicker";
import { api, fmtDate } from "@/lib/client";
import type { SessionSummary } from "@/lib/types";

export default function HistoryPage() {
  const { t, lang } = useApp();
  const [items, setItems] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => { api<SessionSummary[]>("/api/sessions").then(setItems).catch((e) => setError(e.message)); }, []);
  const list = (items ?? []).filter((s) => !q || (s.title + " " + s.category).toLowerCase().includes(q.toLowerCase()));

  return (
    <AppShell>
      <PageTitle title={t.history} subtitle={items ? `${items.length} ${t.sessions.toLowerCase()}` : undefined} />
      {error && <ErrorBox message={error} />}
      <input className="input mb-4" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} dir="ltr" />
      {!items ? <div className="grid place-items-center py-16"><Spinner className="w-7 h-7 text-brand-600" /></div> : list.length === 0 ? <p className="muted">{t.empty}</p> : (
        <div className="space-y-2">
          {list.map((s) => (
            <Link key={s.id} href={`/session/${s.id}`} className="card p-4 block hover:shadow-md transition">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0" dir="ltr">
                  <p className="font-semibold text-start">{s.title}</p>
                  <p className="text-xs muted text-start">{s.category} · {modeLabel(s.mode, t)}</p>
                </div>
                {s.overall != null ? <ScoreBadge score={s.overall} /> : <span className="text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 px-2 py-0.5 shrink-0">{t.inProgress}</span>}
              </div>
              <p className="text-xs muted mt-2">{fmtDate(s.date, lang)} · {s.minutes} {t.minutesShort} · {s.messageCount} {t.messages}</p>
              {s.status === "active" && s.lastTutorQuestion && <p className="text-sm italic mt-2 muted" dir="ltr">“{s.lastTutorQuestion}”</p>}
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

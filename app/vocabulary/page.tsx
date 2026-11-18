"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, ErrorBox, PageTitle, Spinner } from "@/components/AppShell";
import { useApp } from "@/components/Providers";
import { useVoice } from "@/components/useVoice";
import { IconMic, IconPlay, IconPlus, IconTrash } from "@/components/Icons";
import { api } from "@/lib/client";
import type { VocabEntry } from "@/lib/types";

type Filter = "all" | "due" | "struggling" | "mastered";

export default function VocabularyPage() {
  const { t } = useApp();
  const [items, setItems] = useState<VocabEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ expression: "", meaning: "", example: "" });
  const [cards, setCards] = useState<VocabEntry[] | null>(null);
  const [practice, setPractice] = useState<VocabEntry | null>(null);
  const [cloud, setCloud] = useState(false);
  const voice = useVoice({ cloudAvailable: cloud });

  const load = useCallback(() => api<VocabEntry[]>("/api/vocab").then(setItems).catch((e) => setError(e.message)), []);
  useEffect(() => {
    void load();
    if (new URLSearchParams(window.location.search).get("filter") === "due") setFilter("due");
    fetch("/api/health").then((r) => r.json()).then((h) => setCloud(!!h.cloudVoice)).catch(() => undefined);
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const list = useMemo(() => (items ?? []).filter((v) =>
    filter === "all" ? true : filter === "due" ? v.nextReview <= today : filter === "struggling" ? v.struggling : v.status === "mastered"), [items, filter, today]);

  function upsert(v: VocabEntry) { setItems((xs) => xs ? (xs.some((x) => x.id === v.id) ? xs.map((x) => (x.id === v.id ? v : x)) : [v, ...xs]) : [v]); }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try { upsert(await api<VocabEntry>("/api/vocab", { method: "POST", json: form })); setForm({ expression: "", meaning: "", example: "" }); setAdding(false); }
    catch (err) { setError((err as Error).message); }
  }
  async function remove(id: string) {
    if (!confirm(t.delete + "?")) return;
    try { await api(`/api/vocab/${id}`, { method: "DELETE" }); setItems((xs) => xs?.filter((x) => x.id !== id) ?? null); } catch (err) { setError((err as Error).message); }
  }

  const statusLabel = (v: VocabEntry) => (v.status === "mastered" ? t.mastered : v.status === "learning" ? t.learning : t.newWord);

  return (
    <AppShell>
      <PageTitle title={t.notebook} subtitle={items ? `${items.length} ${t.words.toLowerCase()}` : undefined}
        action={<button className="btn btn-ghost !min-h-0 !py-2" onClick={() => setAdding((a) => !a)}><IconPlus className="w-4 h-4" />{t.addExpression}</button>} />
      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      {adding && (
        <form onSubmit={add} className="card p-4 mb-4 space-y-2 fade-in" dir="ltr">
          <input className="input" placeholder={t.expression} value={form.expression} onChange={(e) => setForm({ ...form, expression: e.target.value })} required />
          <input className="input" placeholder={t.meaning} value={form.meaning} onChange={(e) => setForm({ ...form, meaning: e.target.value })} />
          <input className="input" placeholder={t.example} value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} />
          <button className="btn btn-primary">{t.save}</button>
        </form>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        {(["all", "due", "struggling", "mastered"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium border shrink-0 ${filter === f ? "bg-brand-600 text-white border-brand-600" : "border-soft"}`}>
            {t[f]} {items && <span className="opacity-70">({(items ?? []).filter((v) => f === "all" || (f === "due" ? v.nextReview <= today : f === "struggling" ? v.struggling : v.status === "mastered")).length})</span>}
          </button>
        ))}
        {list.length > 0 && <button className="btn btn-primary !min-h-0 !py-1.5 text-sm shrink-0 ms-auto" onClick={() => setCards([...list].sort(() => Math.random() - 0.5).slice(0, 15))}>{t.flashcards}</button>}
      </div>

      {cards && <Flashcards cards={cards} onClose={() => setCards(null)} onReviewed={upsert} speak={voice.speak} />}
      {practice && <Practice entry={practice} voice={voice} onClose={() => setPractice(null)} onReviewed={upsert} />}

      {!items ? <div className="grid place-items-center py-16"><Spinner className="w-7 h-7 text-brand-600" /></div> : list.length === 0 ? <p className="muted">{t.empty}</p> : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((v) => (
            <div key={v.id} className="card p-4" dir="ltr">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{v.expression}</p>
                <span className={`text-[11px] rounded-full px-2 py-0.5 shrink-0 ${v.struggling ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" : v.status === "mastered" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-brand-100 text-brand-800 dark:bg-brand-700/30 dark:text-brand-200"}`}>{v.struggling ? t.struggling : statusLabel(v)}</span>
              </div>
              {v.meaning && <p className="text-sm muted mt-1">{v.meaning}</p>}
              {v.example && <p className="text-sm italic mt-1.5">“{v.example}”</p>}
              {v.sourceTopic && <p className="text-[11px] muted mt-2">{v.sourceTopic}</p>}
              <div className="flex items-center gap-1 mt-3">
                <button className="p-2 rounded-full muted hover:text-brand-600" onClick={() => voice.speak(v.id, `${v.expression}. ${v.example}`)} aria-label={t.replay}><IconPlay className="w-4 h-4" /></button>
                <button className="btn btn-ghost !min-h-0 !py-1 !px-3 text-xs" onClick={() => setPractice(v)}>{t.practice}</button>
                <button className="p-2 rounded-full muted hover:text-red-600 ms-auto" onClick={() => remove(v.id)} aria-label={t.delete}><IconTrash className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-end sm:place-items-center p-0 sm:p-4" onClick={onClose}>
      <div className="card w-full sm:max-w-md rounded-b-none sm:rounded-b-[1.25rem] p-5 fade-in" onClick={(e) => e.stopPropagation()} dir="ltr">{children}</div>
    </div>
  );
}

function Flashcards({ cards, onClose, onReviewed, speak }: { cards: VocabEntry[]; onClose: () => void; onReviewed: (v: VocabEntry) => void; speak: (id: string, text: string) => void }) {
  const { t } = useApp();
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const c = cards[i];
  async function answer(success: boolean) {
    try { onReviewed(await api<VocabEntry>(`/api/vocab/${c.id}`, { method: "PATCH", json: { success } })); } catch {}
    setShown(false);
    if (i + 1 >= cards.length) onClose(); else setI(i + 1);
  }
  return (
    <Modal onClose={onClose}>
      <p className="text-xs muted text-center">{i + 1} / {cards.length}</p>
      <div className="min-h-44 grid place-items-center text-center py-6">
        <div>
          <p className="text-2xl font-bold">{c.expression}</p>
          <button className="muted mt-2 inline-flex items-center gap-1 text-sm" onClick={() => speak(c.id, c.expression)}><IconPlay className="w-4 h-4" /> {t.replay}</button>
          {shown && <div className="mt-4 fade-in"><p>{c.meaning}</p><p className="italic muted mt-2">“{c.example}”</p></div>}
        </div>
      </div>
      {!shown ? <button className="btn btn-primary w-full" onClick={() => setShown(true)}>{t.showAnswer}</button> : (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-ghost" onClick={() => answer(false)}>{t.iForgot}</button>
          <button className="btn btn-primary" onClick={() => answer(true)}>{t.iKnew}</button>
        </div>
      )}
    </Modal>
  );
}

function Practice({ entry, voice, onClose, onReviewed }: { entry: VocabEntry; voice: ReturnType<typeof useVoice>; onClose: () => void; onReviewed: (v: VocabEntry) => void }) {
  const { t } = useApp();
  const [sentence, setSentence] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; feedback: string; improved: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function check() {
    setBusy(true); setErr(null);
    try {
      const r = await api<{ correct: boolean; feedback: string; improved: string; entry: VocabEntry }>(`/api/vocab/${entry.id}/practice`, { method: "POST", json: { sentence } });
      setResult(r); onReviewed(r.entry);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  return (
    <Modal onClose={onClose}>
      <p className="font-bold text-lg">{entry.expression}</p>
      <p className="muted text-sm">{entry.meaning}</p>
      <p className="text-sm mt-4 mb-2">{t.writeSentence}</p>
      <div className="flex gap-2">
        <textarea className="input" rows={2} value={sentence} onChange={(e) => setSentence(e.target.value)} />
        <button type="button" className={`btn !px-3 ${voice.state === "listening" ? "bg-red-500 text-white mic-pulse" : "btn-ghost"}`} disabled={!voice.sttEngine}
          onClick={() => voice.state === "listening" ? voice.stopListening() : voice.listen((txt) => txt && setSentence((s) => (s ? s + " " : "") + txt))}>
          <IconMic />
        </button>
      </div>
      {voice.state === "listening" && voice.interim && <p className="text-sm italic muted mt-1">{voice.interim}</p>}
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      {result && (
        <div className={`mt-3 rounded-xl p-3 text-sm ${result.correct ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
          <p className="font-semibold">{result.correct ? "✓" : "✎"} {result.feedback}</p>
          <p className="mt-1 italic">{result.improved}</p>
        </div>
      )}
      <div className="flex gap-2 mt-4">
        <button className="btn btn-ghost flex-1" onClick={onClose}>{t.cancel}</button>
        <button className="btn btn-primary flex-1" disabled={!sentence.trim() || busy} onClick={check}>{busy ? <Spinner /> : t.check}</button>
      </div>
    </Modal>
  );
}

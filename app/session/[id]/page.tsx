"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ErrorBox, Spinner } from "@/components/AppShell";
import { useApp } from "@/components/Providers";
import { useVoice } from "@/components/useVoice";
import { modeLabel } from "@/components/ModePicker";
import { Report } from "@/components/Report";
import { IconBack, IconBook, IconCheck, IconKeyboard, IconMic, IconPlay, IconRefresh, IconSend, IconStop } from "@/components/Icons";
import { api } from "@/lib/client";
import { activeSeconds } from "@/lib/learning";
import type { ChatMessage, Correction, Session } from "@/lib/types";
import type { Dict } from "@/lib/i18n";

type ClientSession = Omit<Session, "context">;

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useApp();
  const search = useSearchParams();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRetry, setPendingRetry] = useState<{ text: string; inputMode: "voice" | "text" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [showLesson, setShowLesson] = useState(false);
  const [cloudAvailable, setCloudAvailable] = useState(false);
  const [now, setNow] = useState(Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);
  const resumed = useRef(false);

  const voice = useVoice({ cloudAvailable });
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then((h: { cloudVoice?: boolean }) => setCloudAvailable(!!h.cloudVoice)).catch(() => undefined);
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const visible = useMemo(() => session?.messages.filter((m) => m.kind === "normal") ?? [], [session]);

  const addMessages = useCallback((...msgs: ChatMessage[]) => {
    setSession((s) => (s ? { ...s, messages: [...s.messages, ...msgs], updatedAt: new Date().toISOString() } : s));
  }, []);

  /** Speak a tutor reply; in hands-free mode, start listening again afterwards. */
  const deliver = useCallback(async (msg: ChatMessage) => {
    const v = voiceRef.current;
    if (v.settings.autoSpeak && v.ttsEngine) await v.speak(msg.id, msg.text);
    if (voiceRef.current.settings.handsFree && voiceRef.current.sttEngine) startListeningRef.current();
  }, []);

  // ── Load + "continue where we stopped" ──
  useEffect(() => {
    let cancelled = false;
    api<ClientSession>(`/api/sessions/${id}`)
      .then(async (s) => {
        if (cancelled) return;
        setSession(s);
        if (s.status !== "active" || resumed.current) return;
        resumed.current = true;
        const vis = s.messages.filter((m) => m.kind === "normal");
        const last = vis[vis.length - 1];
        const fresh = vis.length === 1 && Date.now() - Date.parse(s.startedAt) < 120_000;
        if (fresh && last) { void deliver(last); return; }
        // Returning after a break → the tutor welcomes you back and continues.
        if (last && Date.now() - Date.parse(last.at) > 30 * 60 * 1000) {
          setBusy(true);
          try {
            const { reply } = await api<{ reply: ChatMessage | null }>(`/api/sessions/${id}/resume`, { method: "POST" });
            if (reply && !cancelled) { addMessages(reply); void deliver(reply); }
          } catch (e) {
            if (!cancelled) setError((e as Error).message);
          } finally {
            if (!cancelled) setBusy(false);
          }
        } else if (last?.role === "user") {
          setPendingRetry({ text: last.text, inputMode: last.inputMode ?? "text" });
        }
      })
      .catch((e) => !cancelled && setLoadError(e.message));
    return () => { cancelled = true; };
  }, [id, addMessages, deliver]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [visible.length, busy, voice.interim]);

  // ── Sending ──
  const send = useCallback(async (text: string, inputMode: "voice" | "text") => {
    const clean = text.trim();
    if (!clean || busy) return;
    setError(null);
    setPendingRetry(null);
    const local: ChatMessage = { id: `local-${Date.now()}`, role: "user", kind: "normal", text: clean, at: new Date().toISOString(), inputMode };
    addMessages(local);
    setBusy(true);
    try {
      const { reply } = await api<{ reply: ChatMessage }>(`/api/sessions/${id}/message`, { method: "POST", json: { text: clean, inputMode } });
      addMessages(reply);
      setBusy(false);
      void deliver(reply);
    } catch (e) {
      setBusy(false);
      setError((e as Error).message);
      setPendingRetry({ text: clean, inputMode });
    }
  }, [busy, id, addMessages, deliver]);

  const retry = useCallback(async () => {
    if (!pendingRetry) return;
    setError(null);
    setBusy(true);
    try {
      // Was the learner's message saved? Then only the tutor reply needs retrying.
      const s = await api<ClientSession>(`/api/sessions/${id}`);
      const last = s.messages[s.messages.length - 1];
      let reply: ChatMessage | null;
      if (last && last.role === "user" && last.kind === "normal") {
        reply = (await api<{ reply: ChatMessage | null }>(`/api/sessions/${id}/retry`, { method: "POST" })).reply;
        setSession(s);
      } else {
        setSession({ ...s, messages: [...s.messages, { id: `local-${Date.now()}`, role: "user", kind: "normal", text: pendingRetry.text, at: new Date().toISOString(), inputMode: pendingRetry.inputMode }] });
        reply = (await api<{ reply: ChatMessage }>(`/api/sessions/${id}/message`, { method: "POST", json: pendingRetry })).reply;
      }
      setPendingRetry(null);
      if (reply) { addMessages(reply); void deliver(reply); }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [pendingRetry, id, addMessages, deliver]);

  // ── Voice input ──
  const startListening = useCallback(() => {
    voiceRef.current.listen((text) => {
      if (text) void sendRef.current(text, "voice");
    });
  }, []);
  const startListeningRef = useRef(startListening);
  startListeningRef.current = startListening;
  const sendRef = useRef(send);
  sendRef.current = send;

  function onMic() {
    if (voice.state === "listening") voice.stopListening();
    else if (voice.state === "speaking") { voice.stopSpeaking(); startListening(); }
    else if (voice.state === "idle" && !busy) startListening();
  }

  async function finish() {
    voice.stopSpeaking();
    voice.cancelListening();
    setFinishing(true);
    setError(null);
    try {
      const { report } = await api<{ report: Session["report"] }>(`/api/sessions/${id}/end`, { method: "POST" });
      setSession((s) => (s ? { ...s, status: "completed", report } : s));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFinishing(false);
    }
  }

  if (loadError) return <div className="p-6 max-w-lg mx-auto"><ErrorBox message={loadError} /><Link href="/" className="btn btn-ghost mt-4">{t.backHome}</Link></div>;
  if (!session) return <div className="min-h-dvh grid place-items-center"><Spinner className="w-8 h-8 text-brand-600" /></div>;

  if (session.status === "completed" && session.report && (search.get("report") || !search.get("transcript"))) {
    return <Report session={session} speak={(mid, text) => voice.speak(mid, text)} speakingId={voice.speakingId} />;
  }

  const minutes = Math.round(activeSeconds({ messages: session.messages }) / 60);
  void now;
  const micError = voice.error === "mic_denied" ? t.micDenied : voice.error === "no_speech" ? t.noSpeech : voice.error ? t.error : null;
  const lastTutor = [...visible].reverse().find((m) => m.role === "tutor");
  const active = session.status === "active";

  return (
    <div className="min-h-dvh flex flex-col max-w-3xl mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-20 px-3 py-2.5 flex items-center gap-2 border-b border-soft" style={{ background: "color-mix(in srgb, var(--surface) 90%, transparent)", backdropFilter: "blur(12px)" }}>
        <Link href="/" className="p-2 rounded-full hover:bg-brand-500/10" aria-label={t.backHome}><IconBack className="w-5 h-5 rtl:rotate-180" /></Link>
        <div className="min-w-0 flex-1" dir="ltr">
          <p className="font-semibold truncate text-start">{session.plan.title}</p>
          <p className="text-xs muted text-start">{modeLabel(session.mode, t)} · {session.level} · {minutes} {t.timer}</p>
        </div>
        <button onClick={() => setShowLesson((s) => !s)} className={`btn btn-ghost !min-h-0 !py-1.5 !px-3 text-sm ${showLesson ? "bg-brand-500/10" : ""}`}><IconBook className="w-4 h-4" />{t.showLesson}</button>
      </header>

      {showLesson && <LessonPanel session={session} t={t} />}

      {/* Transcript */}
      <div className="flex-1 px-3 sm:px-4 py-4 space-y-4" dir="ltr">
        {session.isRevisit && <p className="text-center text-xs muted">{t.revisitNote}</p>}
        {visible.map((m) =>
          m.role === "tutor" ? (
            <TutorBubble
              key={m.id}
              m={m}
              t={t}
              speaking={voice.speakingId === m.id}
              onReplay={() => (voice.speakingId === m.id ? voice.stopSpeaking() : voice.speak(m.id, m.text))}
              onRepeat={active && m.id === lastTutor?.id && m.repeatPrompt ? () => (typing ? setDraft(m.repeatPrompt ?? "") : startListening()) : undefined}
            />
          ) : (
            <div key={m.id} className="flex justify-end fade-in">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 text-white px-4 py-2.5">
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.inputMode === "voice" && <p className="text-[10px] opacity-70 mt-0.5 flex items-center gap-1 justify-end"><IconMic className="w-3 h-3" /> voice</p>}
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 muted text-sm fade-in">
            <span className="dots text-2xl leading-none"><span>•</span><span>•</span><span>•</span></span> {t.thinking}
          </div>
        )}
        {voice.state === "listening" && voice.interim && (
          <div className="flex justify-end"><p className="max-w-[85%] rounded-2xl border border-dashed border-brand-400 px-4 py-2.5 muted italic">{voice.interim}</p></div>
        )}
        {error && <ErrorBox message={error} onRetry={pendingRetry ? retry : undefined} retryLabel={t.retry} />}
        {micError && <ErrorBox message={micError} />}
        {active && minutes >= 20 && <p className="text-center text-xs text-emerald-600 dark:text-emerald-400">{t.goalReached}</p>}
        <div ref={bottomRef} />
      </div>

      {/* Controls */}
      {active ? (
        <div className="sticky bottom-0 z-20 border-t border-soft px-3 pt-3 pb-4 safe-bottom" style={{ background: "color-mix(in srgb, var(--card) 94%, transparent)", backdropFilter: "blur(12px)" }}>
          {typing ? (
            <>
            <div className="flex justify-end mb-2">
              <button className="btn btn-ghost !min-h-0 !py-1.5 !px-3 text-xs" onClick={finish} disabled={finishing || busy || !visible.some((m) => m.role === "user")}>
                {finishing ? <Spinner className="w-4 h-4" /> : <IconCheck className="w-4 h-4" />}{finishing ? t.finishing : t.finish}
              </button>
            </div>
            <form className="flex gap-2 items-end" dir="ltr" onSubmit={(e) => { e.preventDefault(); const d = draft; setDraft(""); void send(d, "text"); }}>
              <button type="button" className="btn btn-ghost !px-3" onClick={() => setTyping(false)} aria-label="Use microphone"><IconMic /></button>
              <textarea
                className="input resize-none max-h-40"
                rows={1}
                placeholder={t.typeInstead}
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const d = draft; setDraft(""); void send(d, "text"); } }}
              />
              <button className="btn btn-primary !px-4" disabled={!draft.trim() || busy} aria-label={t.send}><IconSend /></button>
            </form>
            </>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col items-start gap-1 w-24">
                <button className="btn btn-ghost !px-3 !min-h-0 !py-2" onClick={() => { voice.cancelListening(); setTyping(true); }} aria-label={t.typeInstead}><IconKeyboard /></button>
                <label className="flex items-center gap-1.5 text-[11px] muted cursor-pointer">
                  <input type="checkbox" className="accent-brand-600" checked={voice.settings.handsFree} onChange={(e) => voice.setSettings({ handsFree: e.target.checked })} />
                  {t.handsFree}
                </label>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={onMic}
                  disabled={busy || voice.state === "transcribing" || !voice.sttEngine}
                  aria-label={voice.state === "listening" ? t.listening : t.tapToSpeak}
                  className={`relative w-20 h-20 rounded-full grid place-items-center text-white shadow-lg transition active:scale-95 disabled:opacity-50 ${voice.state === "listening" ? "bg-red-500 mic-pulse" : "bg-brand-600 hover:bg-brand-700"}`}
                  style={voice.state === "listening" && voice.sttEngine === "cloud" ? { boxShadow: `0 0 0 ${4 + voice.level * 18}px color-mix(in srgb, #ef4444 35%, transparent)` } : undefined}
                >
                  {voice.state === "transcribing" ? <Spinner className="w-8 h-8" /> : voice.state === "listening" ? <IconStop className="w-8 h-8" /> : <IconMic className="w-9 h-9" />}
                </button>
                <span className="text-xs muted h-4">
                  {!voice.sttEngine ? t.typeInstead : busy ? t.thinking : voice.state === "listening" ? t.listening : voice.state === "speaking" ? t.speaking : voice.state === "transcribing" ? "…" : t.tapToSpeak}
                </span>
              </div>
              <div className="w-24 flex justify-end">
                <button className="btn btn-ghost !min-h-0 !py-2 !px-3 text-xs leading-tight" onClick={finish} disabled={finishing || busy || !visible.some((m) => m.role === "user")}>
                  {finishing ? <Spinner className="w-4 h-4" /> : <IconCheck className="w-4 h-4" />}
                  <span className="hidden sm:inline">{finishing ? t.finishing : t.finish}</span>
                  <span className="sm:hidden">{finishing ? "…" : t.finishShort}</span>
                </button>
              </div>
            </div>
          )}
          {finishing && <p className="text-center text-xs muted mt-2">{t.finishing}</p>}
        </div>
      ) : (
        <div className="p-4 text-center"><Link href={`/session/${id}?report=1`} className="btn btn-primary">{t.report}</Link></div>
      )}
    </div>
  );
}

function categoryLabel(c: Correction["category"], t: Dict) {
  return { grammar: t.correctionGrammar, vocabulary: t.correctionVocabulary, structure: t.correctionStructure, naturalness: t.correctionNaturalness, pronunciation: t.correctionPronunciation }[c];
}

const CAT_STYLE: Record<Correction["category"], string> = {
  grammar: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  vocabulary: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  structure: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  naturalness: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  pronunciation: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
};

function TutorBubble({ m, t, speaking, onReplay, onRepeat }: { m: ChatMessage; t: Dict; speaking: boolean; onReplay: () => void; onRepeat?: () => void }) {
  return (
    <div className="flex gap-2.5 fade-in">
      <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white grid place-items-center text-sm font-bold">E</div>
      <div className="max-w-[85%] space-y-2">
        {m.correction && (
          <div className="card p-3 text-sm border-amber-300/60 dark:border-amber-700/50">
            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${CAT_STYLE[m.correction.category]}`}>{categoryLabel(m.correction.category, t)}</span>
            <p className="mt-1.5"><span className="line-through decoration-red-500/70 text-red-600/90 dark:text-red-400/90">{m.correction.original}</span></p>
            <p className="font-medium text-emerald-700 dark:text-emerald-400">→ {m.correction.corrected}</p>
            <p className="muted mt-1 text-xs">{m.correction.explanation}</p>
          </div>
        )}
        {m.praise && <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">✓ {m.praise}</p>}
        <div className="card rounded-tl-md px-4 py-2.5">
          <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <button onClick={onReplay} className={`text-xs flex items-center gap-1 ${speaking ? "text-brand-600 dark:text-brand-400" : "muted"} hover:text-brand-600`}>
              <IconPlay className="w-3.5 h-3.5" /> {speaking ? "■" : t.replay}
            </button>
          </div>
        </div>
        {m.repeatPrompt && (
          <div className="rounded-2xl bg-brand-500/10 px-3 py-2 text-sm flex items-center justify-between gap-2">
            <span>🗣 <i>{m.repeatPrompt}</i></span>
            {onRepeat && <button onClick={onRepeat} className="btn btn-primary !min-h-0 !py-1 !px-3 text-xs shrink-0"><IconRefresh className="w-3.5 h-3.5" />{t.tryAgainSay}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function LessonPanel({ session, t }: { session: ClientSession; t: Dict }) {
  const used = new Set(session.usedExpressions.map((e) => e.toLowerCase()));
  const p = session.plan;
  return (
    <div className="px-4 py-4 border-b border-soft space-y-4 fade-in" dir="ltr" style={{ background: "var(--card)" }}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide muted">{t.introduction}</p>
        <p className="mt-1 text-sm">{p.introduction}</p>
      </div>
      {p.roleplay && (
        <div className="rounded-xl bg-brand-500/10 p-3 text-sm space-y-1">
          <p className="font-semibold">{t.roleplay}: {p.roleplay.scenario}</p>
          <p><b>{t.youPlay}:</b> {p.roleplay.userRole}</p>
          <p><b>{t.tutorPlays}:</b> {p.roleplay.tutorRole}</p>
          <p><b>{t.goal}:</b> {p.roleplay.goal}</p>
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide muted mb-2">{t.usefulExpressions}</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {p.vocabulary.map((v) => (
            <div key={v.expression} className={`min-w-[14rem] max-w-[16rem] rounded-2xl border p-3 text-sm ${used.has(v.expression.toLowerCase()) ? "border-emerald-400 bg-emerald-500/10" : "border-soft"}`}>
              <p className="font-semibold flex items-center gap-1">{used.has(v.expression.toLowerCase()) && <IconCheck className="w-4 h-4 text-emerald-600" />}{v.expression}</p>
              <p className="muted text-xs mt-1">{v.meaning}</p>
              <p className="text-xs mt-1.5 italic">“{v.example}”</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

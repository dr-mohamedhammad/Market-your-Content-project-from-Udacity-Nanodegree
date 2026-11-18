"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { readPref, writePref } from "@/lib/client";

/**
 * Voice engine with two real back-ends:
 *  - "browser": Web Speech API (SpeechRecognition + speechSynthesis). Free; best in Chrome/Edge (incl. Android).
 *  - "cloud":   MediaRecorder → /api/voice/stt and /api/voice/tts (OpenAI) – works in every modern browser.
 * "auto" uses cloud when the server has it configured, otherwise the browser.
 */

export type VoiceEngine = "auto" | "browser" | "cloud";
export interface VoiceSettings {
  engine: VoiceEngine;
  voiceURI: string | null;
  rate: number;
  autoSpeak: boolean;
  handsFree: boolean;
}
export const DEFAULT_VOICE: VoiceSettings = { engine: "auto", voiceURI: null, rate: 0.95, autoSpeak: true, handsFree: false };

export type VoiceState = "idle" | "listening" | "transcribing" | "speaking";

// Minimal typings for the (still prefixed in some browsers) SpeechRecognition API.
interface SRAlternative { transcript: string; confidence: number }
interface SRResult { isFinal: boolean; length: number; [i: number]: SRAlternative }
interface SREvent { resultIndex: number; results: { length: number; [i: number]: SRResult } }
interface SR {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechend?: (() => void) | null;
}
type SRCtor = new () => SR;

function getSR(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const isAndroid = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

/** Split text into sentence chunks – Chrome cuts off long utterances. */
function chunks(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + p).length > 180 && cur) { out.push(cur.trim()); cur = p; } else cur += p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function useVoiceSettings() {
  const [settings, setSettingsState] = useState<VoiceSettings>(DEFAULT_VOICE);
  useEffect(() => { setSettingsState({ ...DEFAULT_VOICE, ...readPref<Partial<VoiceSettings>>("voice.settings", {}) }); }, []);
  const setSettings = useCallback((patch: Partial<VoiceSettings>) => {
    setSettingsState((s) => { const n = { ...s, ...patch }; writePref("voice.settings", n); return n; });
  }, []);
  return [settings, setSettings] as const;
}

export function useBrowserVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (typeof speechSynthesis === "undefined") return;
    const load = () => setVoices(speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en")));
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  return voices;
}

function pickVoice(voices: SpeechSynthesisVoice[], uri: string | null) {
  if (uri) { const v = voices.find((x) => x.voiceURI === uri); if (v) return v; }
  const prefs = [/Google US English/i, /Samantha/i, /Microsoft (Aria|Jenny)/i, /en-US/i, /en-GB/i];
  for (const re of prefs) { const v = voices.find((x) => re.test(x.name) || re.test(x.lang)); if (v) return v; }
  return voices[0] ?? null;
}

export function useVoice(opts: { cloudAvailable: boolean }) {
  const [settings, setSettings] = useVoiceSettings();
  const voices = useBrowserVoices();
  const [state, setState] = useState<VoiceState>("idle");
  const [interim, setInterim] = useState("");
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [level, setLevel] = useState(0); // mic input level 0..1 (cloud mode)
  const [error, setError] = useState<string | null>(null);

  // Detected after mount so server and client render the same HTML.
  const [caps, setCaps] = useState({ sr: false, synth: false });
  useEffect(() => { setCaps({ sr: !!getSR(), synth: "speechSynthesis" in window }); }, []);
  const sttEngine: "browser" | "cloud" | null =
    settings.engine === "cloud" ? (opts.cloudAvailable ? "cloud" : caps.sr ? "browser" : null)
    : settings.engine === "browser" ? (caps.sr ? "browser" : opts.cloudAvailable ? "cloud" : null)
    : opts.cloudAvailable ? "cloud" : caps.sr ? "browser" : null;
  const ttsEngine: "browser" | "cloud" | null =
    (settings.engine === "cloud" || settings.engine === "auto") && opts.cloudAvailable ? "cloud"
    : caps.synth ? "browser" : opts.cloudAvailable ? "cloud" : null;

  // ─── refs shared across callbacks ───
  const srRef = useRef<SR | null>(null);
  const finalRef = useRef("");
  const wantRef = useRef(false); // user still wants to listen (Android restarts)
  const onDoneRef = useRef<((text: string) => void) | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef(new Map<string, string>());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const speakToken = useRef(0);

  // ─────────────────────────── Text-to-speech ───────────────────────────
  const stopSpeaking = useCallback(() => {
    speakToken.current++;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSpeakingId(null);
    setState((s) => (s === "speaking" ? "idle" : s));
  }, []);

  const speakBrowser = useCallback((text: string, token: number) => new Promise<void>((resolve) => {
    if (typeof speechSynthesis === "undefined") return resolve();
    speechSynthesis.cancel();
    const v = pickVoice(speechSynthesis.getVoices(), settingsRef.current.voiceURI);
    const parts = chunks(text);
    let i = 0;
    const next = () => {
      if (token !== speakToken.current || i >= parts.length) return resolve();
      const u = new SpeechSynthesisUtterance(parts[i++]);
      if (v) u.voice = v;
      u.lang = v?.lang ?? "en-US";
      u.rate = settingsRef.current.rate;
      u.onend = next;
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    };
    next();
  }), []);

  const speakCloud = useCallback(async (id: string, text: string, token: number) => {
    let url = audioCache.current.get(id);
    if (!url) {
      const r = await fetch("/api/voice/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, speed: settingsRef.current.rate }) });
      if (!r.ok) throw new Error("tts failed");
      url = URL.createObjectURL(await r.blob());
      audioCache.current.set(id, url);
    }
    if (token !== speakToken.current) return;
    await new Promise<void>((resolve, reject) => {
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => resolve();
      a.onpause = () => resolve();
      a.onerror = () => reject(new Error("audio error"));
      a.play().catch(reject);
    });
  }, []);

  /** Speak a tutor message. Resolves when finished (or interrupted). */
  const speak = useCallback(async (id: string, text: string) => {
    stopSpeaking();
    const token = ++speakToken.current;
    setSpeakingId(id);
    setState("speaking");
    try {
      if (ttsEngine === "cloud") {
        try { await speakCloud(id, text, token); }
        catch { if (token === speakToken.current) await speakBrowser(text, token); }
      } else if (ttsEngine === "browser") {
        await speakBrowser(text, token);
      }
    } finally {
      if (token === speakToken.current) { setSpeakingId(null); setState((s) => (s === "speaking" ? "idle" : s)); }
    }
  }, [ttsEngine, speakBrowser, speakCloud, stopSpeaking]);

  // ─────────────────────────── Speech-to-text ───────────────────────────
  const clearSilence = () => { if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; } };

  const cleanupAudio = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const finish = useCallback((text: string) => {
    clearSilence();
    wantRef.current = false;
    setInterim("");
    setState("idle");
    const cb = onDoneRef.current;
    onDoneRef.current = null;
    if (cb) cb(text.trim());
  }, []);

  const startBrowserSTT = useCallback(() => {
    const Ctor = getSR();
    if (!Ctor) { setError("no_speech"); return; }
    finalRef.current = "";
    wantRef.current = true;
    const android = isAndroid();
    const begin = () => {
      const sr = new Ctor();
      srRef.current = sr;
      sr.lang = "en-US";
      // Android Chrome duplicates text in continuous mode, so we restart single utterances instead.
      sr.continuous = !android;
      sr.interimResults = true;
      sr.maxAlternatives = 1;
      sr.onresult = (e) => {
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalRef.current += (finalRef.current ? " " : "") + r[0].transcript.trim();
          else interimText += r[0].transcript;
        }
        setInterim((finalRef.current + " " + interimText).trim());
        if (settingsRef.current.handsFree) {
          clearSilence();
          silenceTimer.current = setTimeout(() => { wantRef.current = false; sr.stop(); }, 2000);
        }
      };
      sr.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") { setError("mic_denied"); wantRef.current = false; }
        else if (e.error === "network") { setError("network"); wantRef.current = false; }
      };
      sr.onend = () => {
        if (wantRef.current) { try { begin(); return; } catch { /* fall through */ } }
        srRef.current = null;
        finish(finalRef.current);
      };
      sr.start();
    };
    setError(null);
    setInterim("");
    setState("listening");
    try { begin(); } catch { setError("no_speech"); setState("idle"); }
  }, [finish]);

  const startCloudSTT = useCallback(async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      setError("mic_denied");
      return;
    }
    streamRef.current = stream;
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recRef.current = rec;
    const parts: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
    rec.onstop = async () => {
      cleanupAudio();
      recRef.current = null;
      if (!wantRef.current) { finish(""); return; } // cancelled
      setState("transcribing");
      try {
        const blob = new Blob(parts, { type: rec.mimeType || "audio/webm" });
        const fd = new FormData();
        fd.append("audio", blob, "speech");
        const r = await fetch("/api/voice/stt", { method: "POST", body: fd });
        const data = (await r.json()) as { text?: string; error?: string };
        if (!r.ok) throw new Error(data.error || "stt");
        finish(data.text ?? "");
      } catch {
        setError("stt_failed");
        finish("");
      }
    };

    // Level meter + voice-activity detection for hands-free mode.
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let heard = false;
    let lastLoud = performance.now();
    const started = performance.now();
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      const rms = Math.sqrt(sum / buf.length);
      setLevel(Math.min(1, rms * 6));
      const t = performance.now();
      if (rms > 0.035) { heard = true; lastLoud = t; }
      const silentFor = t - lastLoud;
      if (rec.state === "recording" && ((settingsRef.current.handsFree && heard && silentFor > 1700) || t - started > 90_000)) {
        rec.stop();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    wantRef.current = true;
    rec.start(250);
    setInterim("");
    setState("listening");
    rafRef.current = requestAnimationFrame(tick);
  }, [cleanupAudio, finish]);

  /** Start listening; `onDone` receives the final transcript ("" if nothing was heard). */
  const listen = useCallback((onDone: (text: string) => void) => {
    stopSpeaking();
    onDoneRef.current = onDone;
    if (sttEngine === "cloud") void startCloudSTT();
    else if (sttEngine === "browser") startBrowserSTT();
    else setError("no_speech");
  }, [sttEngine, startBrowserSTT, startCloudSTT, stopSpeaking]);

  /** Stop listening and deliver what was heard. */
  const stopListening = useCallback(() => {
    clearSilence();
    if (recRef.current && recRef.current.state === "recording") { recRef.current.stop(); return; }
    wantRef.current = false;
    if (srRef.current) srRef.current.stop();
    else if (state === "listening") finish(finalRef.current);
  }, [finish, state]);

  /** Abort listening without sending. */
  const cancelListening = useCallback(() => {
    clearSilence();
    onDoneRef.current = null;
    wantRef.current = false;
    if (recRef.current && recRef.current.state === "recording") recRef.current.stop();
    srRef.current?.abort();
    srRef.current = null;
    cleanupAudio();
    setInterim("");
    setState("idle");
  }, [cleanupAudio]);

  useEffect(() => () => {
    // Unmount: stop everything and free cached audio.
    speakToken.current++;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    audioRef.current?.pause();
    srRef.current?.abort();
    wantRef.current = false;
    if (recRef.current?.state === "recording") recRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    for (const url of audioCache.current.values()) URL.revokeObjectURL(url);
  }, []);

  return {
    settings, setSettings, voices,
    sttEngine, ttsEngine,
    state, interim, level, error, setError,
    speak, stopSpeaking, speakingId,
    listen, stopListening, cancelListening,
  };
}

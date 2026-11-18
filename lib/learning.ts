// Pure learning logic: dates, time tracking, streaks, adaptive levels, memory merging, spaced repetition.
// Kept free of I/O so it can be unit-tested (see tests/).
import type {
  Correction,
  Level,
  LevelChange,
  MistakePattern,
  Profile,
  Session,
  SessionSummary,
  VocabEntry,
  VocabItem,
} from "./types";

export const LEVEL_ORDER: Level[] = ["B1", "B1+", "B2", "B2+", "C1"];

export const LEVEL_INFO: Record<Level, { name: string; nameAr: string }> = {
  B1: { name: "Intermediate", nameAr: "متوسط" },
  "B1+": { name: "Strong Intermediate", nameAr: "متوسط قوي" },
  B2: { name: "Upper Intermediate", nameAr: "فوق المتوسط" },
  "B2+": { name: "Advanced Intermediate", nameAr: "متوسط متقدم" },
  C1: { name: "Advanced", nameAr: "متقدم" },
};

/** YYYY-MM-DD for an instant in a given IANA time zone. */
export function localDate(at: Date | string, timeZone: string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Active learning time: sum of gaps between consecutive messages, each gap capped at 3 minutes
 * (so leaving the app open overnight doesn't count as study time).
 */
export function activeSeconds(s: Pick<Session, "messages">): number {
  const times = s.messages.filter((m) => m.kind === "normal").map((m) => Date.parse(m.at)).sort((a, b) => a - b);
  let total = 0;
  for (let i = 1; i < times.length; i++) total += Math.min(times[i] - times[i - 1], 180_000);
  if (times.length > 0) total += 20_000; // reading the first message
  return Math.round(total / 1000);
}

/** Days with at least one answer from the learner. */
export function practiceDays(sessions: Session[], timeZone: string): Set<string> {
  const days = new Set<string>();
  for (const s of sessions) for (const m of s.messages) if (m.role === "user" && m.kind === "normal") days.add(localDate(m.at, timeZone));
  return days;
}

export function computeStreak(days: Set<string>, today: string): { current: number; best: number } {
  // Current streak may end today or yesterday (today's practice not done yet keeps the streak alive).
  let current = 0;
  let cursor = days.has(today) ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...days].sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current) };
}

export function summarize(s: Session): SessionSummary {
  const visible = s.messages.filter((m) => m.kind === "normal");
  const lastTutor = [...visible].reverse().find((m) => m.role === "tutor");
  const lastUser = [...visible].reverse().find((m) => m.role === "user");
  return {
    id: s.id,
    title: s.plan.title,
    category: s.topic.category,
    mode: s.mode,
    status: s.status,
    date: s.date,
    startedAt: s.startedAt,
    updatedAt: s.updatedAt,
    overall: s.report?.overall ?? null,
    minutes: Math.round(activeSeconds(s) / 60),
    lastTutorQuestion: lastTutor ? lastQuestion(lastTutor.text) : null,
    lastUserAnswer: lastUser?.text ?? null,
    messageCount: visible.length,
  };
}

/** The last sentence ending in "?" (falls back to the last sentence). */
export function lastQuestion(text: string): string {
  const parts = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const q = [...parts].reverse().find((p) => p.trim().endsWith("?"));
  return (q ?? parts[parts.length - 1]).trim();
}

// ───────────────────────── Adaptive level ─────────────────────────

export const LEVEL_WINDOW = 5; // sessions considered
export const PROMOTE_AVG = 7.5;
export const PROMOTE_MIN = 6.5;
export const DEMOTE_AVG = 4.5;

/**
 * Level only changes based on several sessions at the current level, never on one good conversation:
 *  - promote when the last 5 completed sessions at this level average ≥ 7.5 and none is below 6.5,
 *  - step down when the last 5 average below 4.5 (keeps the challenge comfortable).
 */
export function evaluateLevel(profile: Profile, sessions: Session[], now: string): LevelChange | null {
  const sinceChange = profile.levelHistory.length ? profile.levelHistory[profile.levelHistory.length - 1].at : "";
  const atLevel = sessions
    .filter((s) => s.status === "completed" && s.report && s.level === profile.level && (s.completedAt ?? "") > sinceChange)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
    .slice(0, LEVEL_WINDOW);
  if (atLevel.length < LEVEL_WINDOW) return null;
  const scores = atLevel.map((s) => s.report!.overall);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const idx = LEVEL_ORDER.indexOf(profile.level);
  if (avg >= PROMOTE_AVG && Math.min(...scores) >= PROMOTE_MIN && idx < LEVEL_ORDER.length - 1) {
    return { at: now, from: profile.level, to: LEVEL_ORDER[idx + 1], reason: `Average ${avg.toFixed(1)}/10 over your last ${LEVEL_WINDOW} sessions at ${profile.level}.` };
  }
  if (avg < DEMOTE_AVG && idx > 0) {
    return { at: now, from: profile.level, to: LEVEL_ORDER[idx - 1], reason: `Average ${avg.toFixed(1)}/10 over your last ${LEVEL_WINDOW} sessions – consolidating before moving on.` };
  }
  return null;
}

export function overallScore(s: { grammar: number; vocabulary: number; sentenceConstruction: number; fluency: number; comprehension: number; pronunciation: number | null }): number {
  // Speaking fluency is the main goal, so it carries extra weight.
  const parts = [s.grammar, s.vocabulary, s.sentenceConstruction, s.fluency * 1.5, s.comprehension];
  let weight = 5.5;
  let sum = parts.reduce((a, b) => a + b, 0);
  if (s.pronunciation != null) { sum += s.pronunciation; weight += 1; }
  return Math.round((sum / weight) * 10) / 10;
}

// ───────────────────────── Mistake memory ─────────────────────────

export interface PatternObservation {
  key: string;
  category: Correction["category"];
  pattern: string;
  wrong: string;
  right: string;
  occurrences: number;
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "misc";
}

/** Merge mistake patterns seen in one session into long-term memory. */
export function mergeMistakes(existing: MistakePattern[], observed: PatternObservation[], now: string): MistakePattern[] {
  const map = new Map(existing.map((m) => [m.key, structuredClone(m)]));
  const seenKeys = new Set<string>();
  for (const o of observed) {
    const key = slug(o.key || o.pattern);
    if (seenKeys.has(key)) {
      const m = map.get(key)!;
      m.count += Math.max(1, o.occurrences);
      continue;
    }
    seenKeys.add(key);
    const m = map.get(key);
    if (m) {
      m.count += Math.max(1, o.occurrences);
      m.sessions += 1;
      m.lastSeen = now;
      m.improving = 0;
      m.examples = [{ wrong: o.wrong, right: o.right }, ...m.examples.filter((e) => e.wrong !== o.wrong)].slice(0, 4);
    } else {
      map.set(key, {
        key,
        category: o.category,
        pattern: o.pattern,
        examples: [{ wrong: o.wrong, right: o.right }],
        count: Math.max(1, o.occurrences),
        sessions: 1,
        lastSeen: now,
        improving: 0,
      });
    }
  }
  // Patterns not seen this session are "improving" one step.
  for (const m of map.values()) if (!seenKeys.has(m.key)) m.improving += 1;
  // Forget patterns that were minor and haven't come back for a long time.
  return [...map.values()]
    .filter((m) => !(m.count <= 1 && m.improving >= 8))
    .sort((a, b) => priority(b) - priority(a))
    .slice(0, 40);
}

/** Recurring + recent mistakes matter most. */
export function priority(m: MistakePattern): number {
  return m.sessions * 3 + m.count - m.improving * 2;
}

export function topMistakes(profile: Profile, n = 5): MistakePattern[] {
  return [...profile.mistakes].sort((a, b) => priority(b) - priority(a)).filter((m) => m.improving < 4).slice(0, n);
}

// ───────────────────────── Vocabulary (spaced repetition) ─────────────────────────

const INTERVALS = [1, 2, 4, 7, 14, 30, 60]; // days

export function newVocabEntry(item: VocabItem, id: string, now: string, source: { sessionId: string | null; topic: string | null }): VocabEntry {
  return {
    ...item,
    id,
    sourceSessionId: source.sessionId,
    sourceTopic: source.topic,
    addedAt: now,
    status: "new",
    reviews: 0,
    correct: 0,
    struggling: false,
    lastReviewed: null,
    nextReview: now.slice(0, 10),
  };
}

export function reviewVocab(v: VocabEntry, success: boolean, now: string): VocabEntry {
  const reviews = v.reviews + 1;
  const correct = v.correct + (success ? 1 : 0);
  const streakLevel = success ? Math.min(correct, INTERVALS.length) : 0;
  const days = success ? INTERVALS[Math.max(0, streakLevel - 1)] : 1;
  const accuracy = correct / reviews;
  return {
    ...v,
    reviews,
    correct,
    lastReviewed: now,
    nextReview: addDays(now.slice(0, 10), days),
    struggling: reviews >= 2 && accuracy < 0.5,
    status: correct >= 4 && accuracy >= 0.75 ? "mastered" : reviews > 0 ? "learning" : "new",
  };
}

export function isDue(v: VocabEntry, today: string): boolean {
  return v.nextReview <= today;
}

import "server-only";
import { randomUUID } from "crypto";
import { getStore } from "./store";
import { chooseDailyTopic, daysBetween } from "./topics";
import {
  activeSeconds,
  computeStreak,
  evaluateLevel,
  localDate,
  mergeMistakes,
  newVocabEntry,
  overallScore,
  practiceDays,
  reviewVocab,
  summarize,
  topMistakes,
  isDue,
  addDays,
} from "./learning";
import { buildLearnerContext } from "./tutor/prompts";
import { assessSession, checkVocabSentence, generateLesson, surpriseTopic, tutorTurn, weeklySummary } from "./tutor/engine";
import { TutorError } from "./tutor/claude";
import type { ChatMessage, Mode, Profile, Session, SessionReport, Topic, VocabEntry, VocabItem } from "./types";

const now = () => new Date().toISOString();

export function defaultProfile(): Profile {
  const t = now();
  return {
    name: "",
    level: "B1",
    levelHistory: [{ at: t, from: null, to: "B1", reason: "Starting level (self-assessed intermediate)." }],
    nativeLanguage: "Arabic",
    goals: [
      "Speak fluently and confidently in everyday conversations",
      "Improve grammar, vocabulary, listening, pronunciation and sentence formation",
      "Prepare for IELTS in the long term",
    ],
    interests: [],
    dailyGoalMinutes: 25,
    mistakes: [],
    strengths: [],
    weaknesses: [],
    tutorNotes: [],
    lastRecommendation: null,
    dailyTopic: null,
    createdAt: t,
    updatedAt: t,
  };
}

export async function getProfile(): Promise<Profile> {
  const store = getStore();
  const p = await store.getProfile();
  if (p) return p;
  const fresh = defaultProfile();
  await store.saveProfile(fresh);
  return fresh;
}

export async function updateProfile(patch: Partial<Pick<Profile, "name" | "interests" | "dailyGoalMinutes" | "tutorNotes">>): Promise<Profile> {
  const p = await getProfile();
  const next: Profile = { ...p, ...patch, updatedAt: now() };
  if (typeof next.name === "string") next.name = next.name.slice(0, 60);
  next.dailyGoalMinutes = Math.min(120, Math.max(5, Number(next.dailyGoalMinutes) || 25));
  next.interests = (next.interests ?? []).map((s) => String(s).slice(0, 60)).slice(0, 15);
  next.tutorNotes = (next.tutorNotes ?? []).map((s) => String(s).slice(0, 200)).slice(-40);
  await getStore().saveProfile(next);
  return next;
}

/** Today's suggested topic – stable for the whole day. */
export async function getDailySuggestion(tz: string) {
  const store = getStore();
  const [profile, sessions] = await Promise.all([getProfile(), store.listSessions()]);
  const today = localDate(new Date(), tz);
  if (profile.dailyTopic?.date === today) return profile.dailyTopic;
  const choice = chooseDailyTopic(sessions, today);
  profile.dailyTopic = { date: today, ...choice };
  await store.saveProfile(profile);
  return profile.dailyTopic;
}

// ───────────────────────── Sessions ─────────────────────────

export interface StartOptions {
  kind: "daily" | "surprise" | "custom" | "revisit";
  mode?: Mode;
  topic?: Topic;
  revisitOf?: string;
  tz: string;
}

export async function startSession(opts: StartOptions): Promise<Session> {
  const store = getStore();
  const [profile, history] = await Promise.all([getProfile(), store.listSessions()]);
  let topic: Topic;
  let mode: Mode = opts.mode ?? "free";
  let revisit: Session | null = null;

  if (opts.kind === "daily") {
    const d = await getDailySuggestion(opts.tz);
    topic = d.topic;
    mode = opts.mode ?? d.mode;
    if (d.revisitOf) revisit = history.find((s) => s.id === d.revisitOf) ?? null;
  } else if (opts.kind === "revisit" && opts.revisitOf) {
    revisit = history.find((s) => s.id === opts.revisitOf) ?? null;
    if (!revisit) throw new TutorError("That lesson was not found.", 404, "not_found");
    topic = revisit.topic;
    mode = opts.mode ?? revisit.mode;
  } else if (opts.kind === "custom" && opts.topic?.title) {
    topic = { category: opts.topic.category || "Custom", title: opts.topic.title.slice(0, 120), seed: (opts.topic.seed || opts.topic.title).slice(0, 300) };
  } else {
    const ctx = buildLearnerContext(profile, history, { mode, topic: { category: "?", title: "(to be decided)", seed: "" }, isRevisit: false });
    const s = await surpriseTopic(ctx, history.slice(0, 20).map((h) => h.topic.title));
    topic = s.topic;
    mode = opts.mode ?? s.mode;
  }

  const context = buildLearnerContext(profile, history, { mode, topic, isRevisit: !!revisit, previous: revisit });
  const plan = await generateLesson({ context, topic, mode, level: profile.level });
  const t = now();
  const session: Session = {
    id: randomUUID(),
    mode,
    topic,
    plan: { title: plan.title, introduction: plan.introduction, vocabulary: plan.vocabulary, roleplay: plan.roleplay, focusPoints: plan.focusPoints },
    level: profile.level,
    isRevisit: !!revisit,
    revisitOf: revisit?.id ?? null,
    context,
    messages: [
      note("Session starts. Greet the student, introduce today's topic briefly and ask your first question."),
      { id: randomUUID(), role: "tutor", kind: "normal", text: plan.openingMessage, at: t, correction: null, repeatPrompt: null, praise: null },
    ],
    status: "active",
    date: localDate(new Date(), opts.tz),
    startedAt: t,
    updatedAt: t,
    completedAt: null,
    usedExpressions: [],
    struggledExpressions: [],
    report: null,
  };
  await store.saveSession(session);
  return session;
}

function note(text: string): ChatMessage {
  return { id: randomUUID(), role: "user", kind: "note", text: `[App note: ${text}]`, at: now() };
}

export async function getSession(id: string): Promise<Session> {
  const s = await getStore().getSession(id);
  if (!s) throw new TutorError("Session not found.", 404, "not_found");
  return s;
}

async function applyTurn(session: Session): Promise<ChatMessage> {
  const out = await tutorTurn(session);
  const msg: ChatMessage = {
    id: randomUUID(),
    role: "tutor",
    kind: "normal",
    text: out.reply.trim(),
    at: now(),
    correction: out.correction,
    repeatPrompt: out.repeatPrompt,
    praise: out.praise,
  };
  session.messages.push(msg);
  const lessonExpr = new Set(session.plan.vocabulary.map((v) => v.expression.toLowerCase()));
  for (const e of out.usedExpressions) if (lessonExpr.has(e.toLowerCase()) && !session.usedExpressions.includes(e)) session.usedExpressions.push(e);
  for (const e of out.struggledExpressions) if (!session.struggledExpressions.includes(e)) session.struggledExpressions.push(e);
  session.updatedAt = msg.at;
  if (out.learnerFacts.length) await rememberFacts(out.learnerFacts);
  return msg;
}

async function rememberFacts(facts: string[]) {
  const p = await getProfile();
  const existing = new Set(p.tutorNotes.map((n) => n.toLowerCase()));
  const add = facts.map((f) => f.trim()).filter((f) => f && !existing.has(f.toLowerCase()));
  if (!add.length) return;
  p.tutorNotes = [...p.tutorNotes, ...add].slice(-40);
  p.updatedAt = now();
  await getStore().saveProfile(p);
}

export async function sendMessage(id: string, text: string, inputMode: "voice" | "text"): Promise<{ session: Session; reply: ChatMessage }> {
  const session = await getSession(id);
  if (session.status !== "active") throw new TutorError("This session is already finished.", 409, "finished");
  const clean = text.trim().slice(0, 2000);
  if (!clean) throw new TutorError("Empty message.", 400, "empty");

  // If the learner comes back after a long break mid-session, tell the tutor first.
  const lastAt = session.messages[session.messages.length - 1]?.at;
  if (lastAt && Date.now() - Date.parse(lastAt) > 60 * 60 * 1000) {
    session.messages.push(note(`The student came back after a break (${humanGap(lastAt)}). Their answer follows; respond naturally.`));
  }
  session.messages.push({ id: randomUUID(), role: "user", kind: "normal", text: clean, at: now(), inputMode });
  // Save the learner's message first so nothing is lost if the AI call fails.
  await getStore().saveSession(session);
  const reply = await applyTurn(session);
  await getStore().saveSession(session);
  return { session, reply };
}

/** Retry the tutor reply when the last attempt failed (the learner's message is already saved). */
export async function retryTurn(id: string) {
  const session = await getSession(id);
  const last = session.messages[session.messages.length - 1];
  if (session.status !== "active" || !last || last.role !== "user") return { session, reply: null };
  const reply = await applyTurn(session);
  await getStore().saveSession(session);
  return { session, reply };
}

/**
 * "Continue where we stopped": the tutor welcomes the learner back, reminds them of the previous
 * discussion (last question + last answer) and continues with a follow-up – without a new introduction.
 */
export async function resumeSession(id: string): Promise<{ session: Session; reply: ChatMessage | null }> {
  const session = await getSession(id);
  if (session.status !== "active") return { session, reply: null };
  const visible = session.messages.filter((m) => m.kind === "normal");
  const last = session.messages[session.messages.length - 1];
  const lastAt = visible[visible.length - 1]?.at ?? session.updatedAt;
  // Only for a real break (30+ min) and not twice in a row.
  if (Date.now() - Date.parse(lastAt) < 30 * 60 * 1000 || (last?.kind === "note" && last.text.includes("RESUME"))) {
    return { session, reply: null };
  }
  const lastTutor = [...visible].reverse().find((m) => m.role === "tutor");
  const lastUser = [...visible].reverse().find((m) => m.role === "user");
  const pending = last?.role === "tutor" ? "The student had not answered your last question yet." : "The student had answered; you had not replied yet.";
  session.messages.push(
    note(
      `RESUME. The student is back after ${humanGap(lastAt)}. Welcome them back warmly and briefly remind them what you were talking about (the topic, your last question${lastUser ? " and what they told you" : ""}), then continue naturally with one relevant follow-up question. Do NOT repeat the lesson introduction. ${pending}` +
        (lastTutor ? ` Your last question was: "${lastTutor.text}".` : "") +
        (lastUser ? ` Their last answer was: "${lastUser.text}".` : ""),
    ),
  );
  const reply = await applyTurn(session);
  await getStore().saveSession(session);
  return { session, reply };
}

function humanGap(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 90) return `${mins} minutes`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours} hours`;
  return `${Math.round(hours / 24)} days`;
}

export async function endSession(id: string): Promise<Session> {
  const store = getStore();
  const session = await getSession(id);
  if (session.status === "completed" && session.report) return session;
  const userTurns = session.messages.filter((m) => m.role === "user" && m.kind === "normal");
  if (userTurns.length === 0) throw new TutorError("Answer at least one question before finishing, so I can assess you.", 400, "too_short");

  const profile = await getProfile();
  const a = await assessSession(session, profile);
  const clamp = (n: number) => Math.min(10, Math.max(1, Math.round(n)));
  const scores = {
    grammar: clamp(a.scores.grammar),
    vocabulary: clamp(a.scores.vocabulary),
    sentenceConstruction: clamp(a.scores.sentenceConstruction),
    fluency: clamp(a.scores.fluency),
    comprehension: clamp(a.scores.comprehension),
    pronunciation: null,
  };
  const t = now();
  const report: SessionReport = {
    scores,
    overall: overallScore(scores),
    summary: a.summary,
    topMistakes: a.topMistakes.slice(0, 3),
    newExpressions: a.newExpressions.slice(0, 5),
    practiceSentences: a.practiceSentences.slice(0, 3),
    tomorrowRecommendation: a.tomorrowRecommendation,
    strengths: a.strengths,
    weaknesses: a.weaknesses,
    generatedAt: t,
  };
  session.report = report;
  session.status = "completed";
  session.completedAt = t;
  session.updatedAt = t;
  await store.saveSession(session);

  // ── Update long-term memory ──
  const fresh = await getProfile();
  fresh.mistakes = mergeMistakes(fresh.mistakes, a.mistakePatterns, t);
  fresh.strengths = dedupe([...a.strengths, ...fresh.strengths]).slice(0, 8);
  fresh.weaknesses = dedupe([...a.weaknesses, ...fresh.weaknesses]).slice(0, 8);
  fresh.lastRecommendation = a.tomorrowRecommendation;
  const known = new Set(fresh.tutorNotes.map((n) => n.toLowerCase()));
  fresh.tutorNotes = [...fresh.tutorNotes, ...a.learnerFacts.filter((f) => !known.has(f.toLowerCase()))].slice(-40);
  const all = await store.listSessions();
  const change = evaluateLevel(fresh, all, t);
  if (change) {
    fresh.level = change.to;
    fresh.levelHistory.push(change);
  }
  fresh.updatedAt = t;
  await store.saveProfile(fresh);

  // ── Save expressions to the vocabulary notebook ──
  const vocab = await store.listVocab();
  const have = new Map(vocab.map((v) => [v.expression.toLowerCase(), v]));
  const toSave: VocabItem[] = [...report.newExpressions];
  for (const v of session.plan.vocabulary) if (session.usedExpressions.some((e) => e.toLowerCase() === v.expression.toLowerCase())) toSave.push(v);
  for (const item of toSave) {
    if (!have.has(item.expression.toLowerCase())) {
      const entry = newVocabEntry(item, randomUUID(), t, { sessionId: session.id, topic: session.plan.title });
      have.set(item.expression.toLowerCase(), entry);
      await store.saveVocab(entry);
    }
  }
  for (const e of session.struggledExpressions) {
    const v = have.get(e.toLowerCase());
    if (v && !v.struggling) await store.saveVocab({ ...v, struggling: true });
  }
  return session;
}

function dedupe(a: string[]) {
  const seen = new Set<string>();
  return a.filter((s) => { const k = s.toLowerCase().trim(); if (seen.has(k)) return false; seen.add(k); return true; });
}

export async function listSessionSummaries() {
  return (await getStore().listSessions()).map(summarize);
}

// ───────────────────────── Dashboard ─────────────────────────

export async function getDashboard(tz: string) {
  const store = getStore();
  const [profile, sessions, vocab, daily] = await Promise.all([getProfile(), store.listSessions(), store.listVocab(), getDailySuggestion(tz)]);
  const today = localDate(new Date(), tz);
  const days = practiceDays(sessions, tz);
  const streak = computeStreak(days, today);
  const completed = sessions.filter((s) => s.status === "completed");
  const totalSeconds = sessions.reduce((a, s) => a + activeSeconds(s), 0);
  const todaySeconds = sessions.reduce((sum, s) => {
    const msgs = s.messages.filter((m) => localDate(m.at, tz) === today);
    return sum + activeSeconds({ messages: msgs });
  }, 0);

  // Last 7 days of minutes.
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => ({
    date: d,
    minutes: Math.round(sessions.reduce((sum, s) => sum + activeSeconds({ messages: s.messages.filter((m) => localDate(m.at, tz) === d) }), 0) / 60),
  }));

  const unfinished = sessions.find((s) => s.status === "active" && s.messages.some((m) => m.role === "user" && m.kind === "normal"))
    ?? sessions.find((s) => s.status === "active");
  const progress = completed
    .filter((s) => s.report)
    .slice(0, 30)
    .reverse()
    .map((s) => ({ date: s.date, title: s.plan.title, overall: s.report!.overall, ...s.report!.scores }));

  return {
    profile: { name: profile.name, level: profile.level, levelHistory: profile.levelHistory, dailyGoalMinutes: profile.dailyGoalMinutes, lastRecommendation: profile.lastRecommendation, strengths: profile.strengths, weaknesses: profile.weaknesses },
    streak,
    totals: {
      sessions: completed.length,
      minutes: Math.round(totalSeconds / 60),
      todayMinutes: Math.round(todaySeconds / 60),
      vocabulary: vocab.length,
      mastered: vocab.filter((v) => v.status === "mastered").length,
      due: vocab.filter((v) => isDue(v, today)).length,
    },
    week,
    practicedToday: days.has(today),
    daily,
    unfinished: unfinished ? { ...summarize(unfinished), daysAgo: daysBetween(localDate(unfinished.updatedAt, tz), today) } : null,
    recent: sessions.slice(0, 5).map(summarize),
    focusAreas: topMistakes(profile, 5).map((m) => ({ pattern: m.pattern, category: m.category, count: m.count, example: m.examples[0] ?? null })),
    progress,
    store: getStore().kind,
  };
}

// ───────────────────────── Vocabulary ─────────────────────────

export async function listVocab() {
  return getStore().listVocab();
}

export async function addVocab(item: VocabItem): Promise<VocabEntry> {
  const expression = item.expression?.trim().slice(0, 120);
  if (!expression) throw new TutorError("Expression is required.", 400, "invalid");
  const existing = (await getStore().listVocab()).find((v) => v.expression.toLowerCase() === expression.toLowerCase());
  if (existing) return existing;
  const entry = newVocabEntry({ expression, meaning: (item.meaning ?? "").slice(0, 300), example: (item.example ?? "").slice(0, 300) }, randomUUID(), now(), { sessionId: null, topic: null });
  await getStore().saveVocab(entry);
  return entry;
}

export async function reviewVocabItem(id: string, success: boolean): Promise<VocabEntry> {
  const v = (await getStore().listVocab()).find((x) => x.id === id);
  if (!v) throw new TutorError("Expression not found.", 404, "not_found");
  const next = reviewVocab(v, success, now());
  await getStore().saveVocab(next);
  return next;
}

export async function practiceVocab(id: string, sentence: string) {
  const v = (await getStore().listVocab()).find((x) => x.id === id);
  if (!v) throw new TutorError("Expression not found.", 404, "not_found");
  const result = await checkVocabSentence(v.expression, v.meaning, sentence.slice(0, 500));
  const entry = reviewVocab(v, result.correct, now());
  await getStore().saveVocab(entry);
  return { ...result, entry };
}

export async function deleteVocab(id: string) {
  await getStore().deleteVocab(id);
}

// ───────────────────────── Weekly summary ─────────────────────────

export async function getWeeklySummary(tz: string) {
  const store = getStore();
  const [profile, sessions] = await Promise.all([getProfile(), store.listSessions()]);
  const today = localDate(new Date(), tz);
  const from = addDays(today, -6);
  const week = sessions.filter((s) => s.date >= from);
  const minutes = Math.round(week.reduce((a, s) => a + activeSeconds(s), 0) / 60);
  const done = week.filter((s) => s.report);
  const avg = done.length ? Math.round((done.reduce((a, s) => a + s.report!.overall, 0) / done.length) * 10) / 10 : null;
  const stats = { from, to: today, sessions: week.length, completed: done.length, minutes, averageScore: avg };
  if (week.length === 0) return { stats, summary: null, focusNextWeek: [] };
  const digest = [
    `Week ${from} to ${today}: ${week.length} sessions (${done.length} completed), ${minutes} minutes, average score ${avg ?? "n/a"}.`,
    ...week.map((s) => `- ${s.date} ${s.plan.title} [${s.mode}] ${s.report ? `scores ${JSON.stringify(s.report.scores)}; mistakes: ${s.report.topMistakes.map((m) => m.original + " → " + m.corrected).join("; ")}` : "(unfinished)"}`),
    `Top recurring patterns: ${topMistakes(profile, 5).map((m) => m.pattern).join("; ") || "none"}`,
  ].join("\n");
  const ctx = buildLearnerContext(profile, sessions, { mode: "free", topic: { category: "Weekly review", title: "Weekly review", seed: "" }, isRevisit: false });
  const ai = await weeklySummary(ctx, digest);
  return { stats, ...ai };
}

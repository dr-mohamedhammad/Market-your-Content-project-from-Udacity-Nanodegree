import "server-only";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { callClaude } from "./claude";
import { TUTOR_PERSONA, lessonContext } from "./prompts";
import type { ChatMessage, Level, LessonPlan, Mode, Profile, Session, Topic } from "../types";

const correctionSchema = z.object({
  category: z.enum(["grammar", "vocabulary", "structure", "naturalness", "pronunciation"]),
  original: z.string(),
  corrected: z.string(),
  explanation: z.string(),
});

const vocabSchema = z.object({
  expression: z.string(),
  meaning: z.string().describe("Short, simple English definition"),
  example: z.string().describe("A natural example sentence"),
});

// ───────────────────────── Lesson plan + opening ─────────────────────────

const planSchema = z.object({
  title: z.string().describe("Short, engaging conversation title"),
  introduction: z.string().describe("2–3 sentence introduction to the topic, written for the student"),
  vocabulary: z.array(vocabSchema).describe("6–8 useful, practical expressions for this conversation at the student's level (+ one slightly above)"),
  roleplay: z
    .object({ scenario: z.string(), tutorRole: z.string(), userRole: z.string(), goal: z.string() })
    .nullable()
    .describe("Only for roleplay mode; otherwise null"),
  focusPoints: z.array(z.string()).describe("2–3 grammar/vocabulary points you will quietly target, based on the student's recurring mistakes"),
  openingMessage: z.string().describe("Your first spoken turn: a warm greeting (referring to something you remember if relevant), a one-sentence lead-in, and exactly ONE opening question. For roleplay, set the scene in one sentence then start in character."),
});

export type GeneratedPlan = LessonPlan & { openingMessage: string };

export async function generateLesson(args: { context: string; topic: Topic; mode: Mode; level: Level }): Promise<GeneratedPlan> {
  const { topic, mode } = args;
  const instructions = `[App note: Prepare today's ${mode === "roleplay" ? "role-play" : mode === "intensive" ? "intensive coaching" : "conversation"} session on the topic "${topic.title}" (${topic.category}). Topic idea: ${topic.seed}.
Make it fresh and personal, using what you remember about the student. Choose vocabulary that is genuinely useful in real life for this situation. ${mode === "roleplay" ? "Design a realistic role-play scenario with clear roles and a goal." : "Set roleplay to null."}]`;
  const out = await callClaude({
    kind: "analysis",
    system: [{ text: TUTOR_PERSONA, cache: true }, { text: args.context }],
    messages: [{ role: "user", content: instructions }],
    schema: planSchema,
    maxTokens: 10000,
  });
  return {
    title: out.title,
    introduction: out.introduction,
    vocabulary: out.vocabulary.slice(0, 10),
    roleplay: mode === "roleplay" ? out.roleplay : null,
    focusPoints: out.focusPoints.slice(0, 4),
    openingMessage: out.openingMessage,
  };
}

// ───────────────────────── Conversation turns ─────────────────────────

const turnSchema = z.object({
  reply: z.string().describe("What you say next, spoken aloud. Natural, short, exactly one question (unless wrapping up)."),
  correction: correctionSchema.nullable().describe("The single most useful correction of the student's LAST message, or null"),
  repeatPrompt: z.string().nullable().describe("Full corrected sentence the student should say again, or null"),
  praise: z.string().nullable().describe("Very short specific praise (e.g. for a correct repetition or a great expression), or null"),
  usedExpressions: z.array(z.string()).describe("Lesson expressions the student used correctly in their last message (exact expression text from the lesson)"),
  struggledExpressions: z.array(z.string()).describe("Lesson expressions the student tried but used incorrectly in their last message"),
  learnerFacts: z.array(z.string()).describe("New durable personal facts the student revealed (job, family, plans, likes) worth remembering for future sessions; usually empty"),
});

export type TurnOutput = z.infer<typeof turnSchema>;

export function sessionSystem(session: Session) {
  return [{ text: TUTOR_PERSONA, cache: true }, { text: session.context + "\n" + lessonContext(session), cache: true }];
}

/** Convert the stored transcript into API messages (append-only, so cached prefixes stay valid). */
export function toApiMessages(messages: ChatMessage[]): Anthropic.Beta.BetaMessageParam[] {
  return messages.map((m) => {
    if (m.role === "tutor") {
      return {
        role: "assistant" as const,
        content: JSON.stringify({ reply: m.text, correction: m.correction ?? null, repeatPrompt: m.repeatPrompt ?? null, praise: m.praise ?? null }),
      };
    }
    const text = m.kind === "note" ? m.text : m.inputMode === "voice" ? `${m.text}\n(spoken – via speech recognition)` : m.text;
    return { role: "user" as const, content: text };
  });
}

export async function tutorTurn(session: Session): Promise<TurnOutput> {
  const out = await callClaude({
    kind: "chat",
    system: sessionSystem(session),
    messages: toApiMessages(session.messages),
    schema: turnSchema,
  });
  return out;
}

// ───────────────────────── Assessment ─────────────────────────

const assessmentSchema = z.object({
  scores: z.object({
    grammar: z.number().describe("1–10"),
    vocabulary: z.number().describe("1–10"),
    sentenceConstruction: z.number().describe("1–10"),
    fluency: z.number().describe("1–10: length and flow of answers, ability to keep talking, use of connectors"),
    comprehension: z.number().describe("1–10: how well they understood your questions and responded relevantly"),
  }),
  summary: z.string().describe("3–4 warm, honest sentences addressed to the student about today's performance"),
  topMistakes: z.array(correctionSchema).describe("The 3 most important mistakes from today, with the student's original words and the corrected sentences"),
  newExpressions: z.array(vocabSchema).describe("5 useful expressions from today's conversation (lesson vocabulary or expressions you used) to save in the notebook"),
  practiceSentences: z.array(z.string()).describe("3 personalised sentences for the student to practise saying aloud, targeting their mistakes and using today's vocabulary"),
  tomorrowRecommendation: z.string().describe("One or two sentences: what tomorrow's lesson should focus on and why"),
  strengths: z.array(z.string()).describe("2–3 specific strengths shown today"),
  weaknesses: z.array(z.string()).describe("2–3 specific areas to improve"),
  mistakePatterns: z
    .array(
      z.object({
        key: z.string().describe("Stable kebab-case id. REUSE an existing key from the known patterns list when it's the same kind of mistake"),
        category: z.enum(["grammar", "vocabulary", "structure", "naturalness", "pronunciation"]),
        pattern: z.string().describe("General description, e.g. 'Past simple of irregular verbs'"),
        wrong: z.string(),
        right: z.string(),
        occurrences: z.number(),
      }),
    )
    .describe("Every type of mistake seen today, grouped into general patterns"),
  learnerFacts: z.array(z.string()).describe("Durable personal facts about the student learned today (empty if none)"),
});

export type AssessmentOutput = z.infer<typeof assessmentSchema>;

export async function assessSession(session: Session, profile: Profile): Promise<AssessmentOutput> {
  const transcript = session.messages
    .filter((m) => m.kind === "normal")
    .map((m) => `${m.role === "tutor" ? "TUTOR" : "STUDENT"}${m.inputMode === "voice" ? " (spoken)" : ""}: ${m.text}`)
    .join("\n");
  const known = profile.mistakes.slice(0, 25).map((m) => `${m.key}: ${m.pattern}`).join("\n") || "(none yet)";
  const prompt = `[App note: The session has ended. Write the student's performance report for this session.
Base the scores ONLY on the student's own messages below, relative to CEFR expectations (a score of 6–7 means solid for B1). Be honest but encouraging; don't inflate scores. Ignore punctuation/capitalisation of spoken messages. Pronunciation is not scored (speech recognition transcripts are not a reliable pronunciation measure).
If the student said very little, reflect that in fluency and keep the report short.

Known mistake patterns (reuse these keys when relevant):
${known}

Transcript:
${transcript}]`;
  return callClaude({
    kind: "analysis",
    system: [{ text: TUTOR_PERSONA, cache: true }, { text: session.context + "\n" + lessonContext(session) }],
    messages: [{ role: "user", content: prompt }],
    schema: assessmentSchema,
  });
}

// ───────────────────────── Surprise topic ─────────────────────────

const surpriseSchema = z.object({
  category: z.string(),
  title: z.string().describe("Specific, unexpected but practical conversation topic"),
  seed: z.string().describe("One sentence describing the angle of the conversation"),
  mode: z.enum(["free", "roleplay"]),
});

export async function surpriseTopic(context: string, recentTitles: string[]): Promise<{ topic: Topic; mode: Mode }> {
  const out = await callClaude({
    kind: "chat",
    system: [{ text: TUTOR_PERSONA, cache: true }, { text: context }],
    messages: [
      {
        role: "user",
        content: `[App note: The student pressed "Surprise me". Invent an unexpected, fun but genuinely useful real-life conversation topic or role-play suitable for their level and interests. Avoid these recent topics: ${recentTitles.join("; ") || "none"}.]`,
      },
    ],
    schema: surpriseSchema,
    maxTokens: 3000,
  });
  return { topic: { category: out.category, title: out.title, seed: out.seed }, mode: out.mode };
}

// ───────────────────────── Vocabulary practice ─────────────────────────

const practiceSchema = z.object({
  correct: z.boolean().describe("True if the expression is used correctly and naturally (minor slips elsewhere are OK)"),
  feedback: z.string().describe("One or two short, friendly sentences of feedback"),
  improved: z.string().describe("A natural, improved version of the student's sentence"),
});

export async function checkVocabSentence(expression: string, meaning: string, sentence: string) {
  return callClaude({
    kind: "chat",
    system: [{ text: TUTOR_PERSONA, cache: true }],
    messages: [
      {
        role: "user",
        content: `[App note: Vocabulary notebook practice. The student must use the expression "${expression}" (${meaning}) in their own sentence. Evaluate it.]\nStudent's sentence: ${sentence}`,
      },
    ],
    schema: practiceSchema,
    maxTokens: 3000,
  });
}

// ───────────────────────── Weekly summary ─────────────────────────

const weeklySchema = z.object({
  summary: z.string().describe("4–6 sentences addressed to the student summarising their week: what they practised, progress, recurring issues"),
  focusNextWeek: z.array(z.string()).describe("3 concrete goals for next week"),
});

export async function weeklySummary(profileContext: string, digest: string) {
  return callClaude({
    kind: "chat",
    system: [{ text: TUTOR_PERSONA, cache: true }, { text: profileContext }],
    messages: [{ role: "user", content: `[App note: Write the student's weekly learning summary from this data:\n${digest}]` }],
    schema: weeklySchema,
    maxTokens: 4000,
  });
}

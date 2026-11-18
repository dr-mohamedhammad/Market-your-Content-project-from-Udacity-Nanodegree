// Shared domain types used by both the server and the client.

export const LEVELS = ["B1", "B1+", "B2", "B2+", "C1"] as const;
export type Level = (typeof LEVELS)[number];

export type Mode = "free" | "roleplay" | "intensive";

export type MistakeCategory =
  | "grammar"
  | "vocabulary"
  | "structure"
  | "naturalness"
  | "pronunciation";

export interface Correction {
  category: MistakeCategory;
  original: string;
  corrected: string;
  explanation: string;
}

export interface VocabItem {
  expression: string;
  meaning: string;
  example: string;
}

export interface Topic {
  category: string;
  title: string;
  seed: string; // short description that guides lesson generation
}

export interface RolePlay {
  scenario: string;
  tutorRole: string;
  userRole: string;
  goal: string;
}

export interface LessonPlan {
  title: string;
  introduction: string;
  vocabulary: VocabItem[];
  roleplay: RolePlay | null;
  focusPoints: string[]; // what the tutor will quietly target (e.g. past simple)
}

export type MessageKind = "normal" | "note"; // "note" = hidden context (session start, resume…)

export interface ChatMessage {
  id: string;
  role: "tutor" | "user";
  kind: MessageKind;
  text: string;
  at: string; // ISO timestamp
  correction?: Correction | null;
  repeatPrompt?: string | null; // sentence the learner is invited to repeat
  praise?: string | null; // short positive feedback on a correct repetition / good sentence
  inputMode?: "voice" | "text";
}

export interface Scores {
  grammar: number;
  vocabulary: number;
  sentenceConstruction: number;
  fluency: number;
  comprehension: number;
  pronunciation: number | null; // null = not reliably assessed
}

export interface SessionReport {
  scores: Scores;
  overall: number;
  summary: string;
  topMistakes: Correction[];
  newExpressions: VocabItem[];
  practiceSentences: string[];
  tomorrowRecommendation: string;
  strengths: string[];
  weaknesses: string[];
  generatedAt: string;
}

export type SessionStatus = "active" | "completed";

export interface Session {
  id: string;
  mode: Mode;
  topic: Topic;
  plan: LessonPlan;
  level: Level; // level at the time of the session
  isRevisit: boolean;
  /** Set when the session was started from the lesson library. */
  lessonId?: string | null;
  /** Learner context frozen when the session starts (kept byte-identical so prompt caching works). */
  context: string;
  revisitOf?: string | null;
  messages: ChatMessage[];
  status: SessionStatus;
  date: string; // YYYY-MM-DD in the learner's time zone
  startedAt: string;
  updatedAt: string;
  completedAt?: string | null;
  usedExpressions: string[]; // lesson expressions the learner used correctly
  struggledExpressions: string[];
  report?: SessionReport | null;
}

export interface MistakePattern {
  key: string; // stable slug, e.g. "past-simple-irregular"
  category: MistakeCategory;
  pattern: string; // human-readable, e.g. "Past simple of irregular verbs"
  examples: { wrong: string; right: string }[];
  count: number;
  sessions: number; // in how many sessions it appeared
  lastSeen: string;
  improving: number; // consecutive sessions without this mistake after it was frequent
}

export interface LevelChange {
  at: string;
  from: Level | null;
  to: Level;
  reason: string;
}

export interface Profile {
  name: string;
  level: Level;
  levelHistory: LevelChange[];
  nativeLanguage: string;
  goals: string[];
  interests: string[];
  dailyGoalMinutes: number;
  mistakes: MistakePattern[];
  strengths: string[];
  weaknesses: string[];
  tutorNotes: string[]; // durable facts about the learner (job, family, preferences) the tutor remembers
  lastRecommendation: string | null;
  dailyTopic: { date: string; topic: Topic; mode: Mode; isRevisit: boolean; revisitOf: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export type VocabStatus = "new" | "learning" | "mastered";

export interface VocabEntry extends VocabItem {
  id: string;
  sourceSessionId: string | null;
  sourceTopic: string | null;
  addedAt: string;
  status: VocabStatus;
  reviews: number;
  correct: number;
  struggling: boolean;
  lastReviewed: string | null;
  nextReview: string; // ISO date
}

export interface SessionSummary {
  id: string;
  lessonId: string | null;
  title: string;
  category: string;
  mode: Mode;
  status: SessionStatus;
  date: string;
  startedAt: string;
  updatedAt: string;
  overall: number | null;
  minutes: number;
  lastTutorQuestion: string | null;
  lastUserAnswer: string | null;
  messageCount: number;
}

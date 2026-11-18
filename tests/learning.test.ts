import { test } from "node:test";
import assert from "node:assert/strict";
import { activeSeconds, addDays, computeStreak, evaluateLevel, lastQuestion, mergeMistakes, overallScore, reviewVocab, newVocabEntry } from "../lib/learning.ts";
import { chooseDailyTopic, TOPIC_CATALOG } from "../lib/topics.ts";
import type { Profile, Session } from "../lib/types.ts";

function profile(level: Profile["level"] = "B1"): Profile {
  return { name: "", level, levelHistory: [{ at: "2026-01-01T00:00:00Z", from: null, to: level, reason: "start" }], nativeLanguage: "Arabic", goals: [], interests: [], dailyGoalMinutes: 25, mistakes: [], strengths: [], weaknesses: [], tutorNotes: [], lastRecommendation: null, dailyTopic: null, createdAt: "", updatedAt: "" };
}

function session(i: number, overall: number, level: Profile["level"] = "B1", title = `t${i}`, category = "Travel & tourism"): Session {
  const date = addDays("2026-02-01", i);
  return {
    id: `s${i}`, mode: "free", topic: { category, title, seed: title }, plan: { title, introduction: "", vocabulary: [], roleplay: null, focusPoints: [] },
    level, isRevisit: false, context: "", messages: [], status: "completed", date, startedAt: date + "T10:00:00Z", updatedAt: date + "T10:30:00Z", completedAt: date + "T10:30:00Z",
    usedExpressions: [], struggledExpressions: [],
    report: { scores: { grammar: overall, vocabulary: overall, sentenceConstruction: overall, fluency: overall, comprehension: overall, pronunciation: null }, overall, summary: "", topMistakes: [], newExpressions: [], practiceSentences: [], tomorrowRecommendation: "", strengths: [], weaknesses: [], generatedAt: "" },
  };
}

test("streak counts consecutive days ending today or yesterday", () => {
  const days = new Set(["2026-03-01", "2026-03-02", "2026-03-03", "2026-02-20"]);
  assert.deepEqual(computeStreak(days, "2026-03-03"), { current: 3, best: 3 });
  assert.equal(computeStreak(days, "2026-03-04").current, 3); // today not done yet
  assert.equal(computeStreak(days, "2026-03-05").current, 0);
});

test("active time caps long gaps", () => {
  const msgs = ["10:00:00", "10:01:00", "10:02:00", "18:00:00"].map((t, i) => ({ id: String(i), role: "user" as const, kind: "normal" as const, text: "x", at: `2026-03-01T${t}Z` }));
  assert.equal(activeSeconds({ messages: msgs }), 60 + 60 + 180 + 20);
});

test("level never changes after one good session", () => {
  const p = profile();
  assert.equal(evaluateLevel(p, [session(1, 9.5)], "2026-03-01T00:00:00Z"), null);
});

test("level promotes after 5 strong sessions and steps down after 5 weak ones", () => {
  const p = profile();
  const strong = [1, 2, 3, 4, 5].map((i) => session(i, 8));
  assert.equal(evaluateLevel(p, strong, "2026-03-01T00:00:00Z")?.to, "B1+");
  const mixed = [...[1, 2, 3, 4].map((i) => session(i, 9)), session(5, 5)];
  assert.equal(evaluateLevel(p, mixed, "2026-03-01T00:00:00Z"), null, "one weak session blocks promotion");
  const p2 = profile("B2");
  const weak = [1, 2, 3, 4, 5].map((i) => session(i, 3.5, "B2"));
  assert.equal(evaluateLevel(p2, weak, "2026-03-01T00:00:00Z")?.to, "B1+");
});

test("sessions before the last level change are not counted", () => {
  const p = profile("B1+");
  p.levelHistory.push({ at: "2026-02-10T00:00:00Z", from: "B1", to: "B1+", reason: "x" });
  const old = [1, 2, 3, 4, 5].map((i) => session(i, 9, "B1+")); // dates 2026-02-02..06
  assert.equal(evaluateLevel(p, old, "2026-03-01T00:00:00Z"), null);
});

test("mistake memory merges recurring patterns", () => {
  let m = mergeMistakes([], [{ key: "past-simple", category: "grammar", pattern: "Past simple", wrong: "I go yesterday", right: "I went yesterday", occurrences: 2 }], "t1");
  m = mergeMistakes(m, [{ key: "past-simple", category: "grammar", pattern: "Past simple", wrong: "I buy it last week", right: "I bought it last week", occurrences: 1 }], "t2");
  assert.equal(m.length, 1);
  assert.equal(m[0].count, 3);
  assert.equal(m[0].sessions, 2);
  assert.equal(m[0].examples[0].wrong, "I buy it last week");
  m = mergeMistakes(m, [], "t3");
  assert.equal(m[0].improving, 1);
});

test("overall score weights fluency", () => {
  assert.equal(overallScore({ grammar: 6, vocabulary: 6, sentenceConstruction: 6, fluency: 6, comprehension: 6, pronunciation: null }), 6);
  assert.ok(overallScore({ grammar: 5, vocabulary: 5, sentenceConstruction: 5, fluency: 9, comprehension: 5, pronunciation: null }) > 5.8);
});

test("spaced repetition schedules and masters", () => {
  let v = newVocabEntry({ expression: "run into", meaning: "meet by chance", example: "" }, "v1", "2026-03-01T00:00:00Z", { sessionId: null, topic: null });
  v = reviewVocab(v, true, "2026-03-01T00:00:00Z");
  assert.equal(v.nextReview, "2026-03-02");
  for (let i = 0; i < 3; i++) v = reviewVocab(v, true, "2026-03-05T00:00:00Z");
  assert.equal(v.status, "mastered");
  let w = newVocabEntry({ expression: "x", meaning: "", example: "" }, "v2", "2026-03-01T00:00:00Z", { sessionId: null, topic: null });
  w = reviewVocab(reviewVocab(w, false, "2026-03-01T00:00:00Z"), false, "2026-03-01T00:00:00Z");
  assert.equal(w.struggling, true);
});

test("lastQuestion extracts the final question", () => {
  assert.equal(lastQuestion("That sounds great! I love Rome too. What did you eat there? Tell me."), "What did you eat there?");
});

test("daily topic is stable per day, avoids recent topics and rotates categories", () => {
  const a = chooseDailyTopic([], "2026-03-01");
  const b = chooseDailyTopic([], "2026-03-01");
  assert.deepEqual(a, b);
  const history: Session[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < 25; i++) {
    const c = chooseDailyTopic(history, addDays("2026-03-01", i));
    if (!c.isRevisit) {
      assert.ok(!seen.has(c.topic.title), `repeated ${c.topic.title}`);
      seen.add(c.topic.title);
    }
    history.unshift({ ...session(i, 6, "B1", c.topic.title, c.topic.category), date: addDays("2026-03-01", i) });
  }
  const cats = new Set(history.slice(0, 12).map((s) => s.topic.category));
  assert.ok(cats.size >= 9, `only ${cats.size} categories in 12 days`);
  assert.ok(history.some((s) => s.topic.category in TOPIC_CATALOG));
});

test("revisits happen periodically", () => {
  const history: Session[] = [];
  let revisits = 0;
  for (let i = 0; i < 30; i++) {
    const c = chooseDailyTopic(history, addDays("2026-03-01", i));
    if (c.isRevisit) revisits++;
    history.unshift({ ...session(i, 6, "B1", c.topic.title, c.topic.category), date: addDays("2026-03-01", i), isRevisit: c.isRevisit, revisitOf: c.revisitOf });
  }
  assert.ok(revisits >= 2 && revisits <= 6, `revisits=${revisits}`);
});

import type { Mode, Session, Topic } from "./types";

// Topic *seeds* only. The tutor (Claude) generates the actual lesson, vocabulary and conversation
// from a seed plus the learner's history – nothing here is a scripted conversation.
export const TOPIC_CATALOG: Record<string, string[]> = {
  "Daily routines & lifestyle": [
    "Your morning routine and how it could be better",
    "Weekends: how you relax and recharge",
    "Healthy habits you want to build",
    "Cooking at home vs. eating out",
    "Sleep, stress and work-life balance",
    "Your neighbourhood and daily errands",
    "Managing your time on a busy day",
    "Hobbies you had as a child and now",
  ],
  "Family & relationships": [
    "Family traditions and celebrations",
    "Describing a person who influenced you",
    "Friendship: making and keeping friends as an adult",
    "Generations: how your parents' life differed from yours",
    "Giving advice to a friend with a problem",
    "Weddings and family events in your culture",
    "Neighbours and community life",
  ],
  "Travel & tourism": [
    "Your most memorable trip",
    "Planning a holiday on a budget",
    "Problems while travelling and how you solved them",
    "A city you would love to visit and why",
    "Airports, flights and delays",
    "Recommending places in your country to a tourist",
    "Travelling alone vs. with others",
  ],
  "Shopping & restaurants": [
    "Online shopping vs. shopping in stores",
    "Returning a faulty product",
    "Your favourite restaurant and what you order",
    "Comparing prices and getting a good deal",
    "Describing food and recipes from your country",
    "Complaining politely about bad service",
  ],
  "Work & professional communication": [
    "Describing your job and responsibilities",
    "Handling a difficult colleague",
    "Running and attending meetings",
    "Writing and answering professional emails (spoken practice)",
    "Asking for a raise or a day off",
    "Working from home vs. at the office",
    "Giving a short update to your manager",
    "Your career goals for the next five years",
  ],
  "Pharmacy & healthcare": [
    "Explaining symptoms to a doctor",
    "Talking to a pharmacist about medication and side effects",
    "Counselling a patient on how to take a medicine",
    "Healthy lifestyle and preventive care",
    "Hospital and clinic experiences",
    "Over-the-counter vs. prescription medicines",
    "Health insurance and medical costs",
  ],
  "Supply chain & business": [
    "How a product gets from the factory to the customer",
    "Dealing with a delayed shipment",
    "Negotiating with a supplier",
    "Inventory problems: shortages and overstock",
    "Small businesses and entrepreneurship",
    "Customer service in your industry",
    "Explaining a process step by step",
  ],
  "News & current events": [
    "A news story that caught your attention recently",
    "How you follow the news and which sources you trust",
    "Climate and weather changes in your region",
    "Rising prices and the cost of living",
    "Sports events and big competitions",
    "Good news stories that inspired you",
  ],
  "Technology & AI": [
    "How artificial intelligence is changing your work",
    "Smartphones: helpful tool or distraction?",
    "Apps you use every day",
    "Online privacy and security",
    "Will robots replace jobs?",
    "Learning with technology",
  ],
  "Education & personal development": [
    "How you are learning English and what works for you",
    "Preparing for an exam like IELTS",
    "A skill you want to learn this year",
    "School memories: teachers and subjects",
    "Books, podcasts or videos that taught you something",
    "Setting goals and staying motivated",
  ],
  "Opinions & discussions": [
    "Is it better to live in a city or the countryside?",
    "Should university be free?",
    "Social media: good or bad for society?",
    "Is money the key to happiness?",
    "Fast fashion and consumerism",
    "The best age to get married or start a career",
  ],
  "Role-play situations": [
    "Ordering food in a restaurant",
    "Checking into a hotel and dealing with a room problem",
    "A job interview for a position you want",
    "Talking to your manager about a mistake",
    "Discussing a business problem with a client",
    "Asking for and giving directions",
    "Speaking with a pharmacist about a prescription",
    "Visiting a doctor with a health problem",
    "Renting an apartment",
    "Calling customer support about an internet problem",
  ],
};

export const ROLEPLAY_CATEGORY = "Role-play situations";

/** Deterministic PRNG so the "topic of the day" is stable within one day. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export interface TopicChoice {
  topic: Topic;
  mode: Mode;
  isRevisit: boolean;
  revisitOf: string | null;
}

/**
 * Picks today's topic:
 *  - rotates categories, preferring those least recently used,
 *  - never repeats a topic used in the last 30 sessions,
 *  - every 6th session (roughly weekly) revisits an older, lower-scoring topic to measure progress,
 *  - mixes in role-play on some days.
 */
export function chooseDailyTopic(sessions: Session[], date: string): TopicChoice {
  const rand = seededRandom(date);
  const completed = sessions.filter((s) => s.status === "completed");

  // Revisit an older topic now and then.
  if (completed.length >= 5 && completed.length % 6 === 5) {
    const candidates = completed
      .filter((s) => s.date < date && daysBetween(s.date, date) >= 7)
      .sort((a, b) => (a.report?.overall ?? 10) - (b.report?.overall ?? 10));
    const pick = candidates[0];
    if (pick && !sessions.some((s) => s.revisitOf === pick.id)) {
      return { topic: pick.topic, mode: pick.mode, isRevisit: true, revisitOf: pick.id };
    }
  }

  const recent = sessions.slice(0, 30);
  const usedTitles = new Set(recent.map((s) => s.topic.title.toLowerCase()));
  const lastUse = new Map<string, number>();
  sessions.forEach((s, i) => {
    if (!lastUse.has(s.topic.category)) lastUse.set(s.topic.category, i);
  });

  const categories = Object.keys(TOPIC_CATALOG);
  // Higher score = used longer ago (never used = best). Small random jitter keeps it varied.
  const ranked = categories
    .map((c) => ({ c, score: (lastUse.get(c) ?? 1000) + rand() * 3 }))
    .sort((a, b) => b.score - a.score);

  for (const { c } of ranked) {
    const options = TOPIC_CATALOG[c].filter((t) => !usedTitles.has(t.toLowerCase()));
    if (options.length === 0) continue;
    const title = options[Math.floor(rand() * options.length)];
    const mode: Mode = c === ROLEPLAY_CATEGORY ? "roleplay" : "free";
    return { topic: { category: c, title, seed: title }, mode, isRevisit: false, revisitOf: null };
  }

  // Everything used recently (very long-term users): fall back to the least-recent topic overall.
  const oldest = sessions[sessions.length - 1];
  return { topic: oldest.topic, mode: oldest.mode, isRevisit: true, revisitOf: oldest.id };
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}

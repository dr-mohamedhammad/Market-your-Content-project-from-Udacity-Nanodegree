import type { Level, Mode } from "./types";

/**
 * The lesson library: a structured course from B1 to C1.
 * Each entry is a lesson *brief* (situation + language focus). The tutor generates the actual
 * lesson, vocabulary and conversation from it, personalised with the learner's memory.
 */
export interface LibraryLesson {
  id: string;
  level: Level;
  unit: number; // order within the level
  category: string;
  title: string;
  mode: Mode;
  focus: string; // language point practised
  description: string; // what the learner will be able to do
}

type Row = [category: string, title: string, mode: Mode, focus: string, description: string];

const COURSE: Record<Level, Row[]> = {
  B1: [
    ["Daily routines & lifestyle", "My typical day", "free", "Present simple & adverbs of frequency", "Describe your daily routine and habits in detail."],
    ["Daily routines & lifestyle", "What I did last weekend", "free", "Past simple (regular & irregular verbs)", "Tell a clear story about a recent weekend."],
    ["Family & relationships", "Introducing my family", "free", "Describing people: appearance & personality", "Talk about family members and what they are like."],
    ["Shopping & restaurants", "Ordering food in a restaurant", "roleplay", "Polite requests: I'd like…, Could I have…?", "Order a meal, ask about dishes and pay the bill."],
    ["Shopping & restaurants", "Buying clothes in a shop", "roleplay", "Sizes, prices & comparatives", "Ask for sizes, compare items and make a purchase."],
    ["Travel & tourism", "Asking for directions", "roleplay", "Prepositions of place & imperatives", "Ask for and understand directions in a city."],
    ["Travel & tourism", "Checking into a hotel", "roleplay", "Questions with can/could & be going to", "Check in, ask about facilities and solve a small problem."],
    ["Pharmacy & healthcare", "At the pharmacy", "roleplay", "Describing symptoms & should/shouldn't", "Explain a simple health problem and understand advice."],
    ["Work & professional communication", "Describing my job", "free", "Present simple vs continuous", "Explain what you do and what you're working on now."],
    ["Education & personal development", "Learning English: my experience", "free", "Present perfect with for/since", "Talk about how long and how you have been learning."],
    ["Technology & AI", "My phone and favourite apps", "free", "Giving reasons with because/so", "Explain which apps you use and why."],
    ["Opinions & discussions", "City life or village life?", "intensive", "Expressing simple opinions: I think…, In my opinion…", "Give and support a basic opinion."],
  ],
  "B1+": [
    ["Travel & tourism", "My most memorable trip", "free", "Past continuous vs past simple", "Tell a vivid travel story with background and events."],
    ["Travel & tourism", "A problem at the airport", "roleplay", "Explaining problems & polite complaints", "Deal with a delayed flight or lost luggage."],
    ["Shopping & restaurants", "Returning a faulty product", "roleplay", "Present perfect for recent events", "Explain what's wrong and ask for a refund or exchange."],
    ["Pharmacy & healthcare", "Visiting the doctor", "roleplay", "How long have you…? & describing pain", "Describe symptoms precisely and understand instructions."],
    ["Work & professional communication", "Talking to my manager", "roleplay", "Making requests & offers: Would it be possible…?", "Ask for time off or help politely and professionally."],
    ["Work & professional communication", "Giving a short work update", "intensive", "Sequencing: first, then, after that, finally", "Report progress on a task clearly in under two minutes."],
    ["Family & relationships", "Giving advice to a friend", "free", "Advice: should, ought to, if I were you", "Listen to a problem and give helpful advice."],
    ["Daily routines & lifestyle", "Healthy habits and goals", "free", "Future plans: going to vs will", "Talk about habits you want to change and your plans."],
    ["Supply chain & business", "How a product reaches the customer", "free", "Present simple passive", "Explain a simple process step by step."],
    ["News & current events", "A news story I read", "free", "Reporting: It says that…, apparently…", "Summarise a news story and react to it."],
    ["Technology & AI", "AI in everyday life", "free", "First conditional", "Discuss what will happen if AI keeps improving."],
    ["Opinions & discussions", "Is social media good or bad?", "intensive", "Agreeing & disagreeing politely", "Take part in a balanced discussion."],
  ],
  B2: [
    ["Work & professional communication", "A job interview", "roleplay", "Talking about experience: present perfect continuous", "Answer common interview questions convincingly."],
    ["Work & professional communication", "Running a meeting", "roleplay", "Meeting language: let's move on, to sum up…", "Lead a short meeting and keep it on track."],
    ["Work & professional communication", "Handling a difficult colleague", "free", "Softening language: I was wondering if…", "Discuss workplace conflict diplomatically."],
    ["Pharmacy & healthcare", "Counselling a patient on medication", "roleplay", "Giving instructions & warnings: make sure, avoid", "Explain dosage, side effects and precautions clearly."],
    ["Supply chain & business", "Dealing with a delayed shipment", "roleplay", "Explaining causes & consequences: due to, as a result", "Inform a client about a delay and offer solutions."],
    ["Supply chain & business", "Negotiating with a supplier", "roleplay", "Negotiation: conditionals for offers", "Negotiate price and delivery terms."],
    ["Travel & tourism", "Recommending my country to a tourist", "free", "Relative clauses (which, where, who)", "Describe places in detail and make recommendations."],
    ["News & current events", "The rising cost of living", "free", "Second conditional & wishes", "Discuss economic problems and possible solutions."],
    ["Technology & AI", "Will robots replace jobs?", "intensive", "Speculating: might, could, is likely to", "Speculate about the future with nuance."],
    ["Education & personal development", "Preparing for IELTS Speaking Part 2", "intensive", "Long turn: structuring a 2-minute answer", "Speak for two minutes on a cue card topic."],
    ["Opinions & discussions", "Should university be free?", "free", "Linking ideas: however, whereas, on the other hand", "Build an argument with contrast and examples."],
    ["Family & relationships", "How family life has changed", "free", "used to / would for past habits", "Compare generations and past habits."],
  ],
  "B2+": [
    ["Work & professional communication", "Presenting a proposal", "intensive", "Signposting & persuasive language", "Present an idea and persuade a decision-maker."],
    ["Work & professional communication", "Giving and receiving feedback", "roleplay", "Diplomatic criticism & hedging", "Give constructive feedback without offending."],
    ["Supply chain & business", "Inventory crisis: shortage vs overstock", "free", "Third conditional & regrets", "Analyse what went wrong and what should have happened."],
    ["Supply chain & business", "Handling an angry client", "roleplay", "De-escalation phrases & apologising professionally", "Calm a client down and agree on next steps."],
    ["Pharmacy & healthcare", "Explaining a health risk to a patient", "roleplay", "Explaining probability & risk clearly", "Explain risks and benefits in plain language."],
    ["News & current events", "Climate change in my region", "free", "Passive reporting: it is believed that…", "Discuss causes, effects and responsibility."],
    ["Technology & AI", "Online privacy and data", "intensive", "Concession: although, despite, even though", "Argue both sides of a complex issue."],
    ["Education & personal development", "IELTS Speaking Part 3: abstract questions", "intensive", "Developing answers: reason, example, contrast", "Give extended, well-organised answers to abstract questions."],
    ["Opinions & discussions", "Is money the key to happiness?", "free", "Idiomatic expressions for opinions", "Discuss abstract ideas with natural idioms."],
    ["Travel & tourism", "The impact of tourism", "free", "Cause-and-effect vocabulary", "Discuss the benefits and problems of mass tourism."],
    ["Daily routines & lifestyle", "Work-life balance", "free", "Phrasal verbs for lifestyle (burn out, wind down…)", "Talk about stress and balance with rich vocabulary."],
    ["Family & relationships", "Cultural differences in relationships", "free", "Comparing & generalising: tend to, on the whole", "Compare cultures without stereotyping."],
  ],
  C1: [
    ["Work & professional communication", "Leading a strategy discussion", "roleplay", "Inversion & emphasis for impact", "Lead a high-level discussion and drive consensus."],
    ["Work & professional communication", "Delivering bad news professionally", "roleplay", "Tactful, indirect language", "Communicate difficult decisions with empathy."],
    ["Supply chain & business", "Globalisation and supply chain risk", "free", "Advanced linking & nominalisation", "Analyse a complex system and its vulnerabilities."],
    ["Pharmacy & healthcare", "Ethics in healthcare", "intensive", "Hedging & academic-style argument", "Debate an ethical dilemma with precision."],
    ["News & current events", "Media bias and trust", "free", "Evaluating sources & expressing scepticism", "Critically discuss how news is reported."],
    ["Technology & AI", "Regulating artificial intelligence", "intensive", "Complex conditionals & mixed conditionals", "Argue for and against AI regulation."],
    ["Education & personal development", "IELTS Band 7+: full speaking test", "intensive", "Fluency, range and accuracy under pressure", "Complete a full IELTS-style speaking test."],
    ["Opinions & discussions", "The future of work", "free", "Future perfect & future continuous", "Discuss long-term trends with sophisticated language."],
    ["Opinions & discussions", "Debate: individual freedom vs public good", "intensive", "Rebutting arguments & conceding points", "Hold your position in a structured debate."],
    ["Travel & tourism", "Living abroad: identity and belonging", "free", "Nuanced emotional vocabulary", "Reflect on identity and cultural adaptation."],
    ["Family & relationships", "Changing gender roles", "free", "Register: formal vs informal expression", "Discuss social change with appropriate register."],
    ["Daily routines & lifestyle", "Minimalism and consumer culture", "free", "Collocations & idioms at C1", "Express subtle opinions with natural collocations."],
  ],
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const LIBRARY: LibraryLesson[] = (Object.keys(COURSE) as Level[]).flatMap((level) =>
  COURSE[level].map(([category, title, mode, focus, description], i) => ({
    id: `${slug(level.replace("+", "plus"))}-${String(i + 1).padStart(2, "0")}-${slug(title)}`,
    level,
    unit: i + 1,
    category,
    title,
    mode,
    focus,
    description,
  })),
);

export function getLibraryLesson(id: string): LibraryLesson | null {
  return LIBRARY.find((l) => l.id === id) ?? null;
}

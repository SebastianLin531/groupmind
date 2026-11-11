// Course setup and team formation (before the project starts).
// The AI lists strategies. The teacher chooses. A fixed algorithm forms the groups.
// The language model never assigns a student to a group.

import { z } from "zod";

export type Skill = "market" | "finance" | "design" | "strategy";

/** Simulated survey answers. Everything here is self-reported mock data. */
export interface ClassStudent {
  id: string;
  name: string;
  skill: Skill;
  /** Self-rated project experience, 1 to 5. */
  experience: number;
  /** Availability in six weekly time slots. */
  slots: boolean[];
  /** Self-rated, 1 to 5. Used only by the optional personality strategy. */
  extraversion: number;
}

function student(
  id: string,
  name: string,
  skill: Skill,
  experience: number,
  slots: string,
  extraversion: number,
): ClassStudent {
  return {
    id,
    name,
    skill,
    experience,
    slots: [...slots].map((c) => c === "1"),
    extraversion,
  };
}

export const CLASS_STUDENTS: ClassStudent[] = [
  student("alex", "Alex", "market", 2, "110110", 4),
  student("bella", "Bella", "finance", 4, "110101", 2),
  student("chris", "Chris", "design", 3, "111100", 3),
  student("dana", "Dana", "strategy", 5, "110011", 5),
  student("ethan", "Ethan", "market", 5, "011011", 2),
  student("farah", "Farah", "finance", 1, "101110", 4),
  student("grace", "Grace", "design", 4, "011101", 5),
  student("hiro", "Hiro", "strategy", 2, "111001", 1),
  student("ines", "Ines", "market", 3, "100111", 3),
  student("jun", "Jun", "finance", 2, "011110", 5),
  student("kai", "Kai", "design", 1, "110011", 2),
  student("lena", "Lena", "strategy", 4, "101101", 3),
];

export const STRATEGY_IDS = [
  "random",
  "skill_diverse",
  "ability_mixed",
  "personality_balanced",
] as const;

export type StrategyId = (typeof STRATEGY_IDS)[number];

export interface Strategy {
  id: StrategyId;
  name: string;
  /** The exact rule the algorithm optimizes. */
  rule: string;
  evidence: string;
  surveyQuestions: string[];
}

const AVAILABILITY_QUESTION =
  "Which of these six weekly time slots can you meet in?";

export const STRATEGIES: Strategy[] = [
  {
    id: "random",
    name: "Random (baseline)",
    rule: "Shuffle the class with a fixed seed and fill the teams in order.",
    evidence: "Baseline for comparison.",
    surveyQuestions: [AVAILABILITY_QUESTION],
  },
  {
    id: "skill_diverse",
    name: "Skill diversity",
    rule: "Maximize the number of different skills inside each team.",
    evidence:
      "Supported in workplace teams (Horwitz & Horwitz, 2007). Less tested in classrooms.",
    surveyQuestions: [
      "Which area are you most comfortable with: market, finance, design, or strategy?",
      AVAILABILITY_QUESTION,
    ],
  },
  {
    id: "ability_mixed",
    name: "Mixed experience",
    rule: "Minimize the gap between teams in average project experience.",
    evidence: "Mixed evidence (Donovan et al., 2018; Wilson et al., 2018).",
    surveyQuestions: [
      "How much team-project experience do you have? (1 to 5, self-rated)",
      AVAILABILITY_QUESTION,
    ],
  },
  {
    id: "personality_balanced",
    name: "Personality balance (optional)",
    rule: "Minimize the gap between teams in average extraversion.",
    evidence:
      "To be tested. Effects vary by setting (Bell, 2007). The direction is an assumption.",
    surveyQuestions: [
      "A short extraversion scale (1 to 5, self-rated). Optional. Only team averages are shown.",
      AVAILABILITY_QUESTION,
    ],
  },
];

export function getStrategy(id: StrategyId): Strategy {
  return STRATEGIES.find((strategy) => strategy.id === id) ?? STRATEGIES[0];
}

// ---------- Deterministic grouping ----------

export const FORMATION_SEED = 20261111;
export const ALGORITHM_VERSION = "swap-v1 (40 seeded starts)";
const TEAM_SIZE = 4;
const SWAP_ROUNDS = 800;
const MIN_COMMON_SLOTS = 2;

export interface GroupMetrics {
  distinctSkills: number;
  experienceMean: number;
  experienceRange: number;
  commonSlots: number;
  extraversionMean: number;
}

export interface FormedGroup {
  name: string;
  memberIds: string[];
  metrics: GroupMetrics;
}

/** Small seeded random generator, so the same input always gives the same teams. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (values: number[]) =>
  values.reduce((sum, v) => sum + v, 0) / values.length;
const range = (values: number[]) => Math.max(...values) - Math.min(...values);

function metricsFor(members: ClassStudent[]): GroupMetrics {
  const commonSlots = members[0].slots.filter((_, slot) =>
    members.every((member) => member.slots[slot]),
  ).length;
  return {
    distinctSkills: new Set(members.map((member) => member.skill)).size,
    experienceMean:
      Math.round(mean(members.map((member) => member.experience)) * 10) / 10,
    experienceRange: range(members.map((member) => member.experience)),
    commonSlots,
    extraversionMean:
      Math.round(mean(members.map((member) => member.extraversion)) * 10) / 10,
  };
}

function score(strategyId: StrategyId, teams: ClassStudent[][]): number {
  const metrics = teams.map(metricsFor);
  // Practical constraint for every strategy: a team needs shared time to meet.
  const penalty =
    metrics.filter((m) => m.commonSlots < MIN_COMMON_SLOTS).length * 100;
  switch (strategyId) {
    case "skill_diverse":
      return metrics.reduce((sum, m) => sum + m.distinctSkills, 0) - penalty;
    case "ability_mixed":
      return -range(metrics.map((m) => m.experienceMean)) - penalty;
    case "personality_balanced":
      return -range(metrics.map((m) => m.extraversionMean)) - penalty;
    default:
      return -penalty;
  }
}

const RESTARTS = 40;

function attempt(
  strategyId: StrategyId,
  seed: number,
): { teams: ClassStudent[][]; best: number } {
  const random = mulberry32(seed);
  const roster = [...CLASS_STUDENTS];
  for (let i = roster.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [roster[i], roster[j]] = [roster[j], roster[i]];
  }

  const teams: ClassStudent[][] = [];
  for (let i = 0; i < roster.length; i += TEAM_SIZE)
    teams.push(roster.slice(i, i + TEAM_SIZE));

  // Try swaps between two teams and keep a swap only when the score improves.
  let best = score(strategyId, teams);
  for (let round = 0; round < SWAP_ROUNDS; round++) {
    const a = Math.floor(random() * teams.length);
    const b =
      (a + 1 + Math.floor(random() * (teams.length - 1))) % teams.length;
    const i = Math.floor(random() * TEAM_SIZE);
    const j = Math.floor(random() * TEAM_SIZE);
    [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
    const next = score(strategyId, teams);
    if (next > best) best = next;
    else [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
  }
  return { teams, best };
}

/** Forms teams of four. Same roster, strategy, and seed always give the same result. */
export function formGroups(
  strategyId: StrategyId,
  seed: number = FORMATION_SEED,
): FormedGroup[] {
  let teams: ClassStudent[][];
  if (strategyId === "random") {
    // The baseline is a plain seeded shuffle with no optimization at all.
    const random = mulberry32(seed);
    const roster = [...CLASS_STUDENTS];
    for (let i = roster.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [roster[i], roster[j]] = [roster[j], roster[i]];
    }
    teams = [];
    for (let i = 0; i < roster.length; i += TEAM_SIZE)
      teams.push(roster.slice(i, i + TEAM_SIZE));
  } else {
    // Several seeded starts, keep the best. Still fully repeatable.
    let winner = attempt(strategyId, seed);
    for (let restart = 1; restart < RESTARTS; restart++) {
      const candidate = attempt(strategyId, seed + restart);
      if (candidate.best > winner.best) winner = candidate;
    }
    teams = winner.teams;
  }

  return teams.map((members, index) => ({
    name: `Team ${index + 1}`,
    memberIds: members.map((member) => member.id),
    metrics: metricsFor(members),
  }));
}

// ---------- AI strategy suggestions ----------

export interface StrategySuggestion {
  strategyId: StrategyId;
  /** Why this strategy could fit this course. */
  fit: string;
  /** What the teacher gives up by choosing it. */
  tradeoff: string;
}

/** Shape the model must return. It may only pick from the fixed strategy list. */
export const AiStrategySchema = z.object({
  suggestions: z.array(
    z.object({
      strategyId: z.enum(STRATEGY_IDS),
      fit: z.string(),
      tradeoff: z.string(),
    }),
  ),
});

export const StrategyRequestSchema = z.object({
  syllabus: z.string().trim().min(1).max(6000),
  learningGoals: z.array(z.string().max(300)).max(5),
});

/** Keeps known strategies only, without duplicates. Null when fewer than two remain. */
export function buildSuggestions(
  raw: z.infer<typeof AiStrategySchema>,
): StrategySuggestion[] | null {
  const seen = new Set<StrategyId>();
  const suggestions: StrategySuggestion[] = [];
  for (const item of raw.suggestions) {
    if (seen.has(item.strategyId) || !item.fit.trim() || !item.tradeoff.trim())
      continue;
    seen.add(item.strategyId);
    suggestions.push({
      strategyId: item.strategyId,
      fit: item.fit.trim(),
      tradeoff: item.tradeoff.trim(),
    });
    if (suggestions.length === 3) break;
  }
  return suggestions.length >= 2 ? suggestions : null;
}

/** Shown, clearly labeled, when the live AI call is unavailable. */
export const SAMPLE_SUGGESTIONS: StrategySuggestion[] = [
  {
    strategyId: "skill_diverse",
    fit: "The pitch needs market, finance, design, and strategy work, so each team benefits from having all four.",
    tradeoff:
      "Members may stay inside their strongest area instead of learning a new one.",
  },
  {
    strategyId: "ability_mixed",
    fit: "Teams start from a similar level of project experience, which keeps the comparison between teams fair.",
    tradeoff: "Experienced members may end up carrying the coordination work.",
  },
  {
    strategyId: "random",
    fit: "Simple and transparent. It also gives a baseline to compare other strategies against.",
    tradeoff: "A team can end up missing a skill the project needs.",
  },
];

export const SAMPLE_SYLLABUS = `Course: Entrepreneurship Practice (sample course, undergraduate elective)
Class: 12 students in this section, mixed majors. 18 weeks.
Final deliverable: a startup pitch deck and a 10-minute team pitch.
Team size: 4. Teams stay together for the whole semester.
Assessment: 60% team deliverable, 40% individual reflection on the collaboration process.
Milestones: problem interviews (week 5), business model (week 9), financial model (week 13), final pitch (week 18).
Teacher's concern from earlier years: one member often ends up redoing the others' sections before the deadline.`;

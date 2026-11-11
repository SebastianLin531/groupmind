// All app state lives here: mock data, initial state, and the reducer.
// State is kept in the browser only (React state + localStorage).

import { SAMPLE_SYLLABUS, formGroups } from "./formation";
import type { StrategyId, StrategySuggestion } from "./formation";
import type {
  AppState,
  CourseContext,
  Member,
  MemberId,
  Proposal,
  RoleId,
  Task,
} from "./types";

/** Set to false to hide course setup and fall back to the negotiation-only demo. */
export const SHOW_COURSE_SETUP = true;

/** The teacher's goals and rules. They travel into the student negotiation. */
export const COURSE_CONTEXT: CourseContext = {
  learningGoals: [
    {
      id: "G1",
      text: "Every member can explain the financial model, not only its owner.",
    },
    {
      id: "G2",
      text: "Every member contributes analysis, not only formatting.",
    },
  ],
  collaborationRules: [
    { id: "R1", text: "Rework goes back to the person who wrote the section." },
    {
      id: "R2",
      text: "Sections are handed over in the shared template two days before a deadline.",
    },
  ],
};

/** "G1" -> "Goal 1", "R2" -> "Rule 2". */
export function contextLabel(id: string): string {
  return `${id.startsWith("G") ? "Goal" : "Rule"} ${id.slice(1)}`;
}

export const MEMBERS: Member[] = [
  { id: "alex", name: "Alex", focus: "Market research" },
  { id: "bella", name: "Bella", focus: "Financial analysis" },
  { id: "chris", name: "Chris", focus: "Slide integration" },
  { id: "dana", name: "Dana", focus: "Product strategy" },
];

export const ROLE_LABELS: Record<RoleId, string> = {
  alex: "Alex (student)",
  bella: "Bella (student)",
  chris: "Chris (student)",
  dana: "Dana (student)",
  teacher: "Teacher",
};

export const INITIAL_TASKS: Task[] = [
  {
    id: "task-market",
    title: "Market research",
    detail: "Size the market and summarize three competitors.",
    ownerId: "alex",
  },
  {
    id: "task-finance",
    title: "Financial analysis",
    detail: "Build the revenue model and the first-year budget.",
    ownerId: "bella",
  },
  {
    id: "task-slides",
    title: "Slide integration",
    detail:
      "Combine every section into the final pitch deck and fix inconsistencies.",
    ownerId: "chris",
  },
  {
    id: "task-product",
    title: "Product strategy",
    detail: "Define the value proposition and the launch roadmap.",
    ownerId: "dana",
  },
];

export const DEFAULT_ISSUE_TEXT =
  "I'm spending too much time fixing other people's work. I don't think our workload is fair.";

export const TEAM_NAME = "Sample team - Startup pitch project";

/** The only status line the teacher sees. It names no one and quotes no one. */
export const SUPPORT_STATUS_LINE =
  "The team tried one proposal. It was not agreed, because at least one affected member could not take on the change.";

export const STORAGE_KEY = "groupmind-state-v2";

export function createInitialState(): AppState {
  return {
    currentRole: SHOW_COURSE_SETUP ? "teacher" : "chris",
    tasks: INITIAL_TASKS.map((task) => ({ ...task })),
    issue: null,
    proposal: null,
    supportRequested: false,
    teacherGuidance: null,
    setup: {
      stage: "brief",
      syllabus: SAMPLE_SYLLABUS,
      suggestions: [],
      suggestionsAreSample: false,
      strategyId: null,
      groups: [],
    },
  };
}

export function memberName(id: MemberId): string {
  return MEMBERS.find((member) => member.id === id)?.name ?? id;
}

/** Every member whose work a proposal would change. All of them must consent. */
export function affectedMembers(proposal: Proposal): MemberId[] {
  const ids = new Set<MemberId>();
  for (const change of proposal.changes) {
    for (const id of change.affectedMemberIds) ids.add(id);
  }
  return MEMBERS.map((member) => member.id).filter((id) => ids.has(id));
}

/**
 * Records one member's answer.
 * Fairness rule: a proposal applies only when every affected member consents.
 * There is no majority vote, and a decline keeps the board unchanged.
 */
function respond(
  state: AppState,
  memberId: MemberId,
  decision: "consent" | "decline",
  reason?: string,
): AppState {
  const proposal = state.proposal;
  if (!proposal || proposal.status === "applied") return state;

  const affected = affectedMembers(proposal);
  if (!affected.includes(memberId)) return state;

  const trimmedReason = reason?.trim();
  // A decline must come with a reason, so the team has something to work with.
  if (decision === "decline" && !trimmedReason) return state;

  const responses = {
    ...proposal.responses,
    [memberId]:
      decision === "decline"
        ? { decision, reason: trimmedReason }
        : { decision },
  };

  const anyDecline = affected.some(
    (id) => responses[id]?.decision === "decline",
  );
  const allConsent = affected.every(
    (id) => responses[id]?.decision === "consent",
  );

  if (!allConsent) {
    return {
      ...state,
      proposal: {
        ...proposal,
        responses,
        status: anyDecline ? "needs_revision" : "open",
      },
    };
  }

  const tasks = state.tasks.map((task) => {
    const change = proposal.changes.find(
      (candidate) => candidate.taskId === task.id,
    );
    if (!change) return { ...task, changed: false };
    return {
      ...task,
      ownerId: change.newOwnerId ?? task.ownerId,
      title: change.newTitle ?? task.title,
      detail: change.newDetail ?? task.detail,
      changed: true,
    };
  });

  return {
    ...state,
    tasks,
    proposal: { ...proposal, responses, status: "applied" },
  };
}

export type Action =
  | { type: "hydrate"; state: AppState }
  | { type: "switch_role"; role: RoleId }
  | { type: "raise_issue"; raisedBy: MemberId; text: string }
  | { type: "set_proposal"; proposal: Proposal }
  | { type: "set_revised_proposal"; proposal: Proposal }
  | {
      type: "respond";
      memberId: MemberId;
      decision: "consent" | "decline";
      reason?: string;
    }
  | { type: "request_support" }
  | { type: "send_guidance"; text: string }
  | {
      type: "set_suggestions";
      syllabus: string;
      suggestions: StrategySuggestion[];
      isSample: boolean;
    }
  | { type: "choose_strategy"; strategyId: StrategyId }
  | { type: "load_survey_responses" }
  | { type: "back_to_options" }
  | { type: "publish_groups" }
  | { type: "reset" };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "switch_role":
      return { ...state, currentRole: action.role };
    case "raise_issue":
      return {
        ...state,
        issue: { raisedBy: action.raisedBy, text: action.text },
      };
    case "set_proposal":
      // Ignore a late AI answer after the demo was reset.
      if (!state.issue) return state;
      return { ...state, proposal: action.proposal };
    case "set_revised_proposal":
      // One revision only, and only while the team has not agreed.
      if (
        state.proposal?.status !== "needs_revision" ||
        state.proposal.isRevised
      )
        return state;
      // A revised proposal starts with no answers: everyone affected decides again.
      return {
        ...state,
        proposal: {
          ...action.proposal,
          responses: {},
          status: "open",
          isRevised: true,
        },
      };
    case "respond":
      return respond(state, action.memberId, action.decision, action.reason);
    case "request_support":
      // A team can ask for support only after it tried and did not agree.
      if (state.proposal?.status !== "needs_revision") return state;
      return { ...state, supportRequested: true };
    case "send_guidance": {
      const text = action.text.trim();
      if (!state.supportRequested || !text) return state;
      return { ...state, teacherGuidance: text };
    }
    case "set_suggestions":
      return {
        ...state,
        setup: {
          ...state.setup,
          stage: "options",
          syllabus: action.syllabus,
          suggestions: action.suggestions,
          suggestionsAreSample: action.isSample,
        },
      };
    case "choose_strategy":
      return {
        ...state,
        setup: {
          ...state.setup,
          stage: "survey",
          strategyId: action.strategyId,
          groups: [],
        },
      };
    case "load_survey_responses":
      // The algorithm, not the AI, forms the groups from the survey answers.
      if (!state.setup.strategyId) return state;
      return {
        ...state,
        setup: {
          ...state.setup,
          stage: "grouped",
          groups: formGroups(state.setup.strategyId),
        },
      };
    case "back_to_options":
      if (state.setup.stage === "published") return state;
      return {
        ...state,
        setup: {
          ...state.setup,
          stage: "options",
          strategyId: null,
          groups: [],
        },
      };
    case "publish_groups":
      if (state.setup.stage !== "grouped") return state;
      return { ...state, setup: { ...state.setup, stage: "published" } };
    case "reset":
      return createInitialState();
    default:
      return state;
  }
}

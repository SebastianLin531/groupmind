// All app state lives here: mock data, initial state, and the reducer.
// State is kept in the browser only (React state + localStorage).

import type { AppState, Member, MemberId, Proposal, RoleId, Task } from "./types";

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
    detail: "Combine every section into the final pitch deck and fix inconsistencies.",
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

export const STORAGE_KEY = "groupmind-state-v1";

export function createInitialState(): AppState {
  return {
    currentRole: "chris",
    tasks: INITIAL_TASKS.map((task) => ({ ...task })),
    issue: null,
    proposal: null,
    supportRequested: false,
    teacherGuidance: null,
  };
}

export function memberName(id: MemberId): string {
  return MEMBERS.find((member) => member.id === id)?.name ?? id;
}

export type Action =
  | { type: "hydrate"; state: AppState }
  | { type: "switch_role"; role: RoleId }
  | { type: "raise_issue"; raisedBy: MemberId; text: string }
  | { type: "set_proposal"; proposal: Proposal }
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
    case "reset":
      return createInitialState();
    default:
      return state;
  }
}

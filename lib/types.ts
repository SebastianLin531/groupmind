// Single source of truth for the data shapes used across the app.

export type MemberId = "alex" | "bella" | "chris" | "dana";
export type RoleId = MemberId | "teacher";

export interface Member {
  id: MemberId;
  name: string;
  focus: string;
}

export interface Task {
  id: string;
  title: string;
  detail: string;
  ownerId: MemberId;
  /** True right after an agreed proposal changed this task. */
  changed?: boolean;
}

export interface Issue {
  raisedBy: MemberId;
  text: string;
}

/** One concrete change to one task. It only applies if every affected member consents. */
export interface ProposalChange {
  taskId: string;
  newOwnerId?: MemberId;
  newTitle?: string;
  newDetail?: string;
  reason: string;
  affectedMemberIds: MemberId[];
}

export interface MemberResponse {
  decision: "consent" | "decline";
  reason?: string;
}

export type ProposalStatus = "open" | "needs_revision" | "applied";

export interface Proposal {
  /** The issue restated as one member's perspective, not as fact. */
  perspectiveSummary: string;
  /** Team-level summary for the teacher. Contains no member names. */
  teamSummary: string;
  changes: ProposalChange[];
  /** Guidance options the teacher can pick from and edit. */
  teacherPromptOptions: string[];
  /** True when this is the built-in sample, not a live AI result. */
  isSample: boolean;
  responses: Partial<Record<MemberId, MemberResponse>>;
  status: ProposalStatus;
}

export interface AppState {
  currentRole: RoleId;
  tasks: Task[];
  issue: Issue | null;
  proposal: Proposal | null;
  supportRequested: boolean;
  teacherGuidance: string | null;
}

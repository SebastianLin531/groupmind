// Proposal schema, validation, and the built-in sample proposal.
// The AI only suggests. This file decides what is valid and who must consent.

import { z } from "zod";
import { MEMBERS } from "./state";
import type { MemberId, Proposal, ProposalChange, Task } from "./types";

const MEMBER_IDS = ["alex", "bella", "chris", "dana"] as const;

/** Shape the model must return. */
export const AiProposalSchema = z.object({
  perspectiveSummary: z.string(),
  teamSummary: z.string(),
  changes: z.array(
    z.object({
      taskId: z.string(),
      newOwnerId: z.enum(MEMBER_IDS).nullable(),
      newTitle: z.string().nullable(),
      newDetail: z.string().nullable(),
      reason: z.string(),
    }),
  ),
  teacherPromptOptions: z.array(z.string()),
});

export type AiProposal = z.infer<typeof AiProposalSchema>;

/** Shape the browser sends to the API route. */
export const ProposalRequestSchema = z.object({
  issue: z.object({
    raisedBy: z.enum(MEMBER_IDS),
    text: z.string().trim().min(1).max(1000),
  }),
  tasks: z
    .array(
      z.object({
        id: z.string().max(60),
        title: z.string().max(120),
        detail: z.string().max(400),
        ownerId: z.enum(MEMBER_IDS),
      }),
    )
    .min(1)
    .max(12),
});

export type ProposalRequest = z.infer<typeof ProposalRequestSchema>;

const GENERIC_TEAM_SUMMARY =
  "One member feels the current split of work is uneven. The team is discussing how to share review and integration work.";

const DEFAULT_TEACHER_OPTIONS = [
  "Before you move any work, agree on what a finished section looks like. What does each of you need to hand over a section that needs no rework?",
  "Each of you: list what you are working on this week and how long it takes. Compare the lists before you decide who takes on more.",
  "Spend 10 minutes updating your team agreement: one shared format, one hand-off date, and who checks what.",
];

type TaskInput = Pick<Task, "id" | "title" | "detail" | "ownerId">;

function mentionsAMember(text: string): boolean {
  return MEMBERS.some((member) => new RegExp(`\\b${member.name}\\b`, "i").test(text));
}

/**
 * Turns raw model output into a proposal the app can trust.
 * Returns null when nothing usable is left.
 */
export function buildProposal(
  raw: AiProposal,
  tasks: TaskInput[],
  isSample: boolean,
): Proposal | null {
  const changes: ProposalChange[] = [];
  const seenTaskIds = new Set<string>();

  for (const change of raw.changes) {
    const task = tasks.find((candidate) => candidate.id === change.taskId);
    if (!task || seenTaskIds.has(task.id)) continue;

    const newOwnerId =
      change.newOwnerId && change.newOwnerId !== task.ownerId ? change.newOwnerId : undefined;
    const newTitle = change.newTitle?.trim() || undefined;
    const newDetail = change.newDetail?.trim() || undefined;
    if (!newOwnerId && !newTitle && !newDetail) continue;

    // The program, not the model, decides who is affected:
    // the current owner, plus the new owner when work moves.
    const affected = new Set<MemberId>([task.ownerId]);
    if (newOwnerId) affected.add(newOwnerId);

    seenTaskIds.add(task.id);
    changes.push({
      taskId: task.id,
      newOwnerId,
      newTitle,
      newDetail,
      reason: change.reason.trim(),
      affectedMemberIds: [...affected],
    });
    if (changes.length === 3) break;
  }

  if (changes.length === 0 || !raw.perspectiveSummary.trim()) return null;

  const teacherPromptOptions = raw.teacherPromptOptions
    .map((option) => option.trim())
    .filter((option) => option && !mentionsAMember(option))
    .slice(0, 3);

  const teamSummary = raw.teamSummary.trim();

  return {
    perspectiveSummary: raw.perspectiveSummary.trim(),
    // The teacher summary must never name a student.
    teamSummary: teamSummary && !mentionsAMember(teamSummary) ? teamSummary : GENERIC_TEAM_SUMMARY,
    changes,
    teacherPromptOptions:
      teacherPromptOptions.length > 0 ? teacherPromptOptions : DEFAULT_TEACHER_OPTIONS,
    isSample,
    responses: {},
    status: "open",
  };
}

/** Shown, clearly labeled, when the live AI call is unavailable. */
export function buildSampleProposal(tasks: TaskInput[], raisedByName: string): Proposal {
  const sample: AiProposal = {
    perspectiveSummary: `From ${raisedByName}'s perspective, putting the deck together involves a lot of rework, because sections arrive in different formats. The other members have not shared their view yet.`,
    teamSummary:
      "One member feels the integration work includes too much rework. The team is considering a shared hand-off standard and moving the consistency check to another member.",
    changes: [
      {
        taskId: "task-slides",
        newOwnerId: null,
        newTitle: null,
        newDetail:
          "Assemble the final deck from sections that already follow the shared template. Layout only, no content rework.",
        reason:
          "Integration stays one job, but fixing content goes back to the person who wrote it.",
      },
      {
        taskId: "task-finance",
        newOwnerId: null,
        newTitle: null,
        newDetail:
          "Build the revenue model and the first-year budget. Also check that the numbers match across all sections before hand-off.",
        reason:
          "Checking numbers is closest to the financial work. This adds work, so it needs the owner's consent.",
      },
    ],
    teacherPromptOptions: DEFAULT_TEACHER_OPTIONS,
  };

  const proposal = buildProposal(sample, tasks, true);
  if (proposal) return proposal;

  // The board no longer has the sample tasks: fall back to the first task.
  return {
    perspectiveSummary: sample.perspectiveSummary,
    teamSummary: GENERIC_TEAM_SUMMARY,
    changes: [
      {
        taskId: tasks[0].id,
        newDetail: `${tasks[0].detail} Follow the shared template before hand-off.`,
        reason: "A shared hand-off format reduces rework for everyone.",
        affectedMemberIds: [tasks[0].ownerId],
      },
    ],
    teacherPromptOptions: DEFAULT_TEACHER_OPTIONS,
    isSample: true,
    responses: {},
    status: "open",
  };
}

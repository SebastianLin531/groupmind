"use client";

import { useEffect, useReducer, useState } from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_ISSUE_TEXT,
  MEMBERS,
  ROLE_LABELS,
  COURSE_CONTEXT,
  SHOW_COURSE_SETUP,
  STORAGE_KEY,
  TASK_HOURS,
  WEEK_PLANS,
  contextLabel,
  SUPPORT_STATUS_LINE,
  TEAM_NAME,
  affectedMembers,
  createInitialState,
  memberName,
  reducer,
} from "@/lib/state";
import CourseSetup, { CourseGoals } from "@/components/CourseSetup";
import { getStrategy } from "@/lib/formation";
import { buildSampleProposal } from "@/lib/proposal";
import type {
  AppState,
  Issue,
  MemberId,
  Proposal,
  RoleId,
  Task,
} from "@/lib/types";

const ROLE_ORDER: RoleId[] = ["alex", "bella", "chris", "dana", "teacher"];

export default function Workspace() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const [hydrated, setHydrated] = useState(false);

  // Load saved state once in the browser, then keep it saved.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved)
        dispatch({ type: "hydrate", state: JSON.parse(saved) as AppState });
    } catch {
      // Unreadable saved state: keep the initial state.
    }
    // Reading localStorage must wait until the component is in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable: the app still works for this session.
    }
  }, [state, hydrated]);

  const [loading, setLoading] = useState(false);
  const [revising, setRevising] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);

  // Ask the AI to revise a declined proposal, once. On failure the original
  // proposal stays as it is and the team sees an error, never a stand-in.
  async function requestRevision() {
    const { issue, proposal } = state;
    if (!issue || !proposal || revising) return;
    if (proposal.status !== "needs_revision" || proposal.isRevised) return;

    setRevising(true);
    setRevisionError(null);
    const tasks = state.tasks.map(({ id, title, detail, ownerId }) => ({
      id,
      title,
      detail,
      ownerId,
    }));
    const courseContext =
      SHOW_COURSE_SETUP && state.setup.stage === "published"
        ? COURSE_CONTEXT
        : undefined;
    const revision = {
      previousChanges: proposal.changes.map(
        ({ taskId, newOwnerId, newTitle, newDetail, reason }) => ({
          taskId,
          newOwnerId,
          newTitle,
          newDetail,
          reason,
        }),
      ),
      responses: affectedMembers(proposal).map((memberId) => ({
        memberId,
        decision: proposal.responses[memberId]?.decision ?? "no_answer",
        reason: proposal.responses[memberId]?.reason,
      })),
      teacherGuidance: state.teacherGuidance ?? undefined,
    };
    try {
      const response = await fetch("/api/proposal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ issue, tasks, courseContext, revision }),
      });
      const data = (await response.json()) as {
        proposal?: Proposal;
        error?: string;
      };
      if (!response.ok || !data.proposal) {
        throw new Error(
          data.error ?? "The facilitator could not revise the proposal.",
        );
      }
      dispatch({ type: "set_revised_proposal", proposal: data.proposal });
    } catch (error) {
      setRevisionError(
        error instanceof Error && error.message
          ? error.message
          : "The facilitator could not revise the proposal. Your original proposal is unchanged.",
      );
    } finally {
      setRevising(false);
    }
  }

  // Ask the AI facilitator for a proposal. The server always answers with a
  // usable proposal; if even that fails, use the labeled sample.
  async function requestProposal(issue: Issue) {
    setLoading(true);
    const tasks = state.tasks.map(({ id, title, detail, ownerId }) => ({
      id,
      title,
      detail,
      ownerId,
    }));
    // The teacher's goals travel into the negotiation once teams are published.
    const courseContext =
      SHOW_COURSE_SETUP && state.setup.stage === "published"
        ? COURSE_CONTEXT
        : undefined;
    try {
      const response = await fetch("/api/proposal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ issue, tasks, courseContext }),
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const data = (await response.json()) as { proposal: Proposal };
      dispatch({ type: "set_proposal", proposal: data.proposal });
    } catch {
      dispatch({
        type: "set_proposal",
        proposal: buildSampleProposal(
          tasks,
          memberName(issue.raisedBy),
          courseContext,
        ),
      });
    } finally {
      setLoading(false);
    }
  }


  const isTeacher = state.currentRole === "teacher";

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pb-3 pt-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-white"
              >
                <LogoMark />
              </span>
              <div className="min-w-0">
                <h1 className="text-xl font-bold leading-tight tracking-tight text-ink">
                  GroupMind
                </h1>
                <p className="mt-0.5 max-w-2xl text-[13px] leading-snug text-muted">
                  An AI-powered collaborative learning platform. AI should help
                  students learn how to collaborate, not just help them finish
                  assignments.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: "reset" })}
              className="btn btn-ghost btn-sm shrink-0"
            >
              Reset demo
            </button>
          </div>
          <p className="flex items-start gap-2 rounded-inner border border-note-line bg-note-soft px-3 py-2 text-[13px] font-medium leading-snug text-note">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Demo mode: one browser simulates 4 students and 1 teacher. All
              data is mock data.
            </span>
          </p>
        </div>
      </header>

      <div className="z-30 border-b border-line bg-surface sm:sticky sm:top-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-2 sm:px-6">
          <RoleSwitcher
            current={state.currentRole}
            onSwitch={(role) => dispatch({ type: "switch_role", role })}
          />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 pb-16 pt-4 sm:px-6">
        <p className="text-sm font-medium text-ink-2">
          {isTeacher
            ? "Phase 1 · Before class: design the course and form teams. Team support requests appear below."
            : "Phase 2 · During the project: plan your week, share the work, and negotiate changes as a team."}
        </p>

        {isTeacher ? (
          <div className="flex flex-col gap-5">
            {SHOW_COURSE_SETUP && (
              <CourseSetup setup={state.setup} dispatch={dispatch} />
            )}
            <TeacherView
              state={state}
              onSend={(text) => dispatch({ type: "send_guidance", text })}
            />
          </div>
        ) : (
          <TeamView
            state={state}
            currentMember={state.currentRole as MemberId}
            loading={loading}
            onRaiseIssue={(text) => {
              const issue: Issue = {
                raisedBy: state.currentRole as MemberId,
                text,
              };
              dispatch({ type: "raise_issue", ...issue });
              void requestProposal(issue);
            }}
            onRetry={() => {
              if (state.issue) void requestProposal(state.issue);
            }}
            onRespond={(decision, reason) =>
              dispatch({
                type: "respond",
                memberId: state.currentRole as MemberId,
                decision,
                reason,
              })
            }
            onRequestSupport={() => dispatch({ type: "request_support" })}
            revising={revising}
            revisionError={revisionError}
            onRequestRevision={() => void requestRevision()}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- Small inline icons (decorative, always paired with text) ---------- */

type IconProps = { className?: string };

function Svg({
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-3.5 w-3.5"}
    >
      {children}
    </svg>
  );
}

function LogoMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5">
      <circle cx="6" cy="7" r="2.6" fill="currentColor" />
      <circle cx="14" cy="7" r="2.6" fill="currentColor" opacity="0.7" />
      <circle cx="10" cy="14" r="2.6" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </Svg>
  );
}

function CrossIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </Svg>
  );
}

function ClockIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5V10l2.5 1.5" />
    </Svg>
  );
}

function LockIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4.5" y="9" width="11" height="7.5" rx="2" />
      <path d="M7 9V6.8a3 3 0 016 0V9" />
    </Svg>
  );
}

function PinIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3l5 5-3 1-2.5 2.5.5 3.5-7-7 3.5.5L11 6z" />
      <path d="M7.5 12.5l-4 4" />
    </Svg>
  );
}

function InfoIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9v4.5M10 6.5v.01" />
    </Svg>
  );
}

function SparkIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className ?? "h-4 w-4"}
    >
      <path d="M10 1.5l1.9 5.1a2 2 0 001.2 1.2l5.100 1.900-5.100 1.900a2 2 0 00-1.200 1.200L10 17.900l-1.900-5.100a2 2 0 00-1.200-1.200L1.800 9.700l5.100-1.900a2 2 0 001.200-1.200z" />
    </svg>
  );
}

function RoleSwitcher({
  current,
  onSwitch,
}: {
  current: RoleId;
  onSwitch: (role: RoleId) => void;
}) {
  return (
    <nav
      aria-label="Viewing as"
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
    >
      <span className="eyebrow mr-1 w-full sm:w-auto">Viewing as</span>
      {ROLE_ORDER.map((role) => {
        const active = role === current;
        return (
          <button
            key={role}
            type="button"
            aria-pressed={active}
            onClick={() => onSwitch(role)}
            className={
              active
                ? "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ink bg-ink py-1 pl-1 pr-3 text-sm font-semibold text-white"
                : "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm font-medium text-ink-2 hover:border-line-strong hover:bg-sunken"
            }
          >
            <Avatar who={role} small />
            {ROLE_LABELS[role]}
            {active && <CheckIcon className="h-3.5 w-3.5" />}
          </button>
        );
      })}
    </nav>
  );
}

function TeamView({
  state,
  currentMember,
  loading,
  onRaiseIssue,
  onRetry,
  onRespond,
  onRequestSupport,
  revising,
  revisionError,
  onRequestRevision,
}: {
  state: AppState;
  currentMember: MemberId;
  loading: boolean;
  onRaiseIssue: (text: string) => void;
  onRetry: () => void;
  onRespond: RespondHandler;
  onRequestSupport: () => void;
  revising: boolean;
  revisionError: string | null;
  onRequestRevision: () => void;
}) {
  const published = SHOW_COURSE_SETUP && state.setup.stage === "published";
  const strategyName = state.setup.strategyId
    ? getStrategy(state.setup.strategyId).name
    : "";

  return (
    <main className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
      {/* Feed column: the team thread is the centre of the student view. */}
      <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-3">
        {state.teacherGuidance && (
          <section
            aria-labelledby="guidance-heading"
            className="rounded-card border border-teacher-line bg-teacher-soft p-4"
          >
            <div className="flex gap-3">
              <Avatar who="teacher" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2
                    id="guidance-heading"
                    className="text-sm font-bold text-teacher-strong"
                  >
                    From your teacher{" "}
                    <span className="font-normal text-teacher">
                      &middot; pinned
                    </span>
                  </h2>
                  <PinIcon className="h-4 w-4 text-teacher" />
                </div>
                <p className="mt-1 text-[15px] leading-relaxed text-ink">
                  {state.teacherGuidance}
                </p>
              </div>
            </div>
          </section>
        )}

        {state.issue ? (
          <>
            <h2 className="px-1 text-lg font-bold tracking-tight text-ink">
              Team thread
            </h2>
            <section className="card p-4">
              <div className="flex gap-3">
                <Avatar who={state.issue.raisedBy} />
                <div className="min-w-0">
                  <p className="text-sm leading-snug">
                    <span className="font-bold text-ink">
                      {memberName(state.issue.raisedBy)}
                    </span>{" "}
                    <span className="text-muted">
                      @{state.issue.raisedBy} &middot; Issue raised by{" "}
                      {memberName(state.issue.raisedBy)}
                    </span>
                  </p>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink">
                    {state.issue.text}
                  </p>
                </div>
              </div>
            </section>
            {state.proposal ? (
              <>
                <ProposalCard
                  proposal={state.proposal}
                  tasks={state.tasks}
                  key={`${currentMember}-${state.proposal.isRevised ? "revised" : "first"}`}
                  currentMember={currentMember}
                  onRespond={onRespond}
                />
                {state.proposal.status === "needs_revision" &&
                  !state.proposal.isRevised && (
                    <section
                      aria-labelledby="revise-heading"
                      className="rounded-card border border-ai-line bg-ai-soft p-4"
                    >
                      <div className="flex gap-3">
                        <Avatar who="ai" small />
                        <div className="min-w-0 flex-1">
                          <h2
                            id="revise-heading"
                            className="text-sm font-bold text-ink"
                          >
                            Try a different arrangement
                          </h2>
                          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
                            The facilitator rewrites the proposal around the
                            reasons given. One revision only. Everyone affected
                            decides again from scratch.
                          </p>
                          <button
                            type="button"
                            disabled={revising}
                            aria-busy={revising}
                            onClick={onRequestRevision}
                            className="btn btn-ai mt-3 w-full sm:w-auto"
                          >
                            <SparkIcon />
                            {revising
                              ? "Revising the proposal..."
                              : "Ask AI to revise proposal"}
                          </button>
                          {revisionError && (
                            <p
                              role="alert"
                              className="mt-3 text-sm font-medium text-no-strong"
                            >
                              {revisionError}
                            </p>
                          )}
                        </div>
                      </div>
                    </section>
                  )}
                {state.proposal.status === "needs_revision" && (
                  <SupportRequest
                    proposal={state.proposal}
                    requested={state.supportRequested}
                    onRequest={onRequestSupport}
                  />
                )}
              </>
            ) : loading ? (
              <div
                role="status"
                className="flex gap-3 rounded-card border border-ai-line bg-ai-soft p-4"
              >
                <Avatar who="ai" />
                <div className="min-w-0">
                  <p className="text-sm leading-snug">
                    <span className="font-bold text-ink">GroupMind</span>{" "}
                    <span className="chip chip-ai align-middle">AI</span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ai-strong">
                    The facilitator is reading the board and drafting a
                    proposal. This takes a few seconds.
                  </p>
                  <span aria-hidden="true" className="mt-2 flex gap-1">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </span>
                </div>
              </div>
            ) : (
              <div className="card p-4">
                <p className="text-sm text-ink-2">No proposal yet.</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="btn btn-ai mt-3"
                >
                  Ask the facilitator for a proposal
                </button>
              </div>
            )}
          </>
        ) : (
          <IssueForm
            who={currentMember}
            memberName={memberName(currentMember)}
            onSubmit={onRaiseIssue}
          />
        )}
      </div>

      {/* Side column: light, supporting information. */}
      <aside className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-4 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1">
        <MyWeek tasks={state.tasks} currentMember={currentMember} />
        <TaskBoard tasks={state.tasks} currentMember={currentMember} />
        {published && (
          <section
            aria-labelledby="course-heading"
            className="rounded-card border border-line bg-surface/70 p-4"
          >
            <h2 id="course-heading" className="text-sm font-bold text-ink">
              Set by your teacher
            </h2>
            <p className="mt-1 text-xs leading-snug text-muted">
              Teams formed by: {strategyName}. You are viewing a fixed sample
              team for this demo.
            </p>
            <div className="mt-3">
              <CourseGoals stacked />
            </div>
          </section>
        )}
      </aside>
    </main>
  );
}

/** Per-person avatar tints. People are circles; the AI is a rounded square. */
const AVATAR_STYLES: Record<string, string> = {
  alex: "bg-amber-200 text-amber-950",
  bella: "bg-rose-200 text-rose-950",
  chris: "bg-sky-200 text-sky-950",
  dana: "bg-emerald-200 text-emerald-950",
  teacher: "bg-teacher text-white",
  ai: "bg-ai text-white",
};

/** Round initial badge, like a profile picture in a social feed. */
function Avatar({ who, small }: { who: string; small?: boolean }) {
  const isAi = who === "ai";
  return (
    <span
      aria-hidden="true"
      data-initial={isAi ? undefined : who.charAt(0).toUpperCase()}
      className={`avatar flex shrink-0 items-center justify-center font-bold ${
        isAi
          ? small
            ? "rounded-lg"
            : "rounded-xl"
          : "rounded-full"
      } ${small ? "h-7 w-7 text-xs" : "h-10 w-10 text-sm"} ${
        AVATAR_STYLES[who] ?? "bg-line text-ink"
      }`}
    >
      {/* The initial is drawn by CSS so it never mixes into button text. */}
      {isAi && <SparkIcon className={small ? "h-3.5 w-3.5" : "h-5 w-5"} />}
    </span>
  );
}

type RespondHandler = (
  decision: "consent" | "decline",
  reason?: string,
) => void;

const DEFAULT_DECLINE_REASON =
  "I have two exams this week and can't take on more work.";

function ProposalCard({
  proposal,
  tasks,
  currentMember,
  onRespond,
}: {
  proposal: Proposal;
  tasks: Task[];
  currentMember: MemberId;
  onRespond: RespondHandler;
}) {
  const needsConsent = affectedMembers(proposal);
  const applied = proposal.status === "applied";
  const isAffected = needsConsent.includes(currentMember);
  const myResponse = proposal.responses[currentMember];
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState(
    WEEK_PLANS[currentMember]?.shareableReason ?? DEFAULT_DECLINE_REASON,
  );

  return (
    <section
      aria-labelledby="proposal-heading"
      className="rounded-card border border-ai-line bg-surface shadow-card"
    >
      {/* AI author strip: tinted so it never reads as a classmate's post. */}
      <div className="flex flex-wrap items-center gap-3 rounded-t-card border-b border-ai-line bg-ai-soft px-4 py-3">
        <Avatar who="ai" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug">
            <span className="font-bold text-ink">GroupMind</span>{" "}
            <span className="text-ink-2">
              @facilitator &middot; AI, replying to the team
            </span>
          </p>
          <h2
            id="proposal-heading"
            className="text-base font-bold leading-tight text-ai-strong"
          >
            {proposal.isRevised ? "Revised proposal" : "Facilitator proposal"}
          </h2>
        </div>
        {proposal.isSample && (
          <span className="chip chip-note">
            Sample proposal (not generated live)
          </span>
        )}
      </div>

      <div className="px-4 pb-4 pt-3">
        {proposal.isRevised && proposal.revisionNote && (
          <p className="mb-3 rounded-inner border border-ai-line bg-ai-soft px-3 py-2 text-sm leading-snug text-ink">
            <span className="font-bold text-ai-strong">What changed:</span>{" "}
            {proposal.revisionNote}
          </p>
        )}

        <p className="text-sm leading-relaxed text-ink-2">
          {proposal.perspectiveSummary}
        </p>

        <h3 className="eyebrow mt-4">Proposed changes</h3>
        <ol className="mt-1.5 flex flex-col gap-2">
          {proposal.changes.map((change, index) => {
            const task = tasks.find(
              (candidate) => candidate.id === change.taskId,
            );
            return (
              <li
                key={change.taskId}
                className="flex gap-2.5 rounded-inner border border-line bg-sunken p-3"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold tabular-nums text-white"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-ink">
                    {task?.title ?? change.taskId}
                    {change.newTitle && !applied && (
                      <> &rarr; {change.newTitle}</>
                    )}
                  </p>
                  {change.newOwnerId && task && (
                    <p className="mt-1 text-sm leading-snug text-ink-2">
                      <span className="text-muted">Owner:</span>{" "}
                      {applied ? "" : <>{memberName(task.ownerId)} &rarr; </>}
                      <span className="font-semibold text-ink">
                        {memberName(change.newOwnerId)}
                      </span>
                    </p>
                  )}
                  {change.newDetail && (
                    <p className="mt-1 text-sm leading-snug text-ink-2">
                      <span className="text-muted">New scope:</span>{" "}
                      {change.newDetail}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs leading-snug text-muted">
                    <span className="font-semibold">Why:</span> {change.reason}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <p className="chip chip-ai whitespace-normal">
                      Needs consent from:{" "}
                      {change.affectedMemberIds.map(memberName).join(", ")}
                    </p>
                    {change.groundedIn && change.groundedIn.length > 0 && (
                      <p className="chip whitespace-normal border-teacher-line bg-teacher-soft text-teacher-strong">
                        Based on your teacher&apos;s{" "}
                        {change.groundedIn.map(contextLabel).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <h3 className="eyebrow mt-4">Consent</h3>
        <ul className="mt-1.5 flex flex-col gap-2">
          {needsConsent.map((id) => {
            const response = proposal.responses[id];
            return (
              <li key={id} className="flex gap-2.5">
                <Avatar who={id} small />
                <div className="min-w-0 flex-1 text-sm text-ink-2">
                  <p className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-bold text-ink">{memberName(id)}</span>{" "}
                    {!response && (
                      <span className="chip">
                        <ClockIcon />
                        Waiting for an answer
                      </span>
                    )}
                    {response?.decision === "consent" && (
                      <span className="chip chip-ok">
                        <CheckIcon />
                        Consented
                      </span>
                    )}
                    {response?.decision === "decline" && (
                      <span className="chip chip-no">
                        <CrossIcon />
                        Declined
                      </span>
                    )}
                  </p>
                  {response?.decision === "decline" && (
                    <p className="mt-1 rounded-inner rounded-tl-sm border border-line bg-sunken px-3 py-2 text-[15px] leading-relaxed text-ink">
                      {response.reason}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {applied && (
          <p
            role="status"
            className="mt-4 flex items-start gap-2 rounded-inner border border-ok-line bg-ok-soft p-3 text-sm font-semibold text-ok-strong"
          >
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Everyone affected agreed. The task board is updated.</span>
          </p>
        )}

        {proposal.status === "needs_revision" && (
          <p
            role="status"
            className="mt-4 flex items-start gap-2 rounded-inner border border-no-line bg-no-soft p-3 text-sm font-medium text-no-strong"
          >
            <CrossIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Not agreed yet. Nothing on the board has changed.</span>
          </p>
        )}

        {!applied && !isAffected && (
          <>
            <p className="mt-4 text-xs leading-snug text-muted">
              Nothing changes until {needsConsent.map(memberName).join(" and ")}{" "}
              {needsConsent.length === 1 ? "agrees" : "agree"}. There is no
              majority vote.
            </p>
            <p className="mt-2 rounded-inner border border-line bg-sunken px-3 py-2 text-sm leading-snug text-ink-2">
              {memberName(currentMember)}, these changes do not affect your
              work, so your consent is not needed.
            </p>
          </>
        )}

        {/* Action bar: sticks to the bottom of the screen while the card is in view. */}
        {!applied && isAffected && (
          <div className="sticky bottom-3 z-20 mt-4 rounded-card border border-line-strong bg-surface p-3 shadow-bar">
            <p className="text-xs leading-snug text-muted">
              Nothing changes until {needsConsent.map(memberName).join(" and ")}{" "}
              {needsConsent.length === 1 ? "agrees" : "agree"}. There is no
              majority vote.
            </p>

            {!declining && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={myResponse?.decision === "consent"}
                  onClick={() => onRespond("consent")}
                  className="btn btn-ok flex-1 sm:flex-none"
                >
                  <CheckIcon className="h-4 w-4" />
                  {myResponse?.decision === "consent"
                    ? "You consented"
                    : "I consent"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeclining(true)}
                  className="btn btn-ghost flex-1 sm:flex-none"
                >
                  {myResponse?.decision === "decline"
                    ? "Change my reason"
                    : "I can't agree to this yet"}
                </button>
              </div>
            )}

            {declining && (
              <form
                className="mt-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!reason.trim()) return;
                  onRespond("decline", reason);
                  setDeclining(false);
                }}
              >
                <label
                  htmlFor="decline-reason"
                  className="text-sm font-semibold leading-snug text-ink"
                >
                  What makes this hard for you? Your team will see only what you
                  write here, not your calendar.
                </label>
                <textarea
                  id="decline-reason"
                  rows={2}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="field mt-2"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={!reason.trim()}
                    className="btn btn-primary flex-1 sm:flex-none"
                  >
                    Decline with this reason
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeclining(false)}
                    className="btn btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** The current student's own week. Teammates and the teacher never see this panel. */
function MyWeek({
  tasks,
  currentMember,
}: {
  tasks: Task[];
  currentMember: MemberId;
}) {
  const plan = WEEK_PLANS[currentMember];
  const myTasks = tasks.filter((task) => task.ownerId === currentMember);
  const neededHours = myTasks.reduce(
    (sum, task) => sum + (TASK_HOURS[task.id] ?? 0),
    0,
  );
  const over = neededHours - plan.freeHours;
  const percent = Math.min(
    100,
    Math.round((neededHours / Math.max(plan.freeHours, 1)) * 100),
  );

  return (
    <section
      aria-labelledby="week-heading"
      className="rounded-card border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="week-heading" className="text-sm font-bold text-ink">
          My week
        </h2>
        <span className="chip">
          <LockIcon />
          Private to {memberName(currentMember)}
        </span>
      </div>

      <p className="mt-3 text-sm text-ink-2">
        <span className="text-lg font-bold tabular-nums text-ink">
          {neededHours}h
        </span>{" "}
        needed for my tasks,{" "}
        <span className="font-bold tabular-nums text-ink">
          {plan.freeHours}h
        </span>{" "}
        free
      </p>
      <div
        role="img"
        aria-label={`${neededHours} of ${plan.freeHours} free hours used`}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className={over > 0 ? "h-full bg-no" : "h-full bg-ok"}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p
        className={
          over > 0
            ? "mt-2 flex items-center gap-1 text-sm font-semibold text-no-strong"
            : "mt-2 flex items-center gap-1 text-sm font-semibold text-ok-strong"
        }
      >
        {over > 0 ? <CrossIcon /> : <CheckIcon />}
        {over > 0
          ? `Over by ${over}h this week`
          : `Fits, with ${-over}h to spare`}
      </p>

      <h3 className="eyebrow mt-4">Other commitments</h3>
      <ul className="mt-1 flex flex-col gap-1">
        {plan.commitments.map((commitment) => (
          <li
            key={commitment}
            className="flex gap-2 text-[13px] leading-snug text-ink-2"
          >
            <span
              aria-hidden="true"
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong"
            />
            {commitment}
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-line pt-2 text-xs leading-snug text-muted">
        Your teammates and your teacher do not see this. When you answer a
        proposal, you choose what to share. Hours are estimates from mock data.
      </p>
    </section>
  );
}

function TaskBoard({
  tasks,
  currentMember,
}: {
  tasks: Task[];
  currentMember: MemberId;
}) {
  return (
    <section
      aria-labelledby="board-heading"
      className="rounded-card border border-line bg-surface p-4"
    >
      <h2 id="board-heading" className="text-sm font-bold text-ink">
        Team task board
      </h2>
      <ul className="mt-2 flex flex-col divide-y divide-line">
        {MEMBERS.map((member) => {
          const memberTasks = tasks.filter(
            (task) => task.ownerId === member.id,
          );
          const isMe = member.id === currentMember;
          return (
            <li key={member.id} className="py-3 first:pt-1 last:pb-0">
              <div className="flex items-center gap-2">
                <Avatar who={member.id} small />
                <span className="text-sm font-bold text-ink">
                  {member.name}
                </span>
                {isMe && (
                  <span className="chip border-ink bg-ink text-white">You</span>
                )}
              </div>
              <ul className="mt-2 flex flex-col gap-1.5 pl-9">
                {memberTasks.length === 0 && (
                  <li className="text-[13px] text-muted">No tasks assigned.</li>
                )}
                {memberTasks.map((task) => (
                  <li
                    key={task.id}
                    className={
                      task.changed
                        ? "rounded-inner border border-ok-line bg-ok-soft px-2.5 py-2"
                        : "rounded-inner border border-transparent bg-sunken px-2.5 py-2"
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-semibold leading-snug text-ink">
                        {task.title}
                      </span>
                      {task.changed && (
                        <span className="chip chip-solid-ok">
                          <CheckIcon />
                          Updated
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-muted">
                      {task.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function IssueForm({
  who,
  memberName: name,
  onSubmit,
}: {
  who: MemberId;
  memberName: string;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState(DEFAULT_ISSUE_TEXT);
  const trimmed = text.trim();

  return (
    <form
      className="card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) onSubmit(trimmed);
      }}
    >
      <div className="flex gap-3">
        <Avatar who={who} />
        <div className="min-w-0 flex-1">
          <label
            htmlFor="issue-text"
            className="text-[15px] font-bold leading-snug text-ink"
          >
            {name}, is something not working in your team?
          </label>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">
            The AI facilitator treats this as your perspective, not as a fact
            about your teammates.
          </p>
          <textarea
            id="issue-text"
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="field mt-3"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={!trimmed}
              className="btn btn-primary w-full sm:w-auto"
            >
              Raise issue with the team
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function SharedSummary({ proposal }: { proposal: Proposal }) {
  return (
    <div className="mt-3 rounded-inner border border-teacher-line bg-surface p-3">
      <p className="text-sm leading-relaxed text-ink">{proposal.teamSummary}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        {SUPPORT_STATUS_LINE}
      </p>
    </div>
  );
}

function SupportRequest({
  proposal,
  requested,
  onRequest,
}: {
  proposal: Proposal;
  requested: boolean;
  onRequest: () => void;
}) {
  return (
    <section
      aria-labelledby="support-heading"
      className="rounded-card border border-teacher-line bg-teacher-soft p-4"
    >
      <div className="flex gap-3">
        <Avatar who="teacher" small />
        <div className="min-w-0 flex-1">
          <h2
            id="support-heading"
            className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-ink"
          >
            {requested && (
              <CheckIcon className="h-4 w-4 shrink-0 text-teacher" />
            )}
            {requested
              ? "Support requested"
              : "Stuck? Ask your teacher for support"}
          </h2>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
            {requested
              ? "Your teacher sees only this summary. No names, no quotes, no private messages."
              : "This is everything your teacher will see. No names, no quotes, no private messages."}
          </p>
          <SharedSummary proposal={proposal} />
          {!requested && (
            <button
              type="button"
              onClick={onRequest}
              className="btn btn-teacher mt-3 w-full sm:w-auto"
            >
              Share this and ask for support
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function TeacherView({
  state,
  onSend,
}: {
  state: AppState;
  onSend: (text: string) => void;
}) {
  const proposal = state.proposal;
  const [draft, setDraft] = useState("");

  if (!state.supportRequested || !proposal) {
    return (
      <main className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold tracking-tight text-ink">
          Teacher view
        </h2>
        <p className="mt-2 flex items-center gap-2 text-sm font-medium text-ink-2">
          <CheckIcon className="h-4 w-4 text-ok" />
          No team needs support.
        </p>
        <p className="mt-1 text-xs leading-snug text-muted">
          You only see what a team chooses to share. Private conversations are
          never shown here.
        </p>
      </main>
    );
  }

  return (
    <main className="rounded-card border border-teacher-line bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-bold tracking-tight text-ink">
        Teacher view
      </h2>
      <p className="mt-1 text-xs leading-snug text-muted">
        You only see what a team chooses to share. Private conversations are
        never shown here.
      </p>

      <div className="mt-4 rounded-card border border-teacher-line bg-teacher-soft p-4">
        <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-teacher-strong">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full bg-teacher"
          />
          {TEAM_NAME} asked for support
        </h3>
        <SharedSummary proposal={proposal} />

        {proposal.status === "applied" && (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-ok-strong">
            <CheckIcon className="h-4 w-4" />
            Update: the team has since reached an agreement.
          </p>
        )}
      </div>

      {state.teacherGuidance ? (
        <div className="mt-5">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <CheckIcon className="h-4 w-4 text-ok" />
            Sent to the team
          </h3>
          <p className="mt-2 rounded-inner border border-teacher-line bg-teacher-soft p-3 text-[15px] leading-relaxed text-ink">
            {state.teacherGuidance}
          </p>
        </div>
      ) : (
        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim()) onSend(draft);
          }}
        >
          <h3 className="text-sm font-bold text-ink">
            Send one piece of guidance
          </h3>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            AI-suggested starting points. Pick one, edit it, or write your own.
            You decide what is sent.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {proposal.teacherPromptOptions.map((option, index) => (
              <li key={index}>
                <button
                  type="button"
                  aria-pressed={draft === option}
                  onClick={() => setDraft(option)}
                  className={
                    draft === option
                      ? "flex w-full items-start gap-2.5 rounded-inner border-2 border-teacher bg-teacher-soft p-3 text-left text-sm leading-snug text-ink"
                      : "flex w-full items-start gap-2.5 rounded-inner border-2 border-line bg-surface p-3 text-left text-sm leading-snug text-ink-2 hover:border-line-strong hover:bg-sunken"
                  }
                >
                  <span
                    aria-hidden="true"
                    className={
                      draft === option
                        ? "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-teacher text-white"
                        : "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-line-strong"
                    }
                  >
                    {draft === option && <CheckIcon className="h-3 w-3" />}
                  </span>
                  <span>{option}</span>
                </button>
              </li>
            ))}
          </ul>
          <label
            htmlFor="guidance-draft"
            className="mt-4 block text-sm font-semibold text-ink"
          >
            Message to the team
          </label>
          <textarea
            id="guidance-draft"
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Pick a suggestion above or write your own."
            className="field mt-2"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="btn btn-teacher mt-3 w-full sm:w-auto"
          >
            Send to the team
          </button>
        </form>
      )}
    </main>
  );
}

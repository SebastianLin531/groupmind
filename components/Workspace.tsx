"use client";

import { useEffect, useReducer, useState } from "react";
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
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              GroupMind
            </h1>
            <p className="text-sm text-slate-600">
              An AI facilitator for student teams, with the teacher in the loop.
            </p>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "reset" })}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset demo
          </button>
        </div>
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Demo mode: one browser simulates 4 students and 1 teacher. All data is
          mock data.
        </p>
        <RoleSwitcher
          current={state.currentRole}
          onSwitch={(role) => dispatch({ type: "switch_role", role })}
        />
      </header>

      {isTeacher ? (
        <div className="flex flex-col gap-6">
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
    <nav aria-label="Viewing as" className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-slate-600">Viewing as</span>
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
                ? "rounded-full bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            }
          >
            {ROLE_LABELS[role]}
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
    <main className="flex flex-col gap-6">
      {published && (
        <section
          aria-labelledby="course-heading"
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <h2
            id="course-heading"
            className="text-sm font-semibold text-slate-900"
          >
            Set by your teacher
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Teams formed by: {strategyName}. You are viewing a fixed sample team
            for this demo.
          </p>
          <div className="mt-3">
            <CourseGoals />
          </div>
        </section>
      )}
      {state.teacherGuidance && (
        <section
          aria-labelledby="guidance-heading"
          className="rounded-lg border-2 border-violet-300 bg-violet-50 p-4"
        >
          <h2
            id="guidance-heading"
            className="text-sm font-semibold text-violet-900"
          >
            From your teacher
          </h2>
          <p className="mt-2 text-sm text-violet-950">
            {state.teacherGuidance}
          </p>
        </section>
      )}
      <MyWeek tasks={state.tasks} currentMember={currentMember} />
      <TaskBoard tasks={state.tasks} currentMember={currentMember} />
      {state.issue ? (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Issue raised by {memberName(state.issue.raisedBy)}
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              &ldquo;{state.issue.text}&rdquo;
            </p>
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
                    className="rounded-lg border border-indigo-200 bg-white p-4"
                  >
                    <h2
                      id="revise-heading"
                      className="text-sm font-semibold text-slate-900"
                    >
                      Try a different arrangement
                    </h2>
                    <p className="mt-1 text-xs text-slate-600">
                      The facilitator rewrites the proposal around the reasons
                      given. One revision only. Everyone affected decides again
                      from scratch.
                    </p>
                    <button
                      type="button"
                      disabled={revising}
                      aria-busy={revising}
                      onClick={onRequestRevision}
                      className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {revising
                        ? "Revising the proposal..."
                        : "Ask AI to revise proposal"}
                    </button>
                    {revisionError && (
                      <p role="alert" className="mt-3 text-sm text-rose-800">
                        {revisionError}
                      </p>
                    )}
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
            <p
              role="status"
              className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900"
            >
              The facilitator is reading the board and drafting a proposal. This
              takes a few seconds.
            </p>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-700">No proposal yet.</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Ask the facilitator for a proposal
              </button>
            </div>
          )}
        </>
      ) : (
        <IssueForm
          memberName={memberName(currentMember)}
          onSubmit={onRaiseIssue}
        />
      )}
    </main>
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
      className="rounded-lg border border-indigo-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="proposal-heading"
          className="text-lg font-semibold text-slate-900"
        >
          {proposal.isRevised ? "Revised proposal" : "Facilitator proposal"}
        </h2>
        {proposal.isSample && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
            Sample proposal (not generated live)
          </span>
        )}
      </div>

      {proposal.isRevised && proposal.revisionNote && (
        <p className="mt-3 rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950">
          <span className="font-semibold">What changed:</span>{" "}
          {proposal.revisionNote}
        </p>
      )}

      <p className="mt-3 text-sm text-slate-700">
        {proposal.perspectiveSummary}
      </p>

      <h3 className="mt-4 text-sm font-semibold text-slate-900">
        Proposed changes
      </h3>
      <ol className="mt-2 flex flex-col gap-3">
        {proposal.changes.map((change) => {
          const task = tasks.find(
            (candidate) => candidate.id === change.taskId,
          );
          return (
            <li
              key={change.taskId}
              className="rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <p className="text-sm font-medium text-slate-900">
                {task?.title ?? change.taskId}
                {change.newTitle && !applied && <> &rarr; {change.newTitle}</>}
              </p>
              {change.newOwnerId && task && (
                <p className="mt-1 text-sm text-slate-700">
                  Owner:{" "}
                  {applied ? "" : <>{memberName(task.ownerId)} &rarr; </>}
                  {memberName(change.newOwnerId)}
                </p>
              )}
              {change.newDetail && (
                <p className="mt-1 text-sm text-slate-700">
                  New scope: {change.newDetail}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-600">
                Why: {change.reason}
              </p>
              {change.groundedIn && change.groundedIn.length > 0 && (
                <p className="mt-2 text-xs font-medium text-violet-800">
                  Based on your teacher&apos;s{" "}
                  {change.groundedIn.map(contextLabel).join(", ")}
                </p>
              )}
              <p className="mt-2 text-xs font-medium text-indigo-800">
                Needs consent from:{" "}
                {change.affectedMemberIds.map(memberName).join(", ")}
              </p>
            </li>
          );
        })}
      </ol>

      <h3 className="mt-4 text-sm font-semibold text-slate-900">Consent</h3>
      <ul className="mt-2 flex flex-col gap-1">
        {needsConsent.map((id) => {
          const response = proposal.responses[id];
          return (
            <li key={id} className="text-sm text-slate-700">
              <span className="font-medium text-slate-900">
                {memberName(id)}:
              </span>{" "}
              {!response && "Waiting for an answer"}
              {response?.decision === "consent" && (
                <span className="font-medium text-emerald-700">Consented</span>
              )}
              {response?.decision === "decline" && (
                <>
                  <span className="font-medium text-rose-700">Declined</span>
                  {" - "}
                  &ldquo;{response.reason}&rdquo;
                </>
              )}
            </li>
          );
        })}
      </ul>

      {applied && (
        <p
          role="status"
          className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-900"
        >
          Everyone affected agreed. The task board is updated.
        </p>
      )}

      {proposal.status === "needs_revision" && (
        <p
          role="status"
          className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
        >
          Not agreed yet. Nothing on the board has changed.
        </p>
      )}

      {!applied && (
        <p className="mt-4 text-xs text-slate-600">
          Nothing changes until {needsConsent.map(memberName).join(" and ")}{" "}
          {needsConsent.length === 1 ? "agrees" : "agree"}. There is no majority
          vote.
        </p>
      )}

      {!applied && !isAffected && (
        <p className="mt-3 text-sm text-slate-700">
          {memberName(currentMember)}, these changes do not affect your work, so
          your consent is not needed.
        </p>
      )}

      {!applied && isAffected && !declining && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={myResponse?.decision === "consent"}
            onClick={() => onRespond("consent")}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {myResponse?.decision === "consent" ? "You consented" : "I consent"}
          </button>
          <button
            type="button"
            onClick={() => setDeclining(true)}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {myResponse?.decision === "decline"
              ? "Change my reason"
              : "I can't agree to this yet"}
          </button>
        </div>
      )}

      {!applied && isAffected && declining && (
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!reason.trim()) return;
            onRespond("decline", reason);
            setDeclining(false);
          }}
        >
          <label
            htmlFor="decline-reason"
            className="text-sm font-medium text-slate-900"
          >
            What makes this hard for you? Your team will see only what you write
            here, not your calendar.
          </label>
          <textarea
            id="decline-reason"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 p-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!reason.trim()}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Decline with this reason
            </button>
            <button
              type="button"
              onClick={() => setDeclining(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
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
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="week-heading" className="text-lg font-semibold text-slate-900">
          My week
        </h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          Private to {memberName(currentMember)}
        </span>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Other commitments
          </h3>
          <ul className="mt-1 flex flex-col gap-1">
            {plan.commitments.map((commitment) => (
              <li key={commitment} className="text-sm text-slate-800">
                {commitment}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Team work this week
          </h3>
          <p className="mt-1 text-sm text-slate-800">
            <span className="font-semibold tabular-nums">{neededHours}h</span>{" "}
            needed for my tasks,{" "}
            <span className="font-semibold tabular-nums">
              {plan.freeHours}h
            </span>{" "}
            free
          </p>
          <div
            role="img"
            aria-label={`${neededHours} of ${plan.freeHours} free hours used`}
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200"
          >
            <div
              className={
                over > 0 ? "h-full bg-rose-500" : "h-full bg-emerald-500"
              }
              style={{ width: `${percent}%` }}
            />
          </div>
          <p
            className={
              over > 0
                ? "mt-2 text-sm font-medium text-rose-800"
                : "mt-2 text-sm font-medium text-emerald-800"
            }
          >
            {over > 0
              ? `Over by ${over}h this week`
              : `Fits, with ${-over}h to spare`}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
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
    <section aria-labelledby="board-heading">
      <h2
        id="board-heading"
        className="mb-3 text-lg font-semibold text-slate-900"
      >
        Team task board
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MEMBERS.map((member) => {
          const memberTasks = tasks.filter(
            (task) => task.ownerId === member.id,
          );
          const isMe = member.id === currentMember;
          return (
            <li
              key={member.id}
              className={
                isMe
                  ? "rounded-lg border-2 border-indigo-500 bg-white p-3"
                  : "rounded-lg border border-slate-200 bg-white p-3"
              }
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">
                  {member.name}
                </span>
                {isMe && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    You
                  </span>
                )}
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                {memberTasks.length === 0 && (
                  <li className="text-sm text-slate-500">No tasks assigned.</li>
                )}
                {memberTasks.map((task) => (
                  <li
                    key={task.id}
                    className={
                      task.changed
                        ? "rounded-md border border-emerald-300 bg-emerald-50 p-2"
                        : "rounded-md border border-slate-200 bg-slate-50 p-2"
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {task.title}
                      </span>
                      {task.changed && (
                        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
                          Updated
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{task.detail}</p>
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
  memberName: name,
  onSubmit,
}: {
  memberName: string;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState(DEFAULT_ISSUE_TEXT);
  const trimmed = text.trim();

  return (
    <form
      className="rounded-lg border border-slate-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) onSubmit(trimmed);
      }}
    >
      <label
        htmlFor="issue-text"
        className="text-sm font-semibold text-slate-900"
      >
        {name}, is something not working in your team?
      </label>
      <p className="mt-1 text-xs text-slate-600">
        The AI facilitator treats this as your perspective, not as a fact about
        your teammates.
      </p>
      <textarea
        id="issue-text"
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="mt-3 w-full rounded-md border border-slate-300 p-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
      <button
        type="submit"
        disabled={!trimmed}
        className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Raise issue with the team
      </button>
    </form>
  );
}

function SharedSummary({ proposal }: { proposal: Proposal }) {
  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm text-slate-800">{proposal.teamSummary}</p>
      <p className="mt-2 text-sm text-slate-800">{SUPPORT_STATUS_LINE}</p>
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
      className="rounded-lg border border-violet-200 bg-white p-4"
    >
      <h2 id="support-heading" className="text-sm font-semibold text-slate-900">
        {requested
          ? "Support requested"
          : "Stuck? Ask your teacher for support"}
      </h2>
      <p className="mt-1 text-xs text-slate-600">
        {requested
          ? "Your teacher sees only this summary. No names, no quotes, no private messages."
          : "This is everything your teacher will see. No names, no quotes, no private messages."}
      </p>
      <SharedSummary proposal={proposal} />
      {!requested && (
        <button
          type="button"
          onClick={onRequest}
          className="mt-3 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          Share this and ask for support
        </button>
      )}
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
      <main className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Teacher view</h2>
        <p className="mt-2 text-sm text-slate-600">No team needs support.</p>
        <p className="mt-1 text-xs text-slate-500">
          You only see what a team chooses to share. Private conversations are
          never shown here.
        </p>
      </main>
    );
  }

  return (
    <main className="rounded-lg border border-violet-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Teacher view</h2>
      <p className="mt-1 text-xs text-slate-500">
        You only see what a team chooses to share. Private conversations are
        never shown here.
      </p>

      <h3 className="mt-5 text-sm font-semibold text-slate-900">
        {TEAM_NAME} asked for support
      </h3>
      <SharedSummary proposal={proposal} />

      {proposal.status === "applied" && (
        <p className="mt-3 text-sm font-medium text-emerald-800">
          Update: the team has since reached an agreement.
        </p>
      )}

      {state.teacherGuidance ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Sent to the team
          </h3>
          <p className="mt-2 rounded-md border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
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
          <h3 className="text-sm font-semibold text-slate-900">
            Send one piece of guidance
          </h3>
          <p className="mt-1 text-xs text-slate-600">
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
                      ? "w-full rounded-md border-2 border-violet-500 bg-violet-50 p-3 text-left text-sm text-slate-900"
                      : "w-full rounded-md border border-slate-200 bg-white p-3 text-left text-sm text-slate-800 hover:bg-slate-50"
                  }
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
          <label
            htmlFor="guidance-draft"
            className="mt-4 block text-sm font-medium text-slate-900"
          >
            Message to the team
          </label>
          <textarea
            id="guidance-draft"
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Pick a suggestion above or write your own."
            className="mt-2 w-full rounded-md border border-slate-300 p-2 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="mt-3 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Send to the team
          </button>
        </form>
      )}
    </main>
  );
}

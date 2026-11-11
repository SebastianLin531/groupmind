"use client";

import { useEffect, useReducer, useState } from "react";
import {
  DEFAULT_ISSUE_TEXT,
  MEMBERS,
  ROLE_LABELS,
  STORAGE_KEY,
  createInitialState,
  memberName,
  reducer,
} from "@/lib/state";
import type { AppState, MemberId, RoleId, Task } from "@/lib/types";

const ROLE_ORDER: RoleId[] = ["alex", "bella", "chris", "dana", "teacher"];

export default function Workspace() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const [hydrated, setHydrated] = useState(false);

  // Load saved state once in the browser, then keep it saved.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) dispatch({ type: "hydrate", state: JSON.parse(saved) as AppState });
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

  const isTeacher = state.currentRole === "teacher";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">GroupMind</h1>
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
          Demo mode: one browser simulates 4 students and 1 teacher. All data is mock data.
        </p>
        <RoleSwitcher
          current={state.currentRole}
          onSwitch={(role) => dispatch({ type: "switch_role", role })}
        />
      </header>

      {isTeacher ? (
        <TeacherView />
      ) : (
        <TeamView
          state={state}
          currentMember={state.currentRole as MemberId}
          onRaiseIssue={(text) =>
            dispatch({
              type: "raise_issue",
              raisedBy: state.currentRole as MemberId,
              text,
            })
          }
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
  onRaiseIssue,
}: {
  state: AppState;
  currentMember: MemberId;
  onRaiseIssue: (text: string) => void;
}) {
  return (
    <main className="flex flex-col gap-6">
      <TaskBoard tasks={state.tasks} currentMember={currentMember} />
      {state.issue ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Issue raised by {memberName(state.issue.raisedBy)}
          </h2>
          <p className="mt-2 text-sm text-slate-700">&ldquo;{state.issue.text}&rdquo;</p>
        </section>
      ) : (
        <IssueForm memberName={memberName(currentMember)} onSubmit={onRaiseIssue} />
      )}
    </main>
  );
}

function TaskBoard({ tasks, currentMember }: { tasks: Task[]; currentMember: MemberId }) {
  return (
    <section aria-labelledby="board-heading">
      <h2 id="board-heading" className="mb-3 text-lg font-semibold text-slate-900">
        Team task board
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MEMBERS.map((member) => {
          const memberTasks = tasks.filter((task) => task.ownerId === member.id);
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
                <span className="font-semibold text-slate-900">{member.name}</span>
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
                      <span className="text-sm font-medium text-slate-900">{task.title}</span>
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
      <label htmlFor="issue-text" className="text-sm font-semibold text-slate-900">
        {name}, is something not working in your team?
      </label>
      <p className="mt-1 text-xs text-slate-600">
        The AI facilitator treats this as your perspective, not as a fact about your teammates.
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

function TeacherView() {
  return (
    <main className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Teacher view</h2>
      <p className="mt-2 text-sm text-slate-600">No team needs support.</p>
      <p className="mt-1 text-xs text-slate-500">
        You only see what a team chooses to share. Private conversations are never shown here.
      </p>
    </main>
  );
}

"use client";

import { useState } from "react";
import {
  ALGORITHM_VERSION,
  CLASS_STUDENTS,
  FORMATION_SEED,
  SAMPLE_SUGGESTIONS,
  getStrategy,
} from "@/lib/formation";
import type { StrategyId, StrategySuggestion } from "@/lib/formation";
import { COURSE_CONTEXT, contextLabel } from "@/lib/state";
import type { Action } from "@/lib/state";
import type { SetupState } from "@/lib/types";

const STEPS = ["Create course", "Grouping options", "Student survey", "Teams"];
const STEP_OF_STAGE: Record<SetupState["stage"], number> = {
  brief: 0,
  options: 1,
  survey: 2,
  grouped: 3,
  published: 3,
};

const studentName = (id: string) =>
  CLASS_STUDENTS.find((student) => student.id === id)?.name ?? id;

export function CourseGoals({ stacked }: { stacked?: boolean }) {
  return (
    <div className={stacked ? "grid gap-3" : "grid gap-4 sm:grid-cols-2"}>
      <div>
        <h4 className="eyebrow">Learning goals</h4>
        <ul className="mt-1 flex flex-col gap-1">
          {COURSE_CONTEXT.learningGoals.map((goal) => (
            <li key={goal.id} className="text-[13px] leading-snug text-ink-2">
              <span className="font-semibold text-ink">
                {contextLabel(goal.id)}:
              </span>{" "}
              {goal.text}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="eyebrow">Collaboration rules</h4>
        <ul className="mt-1 flex flex-col gap-1">
          {COURSE_CONTEXT.collaborationRules.map((rule) => (
            <li key={rule.id} className="text-[13px] leading-snug text-ink-2">
              <span className="font-semibold text-ink">
                {contextLabel(rule.id)}:
              </span>{" "}
              {rule.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StepCheck() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </svg>
  );
}

/** A small labelled meter so team numbers can be compared at a glance. */
function Meter({ value, max }: { value: number; max: number }) {
  const percent = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <span
      aria-hidden="true"
      className="col-span-2 -mt-0.5 mb-1 block h-1.5 overflow-hidden rounded-full bg-line"
    >
      <span
        className="block h-full rounded-full bg-ink-2"
        style={{ width: `${percent}%` }}
      />
    </span>
  );
}

export default function CourseSetup({
  setup,
  dispatch,
}: {
  setup: SetupState;
  dispatch: (action: Action) => void;
}) {
  const [syllabus, setSyllabus] = useState(setup.syllabus);
  const [courseName, setCourseName] = useState("Entrepreneurship Practice");
  const [loading, setLoading] = useState(false);
  const step = STEP_OF_STAGE[setup.stage];
  const strategy = setup.strategyId ? getStrategy(setup.strategyId) : null;

  async function requestOptions() {
    setLoading(true);
    let suggestions: StrategySuggestion[] = SAMPLE_SUGGESTIONS;
    let isSample = true;
    try {
      const response = await fetch("/api/strategies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          syllabus,
          learningGoals: COURSE_CONTEXT.learningGoals.map((goal) => goal.text),
        }),
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const data = (await response.json()) as {
        suggestions: StrategySuggestion[];
        isSample: boolean;
      };
      suggestions = data.suggestions;
      isSample = data.isSample;
    } catch {
      // Keep the labeled sample suggestions.
    } finally {
      setLoading(false);
    }
    dispatch({ type: "set_suggestions", syllabus, suggestions, isSample });
  }

  return (
    <section aria-labelledby="setup-heading" className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="setup-heading"
          className="text-lg font-bold tracking-tight text-ink"
        >
          Course setup
        </h2>
        <p className="text-xs font-semibold tabular-nums text-muted">
          Step {step + 1} of {STEPS.length}
          {setup.stage === "published" && " · published"}
        </p>
      </div>
      <ol className="mt-4 grid grid-cols-4">
        {STEPS.map((label, index) => {
          const done =
            index < step || (index === step && setup.stage === "published");
          const current = index === step && !done;
          return (
            <li
              key={label}
              aria-current={index === step ? "step" : undefined}
              className="relative flex flex-col items-center gap-1.5 px-1 text-center"
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-4 -z-0 mr-4 h-0.5 w-[calc(100%-2rem)] ${
                    index <= step ? "bg-ink" : "bg-line"
                  }`}
                />
              )}
              <span
                aria-hidden="true"
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums ${
                  done
                    ? "border-ink bg-ink text-white"
                    : current
                      ? "border-ink bg-surface text-ink ring-4 ring-line"
                      : "border-line-strong bg-surface text-muted"
                }`}
              >
                {done ? <StepCheck /> : index + 1}
              </span>
              <span
                className={`text-[11px] leading-tight sm:text-[13px] ${
                  current
                    ? "font-bold text-ink"
                    : done
                      ? "font-semibold text-ink-2"
                      : "font-medium text-muted"
                }`}
              >
                <span className="sr-only">
                  {index + 1}. {done ? "Done: " : ""}
                </span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {setup.stage === "brief" && (
        <div className="mt-6 flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div>
              <label
                htmlFor="course-name"
                className="text-sm font-semibold text-ink"
              >
                Course name
              </label>
              <input
                id="course-name"
                type="text"
                value={courseName}
                onChange={(event) => setCourseName(event.target.value)}
                className="field mt-2"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Class</p>
              <p className="mt-2 rounded-inner border border-line bg-sunken px-3 py-2.5 text-[15px] leading-snug text-ink-2">
                12 students, teams of 4 (simulated roster)
              </p>
            </div>
          </div>
          <div>
            <label htmlFor="syllabus" className="text-sm font-semibold text-ink">
              Course syllabus and requirements
            </label>
            <p className="mt-1 text-xs leading-snug text-muted">
              Sample course text. In a real course the teacher pastes or uploads
              the syllabus.
            </p>
            <textarea
              id="syllabus"
              rows={7}
              value={syllabus}
              onChange={(event) => setSyllabus(event.target.value)}
              className="field mt-2 text-sm"
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">
              What students should learn, and how they should work together
            </h3>
            <p className="mt-1 text-xs leading-snug text-muted">
              These travel with every team into its negotiations later.
            </p>
            <div className="mt-2 rounded-inner border border-line bg-sunken p-4">
              <CourseGoals />
            </div>
          </div>
          <div>
            <button
              type="button"
              disabled={loading || !syllabus.trim()}
              aria-busy={loading}
              onClick={() => void requestOptions()}
              className="btn btn-primary w-full sm:w-auto"
            >
              {loading ? "Reading the syllabus..." : "Show grouping options"}
            </button>
          </div>
        </div>
      )}

      {setup.stage === "options" && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-ink">
              Grouping options for this course
            </h3>
            {setup.suggestionsAreSample && (
              <span className="chip chip-note">
                Sample suggestions (not generated live)
              </span>
            )}
          </div>
          <p className="mt-1 max-w-3xl text-[13px] leading-snug text-muted">
            The AI lists options and their costs. It does not pick one, and it
            never places a student in a team. Based on published research. Not a
            guarantee.
          </p>
          <ul className="mt-4 grid gap-3 lg:grid-cols-3">
            {setup.suggestions.map((suggestion, index) => {
              const option = getStrategy(suggestion.strategyId);
              return (
                <li
                  key={option.id}
                  className="flex flex-col rounded-card border border-line bg-surface p-4 shadow-card"
                >
                  <p className="eyebrow">Option {index + 1}</p>
                  <h4 className="mt-0.5 text-base font-bold leading-snug text-ink">
                    {option.name}
                  </h4>
                  <div className="mt-3 flex flex-1 flex-col gap-2.5 text-[13px] leading-snug">
                    <p className="text-ink-2">
                      <span className="eyebrow block">Rule:</span> {option.rule}
                    </p>
                    <p className="rounded-inner border border-ok-line bg-ok-soft px-2.5 py-2 text-ink">
                      <span className="eyebrow block text-ok-strong">Fit:</span>{" "}
                      {suggestion.fit}
                    </p>
                    <p className="rounded-inner border border-no-line bg-no-soft px-2.5 py-2 text-ink">
                      <span className="eyebrow block text-no-strong">
                        Trade-off:
                      </span>{" "}
                      {suggestion.tradeoff}
                    </p>
                    <p className="text-xs text-muted">
                      <span className="eyebrow block">Evidence:</span>{" "}
                      {option.evidence}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "choose_strategy",
                        strategyId: option.id as StrategyId,
                      })
                    }
                    className="btn btn-primary mt-4 w-full"
                  >
                    Choose {option.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {setup.stage === "survey" && strategy && (
        <div className="mt-6">
          <h3 className="text-base font-bold text-ink">
            Survey for &ldquo;{strategy.name}&rdquo;
          </h3>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            Students are asked only what this strategy needs. Nothing else is
            collected.
          </p>
          <ol className="mt-3 flex flex-col gap-2">
            {strategy.surveyQuestions.map((question, index) => (
              <li
                key={question}
                className="flex gap-3 rounded-inner border border-line bg-sunken px-3 py-2.5 text-sm leading-snug text-ink"
              >
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold tabular-nums text-white"
                >
                  {index + 1}
                </span>
                {question}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "load_survey_responses" })}
              className="btn btn-primary w-full sm:w-auto"
            >
              Load 12 simulated responses and form teams
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "back_to_options" })}
              className="btn btn-ghost w-full sm:w-auto"
            >
              Back to options
            </button>
          </div>
          <p className="mt-3 rounded-inner border border-note-line bg-note-soft px-3 py-2 text-xs font-medium leading-snug text-note">
            Simulated: no survey is sent in this demo. The 12 responses are mock
            data.
          </p>
        </div>
      )}

      {(setup.stage === "grouped" || setup.stage === "published") &&
        strategy && (
          <div className="mt-6">
            <h3 className="text-base font-bold text-ink">
              Teams formed by &ldquo;{strategy.name}&rdquo;
            </h3>
            <p className="mt-1 max-w-3xl text-[13px] leading-snug text-muted">
              Rule: {strategy.rule} Every team also needs at least 2 shared time
              slots (practical constraint).
            </p>
            <ul className="mt-4 grid gap-3 lg:grid-cols-3">
              {setup.groups.map((group) => (
                <li
                  key={group.name}
                  className="rounded-card border border-line bg-surface p-4 shadow-card"
                >
                  <h4 className="text-base font-bold text-ink">{group.name}</h4>
                  <p className="mt-1 text-sm leading-snug text-ink-2">
                    {group.memberIds.map(studentName).join(", ")}
                  </p>
                  <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-ink-2">
                    <dt>Different skills</dt>
                    <dd className="font-bold tabular-nums text-ink">
                      {group.metrics.distinctSkills} of 4
                    </dd>
                    <Meter value={group.metrics.distinctSkills} max={4} />
                    <dt>Experience, average (spread)</dt>
                    <dd className="font-bold tabular-nums text-ink">
                      {group.metrics.experienceMean.toFixed(1)} (
                      {group.metrics.experienceRange})
                    </dd>
                    <dt>Shared time slots</dt>
                    <dd className="font-bold tabular-nums text-ink">
                      {group.metrics.commonSlots} of 6
                    </dd>
                    <Meter value={group.metrics.commonSlots} max={6} />
                    {strategy.id === "personality_balanced" && (
                      <>
                        <dt>Extraversion, team average</dt>
                        <dd className="font-bold tabular-nums text-ink">
                          {group.metrics.extraversionMean.toFixed(1)}
                        </dd>
                      </>
                    )}
                  </dl>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-snug text-muted">
              Formed by a fixed algorithm, not by the AI. Strategy:{" "}
              {strategy.id}. Seed: {FORMATION_SEED}. Algorithm:{" "}
              {ALGORITHM_VERSION}. Team-level numbers only: no individual scores
              are shown.
            </p>

            {setup.stage === "grouped" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "publish_groups" })}
                  className="btn btn-primary w-full sm:w-auto"
                >
                  Confirm and publish teams
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "back_to_options" })}
                  className="btn btn-ghost w-full sm:w-auto"
                >
                  Try another strategy
                </button>
              </div>
            ) : (
              <p
                role="status"
                className="mt-4 flex items-start gap-2 rounded-inner border border-ok-line bg-ok-soft p-3 text-sm leading-snug text-ok-strong"
              >
                <span className="mt-0.5 shrink-0">
                  <StepCheck />
                </span>
                <span>
                  Teams are published. Your goals and rules now travel with each
                  team. The student views continue with one fixed sample team
                  (Alex, Bella, Chris, Dana). It is not one of the teams above.
                </span>
              </p>
            )}
          </div>
        )}
    </section>
  );
}

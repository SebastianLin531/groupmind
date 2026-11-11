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

const STEPS = ["Course brief", "Grouping options", "Student survey", "Teams"];
const STEP_OF_STAGE: Record<SetupState["stage"], number> = {
  brief: 0,
  options: 1,
  survey: 2,
  grouped: 3,
  published: 3,
};

const studentName = (id: string) =>
  CLASS_STUDENTS.find((student) => student.id === id)?.name ?? id;

export function CourseGoals() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Learning goals
        </h4>
        <ul className="mt-1 flex flex-col gap-1">
          {COURSE_CONTEXT.learningGoals.map((goal) => (
            <li key={goal.id} className="text-sm text-slate-800">
              <span className="font-medium">{contextLabel(goal.id)}:</span>{" "}
              {goal.text}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Collaboration rules
        </h4>
        <ul className="mt-1 flex flex-col gap-1">
          {COURSE_CONTEXT.collaborationRules.map((rule) => (
            <li key={rule.id} className="text-sm text-slate-800">
              <span className="font-medium">{contextLabel(rule.id)}:</span>{" "}
              {rule.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
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
    <section
      aria-labelledby="setup-heading"
      className="rounded-lg border border-slate-200 bg-white p-6"
    >
      <h2 id="setup-heading" className="text-lg font-semibold text-slate-900">
        Course setup
      </h2>
      <ol className="mt-3 flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={
              index === step
                ? "rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white"
                : index < step
                  ? "rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800"
                  : "rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500"
            }
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {setup.stage === "brief" && (
        <div className="mt-5 flex flex-col gap-4">
          <div>
            <label
              htmlFor="syllabus"
              className="text-sm font-semibold text-slate-900"
            >
              Course syllabus and requirements
            </label>
            <p className="mt-1 text-xs text-slate-600">
              Sample course text. In a real course the teacher pastes or uploads
              the syllabus.
            </p>
            <textarea
              id="syllabus"
              rows={7}
              value={syllabus}
              onChange={(event) => setSyllabus(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 p-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              What students should learn, and how they should work together
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              These travel with every team into its negotiations later.
            </p>
            <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <CourseGoals />
            </div>
          </div>
          <div>
            <button
              type="button"
              disabled={loading || !syllabus.trim()}
              onClick={() => void requestOptions()}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? "Reading the syllabus..." : "Show grouping options"}
            </button>
          </div>
        </div>
      )}

      {setup.stage === "options" && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Grouping options for this course
            </h3>
            {setup.suggestionsAreSample && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                Sample suggestions (not generated live)
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-600">
            The AI lists options and their costs. It does not pick one, and it
            never places a student in a team. Based on published research. Not a
            guarantee.
          </p>
          <ul className="mt-3 grid gap-3 lg:grid-cols-3">
            {setup.suggestions.map((suggestion) => {
              const option = getStrategy(suggestion.strategyId);
              return (
                <li
                  key={option.id}
                  className="flex flex-col rounded-md border border-slate-200 bg-slate-50 p-3"
                >
                  <h4 className="text-sm font-semibold text-slate-900">
                    {option.name}
                  </h4>
                  <p className="mt-2 text-xs text-slate-700">
                    <span className="font-semibold">Rule:</span> {option.rule}
                  </p>
                  <p className="mt-2 text-xs text-slate-700">
                    <span className="font-semibold">Fit:</span> {suggestion.fit}
                  </p>
                  <p className="mt-2 text-xs text-slate-700">
                    <span className="font-semibold">Trade-off:</span>{" "}
                    {suggestion.tradeoff}
                  </p>
                  <p className="mt-2 text-xs text-slate-600">
                    <span className="font-semibold">Evidence:</span>{" "}
                    {option.evidence}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "choose_strategy",
                        strategyId: option.id as StrategyId,
                      })
                    }
                    className="mt-3 self-start rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
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
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Survey for &ldquo;{strategy.name}&rdquo;
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Students are asked only what this strategy needs. Nothing else is
            collected.
          </p>
          <ol className="mt-3 flex list-decimal flex-col gap-1 pl-5">
            {strategy.surveyQuestions.map((question) => (
              <li key={question} className="text-sm text-slate-800">
                {question}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "load_survey_responses" })}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Load 12 simulated responses and form teams
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "back_to_options" })}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to options
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Simulated: no survey is sent in this demo. The 12 responses are mock
            data.
          </p>
        </div>
      )}

      {(setup.stage === "grouped" || setup.stage === "published") &&
        strategy && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Teams formed by &ldquo;{strategy.name}&rdquo;
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Rule: {strategy.rule} Every team also needs at least 2 shared time
              slots (practical constraint).
            </p>
            <ul className="mt-3 grid gap-3 lg:grid-cols-3">
              {setup.groups.map((group) => (
                <li
                  key={group.name}
                  className="rounded-md border border-slate-200 bg-slate-50 p-3"
                >
                  <h4 className="text-sm font-semibold text-slate-900">
                    {group.name}
                  </h4>
                  <p className="mt-1 text-sm text-slate-800">
                    {group.memberIds.map(studentName).join(", ")}
                  </p>
                  <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs text-slate-700">
                    <dt>Different skills</dt>
                    <dd className="font-semibold tabular-nums">
                      {group.metrics.distinctSkills} of 4
                    </dd>
                    <dt>Experience, average (spread)</dt>
                    <dd className="font-semibold tabular-nums">
                      {group.metrics.experienceMean.toFixed(1)} (
                      {group.metrics.experienceRange})
                    </dd>
                    <dt>Shared time slots</dt>
                    <dd className="font-semibold tabular-nums">
                      {group.metrics.commonSlots} of 6
                    </dd>
                    {strategy.id === "personality_balanced" && (
                      <>
                        <dt>Extraversion, team average</dt>
                        <dd className="font-semibold tabular-nums">
                          {group.metrics.extraversionMean.toFixed(1)}
                        </dd>
                      </>
                    )}
                  </dl>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
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
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Confirm and publish teams
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "back_to_options" })}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Try another strategy
                </button>
              </div>
            ) : (
              <p
                role="status"
                className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
              >
                Teams are published. Your goals and rules now travel with each
                team. The student views continue with one fixed sample team
                (Alex, Bella, Chris, Dana). It is not one of the teams above.
              </p>
            )}
          </div>
        )}
    </section>
  );
}

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  AiProposalSchema,
  ProposalRequestSchema,
  buildProposal,
  buildSampleProposal,
} from "@/lib/proposal";
import { MEMBERS, memberName } from "@/lib/state";

// Allow the model call to finish on Vercel.
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are GroupMind, a facilitator for a university student team working on a group project.

One student has raised a concern about how the team works together. Your job is to help the team negotiate. It is not to decide for them and not to judge anyone.

How to work:
- You have heard from one person only. Write perspectiveSummary as that student's perspective ("From Chris's perspective, ..."), never as an established fact, and say that the other members have not shared their view yet.
- Never judge the quality of any member's work, effort, or character. Describe situations and processes, not people.
- Prefer process changes first: a shared hand-off format, clearer definitions of done, earlier drafts, clearer scope for a task. Move ownership of a task only when a process change cannot address the concern.
- A change to one task must not create new work for anyone except that task's owner, because only the owner of a changed task is asked for consent. If your idea means another member takes on something new (for example, fixing items flagged in their own section), write that as its own change to that member's task, so they get to consent or decline. Never describe new work for teammates only inside a reason.
- When the concern is about work that arrives from teammates, changing only the task of the person who raised it leaves the cause untouched. In a first proposal, include at least one teammate's task where that honestly addresses the concern, so the team has something real to negotiate.
- Propose 1 to 3 changes. Each change edits one existing task, referenced by its exact taskId. Use newDetail to redefine what the task covers, newTitle to rename it, newOwnerId to move it. Set the fields you do not change to null.
- Do not solve the concern by quietly adding work to someone. When a change adds work for a member, say so plainly in reason, because that member must consent before anything changes.
- reason is one plain sentence, at most two, that every teammate can read without feeling accused. It talks only about this one change and its owner. Do not suggest that other members or other sections could adopt the same change later: teammates read that as their own work changing too, and it is not part of this proposal.
- newDetail is at most 30 words. The whole proposal has to fit on one screen next to the task board.
- teamSummary is for the course teacher. Write two sentences at team level about what the team is working through. It must not contain any student's name and must not reveal who raised the concern.
- teacherPromptOptions is exactly 3 short messages the teacher could send to the whole team, each a different kind of support: (1) a reflective question, (2) a clarification of expectations the team could agree on, (3) a short structured activity. They help the team work it out themselves. They do not name students and do not give the answer.


Revising a proposal:
- The input may include revisionRequest: the changes you proposed before, how each affected member answered, and sometimes a message the teacher sent to the team. In that case at least one member declined, and you write one revised proposal. If there is no revisionRequest, this is a first proposal and revisionNote is null.
- A decline reason is that member's own account of their situation. Take it as a real constraint and design around it. Do not argue with it, do not treat it as a fact about anyone else, and do not treat any member's statement as established fact.
- Do not answer a decline by moving the same work onto a different member. Nobody has agreed to take on anything, and you never agree to new work on someone's behalf. Make the change smaller, later, lighter, or shared in a way each owner can accept, or drop the part that was declined.
- Keep what members already consented to where you can, but everyone affected will decide again from scratch.
- perspectiveSummary now covers the perspectives heard so far, each attributed to its person: the member who raised the concern and each member who gave a reason.
- If the teacher sent a message, let it shape the revision.
- revisionNote is one sentence, for the whole team, saying what is different from the previous proposal and why. Name the difference concretely.

The teacher's course design:
- The input may include teacherLearningGoals and teacherCollaborationRules, each with an id. The teacher set these before the project started, and they are the reason this team exists. A proposal must not work against a learning goal. For example, if a goal says every member should understand the financial model, do not hand all financial work to one person.
- For each change, list in groundedIn the ids of the goals or rules that the change serves. Use only ids that appear in the input. If a change rests on none of them, or the lists are empty, return an empty array. Do not stretch to cite one.
- When goals or rules are present, teamSummary also says which goal or rule the team is finding hard to meet, by its text, still without naming any student.

Write in plain, warm, direct English. Keep every field short.`;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ProposalRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const { issue, tasks, courseContext, revision } = parsed.data;
  const raisedByName = memberName(issue.raisedBy);

  const sampleResponse = (reason: string) => {
    // A revision is never replaced by the sample: the team keeps its original proposal.
    if (revision) {
      console.warn(`[proposal] revision failed: ${reason}`);
      return Response.json(
        {
          error:
            "The facilitator could not revise the proposal. Your original proposal is unchanged.",
        },
        { status: 502 },
      );
    }
    console.warn(`[proposal] using sample proposal: ${reason}`);
    return Response.json({
      proposal: buildSampleProposal(tasks, raisedByName, courseContext),
    });
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return sampleResponse("ANTHROPIC_API_KEY is not set");
  }

  const teamContext = {
    members: MEMBERS.map((member) => ({ id: member.id, name: member.name })),
    tasks,
    concern: { raisedBy: raisedByName, text: issue.text },
    // Set by the teacher before the project started. Absent when no course is set up.
    teacherLearningGoals: courseContext?.learningGoals ?? [],
    teacherCollaborationRules: courseContext?.collaborationRules ?? [],
    ...(revision
      ? {
          revisionRequest: {
            previousProposalChanges: revision.previousChanges,
            responsesFromAffectedMembers: revision.responses.map(
              (response) => ({
                member: memberName(response.memberId),
                decision: response.decision,
                reasonInTheirWords: response.reason ?? null,
              }),
            ),
            messageFromTeacherToTeam: revision.teacherGuidance ?? null,
          },
        }
      : {}),
  };

  try {
    const client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${
            revision
              ? "The team could not agree on the first proposal and asks you to revise it once. Here is the team, its current task board, the original concern, and the revision request."
              : "Here is the team, its current task board, and the concern that was raised."
          }\n\n${JSON.stringify(teamContext, null, 2)}`,
        },
      ],
      output_config: {
        effort: "low",
        format: betaZodOutputFormat(AiProposalSchema),
      },
    });

    if (response.stop_reason === "refusal")
      return sampleResponse("model declined");
    if (!response.parsed_output)
      return sampleResponse(`no parsed output (${response.stop_reason})`);

    const proposal = buildProposal(
      response.parsed_output,
      tasks,
      false,
      courseContext,
    );
    if (!proposal) return sampleResponse("model output had no valid changes");

    if (revision) {
      proposal.isRevised = true;
      proposal.revisionNote =
        response.parsed_output.revisionNote?.trim() ||
        "The proposal was revised after a team member could not agree to the first version.";
    }

    return Response.json({ proposal });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      return sampleResponse("authentication failed");
    if (error instanceof Anthropic.RateLimitError)
      return sampleResponse("rate limited");
    if (error instanceof Anthropic.APIConnectionError)
      return sampleResponse("connection error or timeout");
    if (error instanceof Anthropic.APIError)
      return sampleResponse(`API error ${error.status}`);
    return sampleResponse(
      error instanceof Error ? error.message : "unknown error",
    );
  }
}

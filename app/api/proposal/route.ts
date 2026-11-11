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
- Propose 1 to 2 changes. Each change edits one existing task, referenced by its exact taskId. Use newDetail to redefine what the task covers, newTitle to rename it, newOwnerId to move it. Set the fields you do not change to null.
- Do not solve the concern by quietly adding work to someone. When a change adds work for a member, say so plainly in reason, because that member must consent before anything changes.
- reason is one plain sentence, at most two, that every teammate can read without feeling accused. It talks only about this one change and its owner. Do not suggest that other members or other sections could adopt the same change later: teammates read that as their own work changing too, and it is not part of this proposal.
- newDetail is at most 30 words. The whole proposal has to fit on one screen next to the task board.
- teamSummary is for the course teacher. Write two sentences at team level about what the team is working through. It must not contain any student's name and must not reveal who raised the concern.
- teacherPromptOptions is exactly 3 short messages the teacher could send to the whole team, each a different kind of support: (1) a reflective question, (2) a clarification of expectations the team could agree on, (3) a short structured activity. They help the team work it out themselves. They do not name students and do not give the answer.

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
  const { issue, tasks } = parsed.data;
  const raisedByName = memberName(issue.raisedBy);

  const sampleResponse = (reason: string) => {
    console.warn(`[proposal] using sample proposal: ${reason}`);
    return Response.json({ proposal: buildSampleProposal(tasks, raisedByName) });
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return sampleResponse("ANTHROPIC_API_KEY is not set");
  }

  const teamContext = {
    members: MEMBERS.map((member) => ({ id: member.id, name: member.name })),
    tasks,
    concern: { raisedBy: raisedByName, text: issue.text },
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
          content: `Here is the team, its current task board, and the concern that was raised.\n\n${JSON.stringify(teamContext, null, 2)}`,
        },
      ],
      output_config: {
        effort: "low",
        format: betaZodOutputFormat(AiProposalSchema),
      },
    });

    if (response.stop_reason === "refusal") return sampleResponse("model declined");
    if (!response.parsed_output) return sampleResponse(`no parsed output (${response.stop_reason})`);

    const proposal = buildProposal(response.parsed_output, tasks, false);
    if (!proposal) return sampleResponse("model output had no valid changes");

    return Response.json({ proposal });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return sampleResponse("authentication failed");
    if (error instanceof Anthropic.RateLimitError) return sampleResponse("rate limited");
    if (error instanceof Anthropic.APIConnectionError) return sampleResponse("connection error or timeout");
    if (error instanceof Anthropic.APIError) return sampleResponse(`API error ${error.status}`);
    return sampleResponse(error instanceof Error ? error.message : "unknown error");
  }
}

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  AiStrategySchema,
  SAMPLE_SUGGESTIONS,
  STRATEGIES,
  StrategyRequestSchema,
  buildSuggestions,
} from "@/lib/formation";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You help a university teacher think through how to form student teams for a course. The teacher makes the decision. You lay out options.

You receive the course syllabus, the teacher's learning goals, and a fixed list of grouping strategies. Each strategy has an id, the exact rule an algorithm would optimize, and a note on how strong the research evidence is.

How to work:
- Offer 2 or 3 strategies from the list, by id. Use only ids from the list.
- Do not rank them and do not recommend one. The teacher knows the class and chooses. Present each as a real option with a real cost.
- fit: one sentence on why this strategy could suit this specific course, tied to something in the syllabus or goals.
- tradeoff: one sentence on what the teacher gives up or risks by choosing it.
- Be honest about evidence. If the note says the evidence is mixed or untested, do not write as if the strategy is known to work. Do not invent research findings or cite studies.
- You never assign students to teams and you never comment on individual students. An algorithm forms the teams after the teacher chooses.

Write in plain, direct English.`;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = StrategyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const sampleResponse = (reason: string) => {
    console.warn(`[strategies] using sample suggestions: ${reason}`);
    return Response.json({ suggestions: SAMPLE_SUGGESTIONS, isSample: true });
  };

  if (!process.env.ANTHROPIC_API_KEY)
    return sampleResponse("ANTHROPIC_API_KEY is not set");

  const input = {
    syllabus: parsed.data.syllabus,
    learningGoals: parsed.data.learningGoals,
    strategies: STRATEGIES.map(({ id, name, rule, evidence }) => ({
      id,
      name,
      rule,
      evidence,
    })),
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
          content: `Here is the course, the teacher's learning goals, and the available grouping strategies.\n\n${JSON.stringify(input, null, 2)}`,
        },
      ],
      output_config: {
        effort: "low",
        format: betaZodOutputFormat(AiStrategySchema),
      },
    });

    if (response.stop_reason === "refusal")
      return sampleResponse("model declined");
    if (!response.parsed_output)
      return sampleResponse(`no parsed output (${response.stop_reason})`);

    const suggestions = buildSuggestions(response.parsed_output);
    if (!suggestions) return sampleResponse("fewer than two valid strategies");

    return Response.json({ suggestions, isSample: false });
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

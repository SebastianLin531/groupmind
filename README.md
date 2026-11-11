# GroupMind

**An AI-powered collaborative learning platform.**

> AI should help students learn how to collaborate, not just help them finish assignments.

Built at **c0mpiled-18: YC Startup School Hackathon, Taipei Edition** (11 November 2026).

- Live demo: https://groupmind-tau.vercel.app
- Demo video: https://youtu.be/lsknEaDCyQE
- YC RFS track: **Multiplayer AI**

## Why

Generative AI can now do much of the knowledge work in a group assignment. So the point of group work is no longer splitting up the tasks. It is what students learn by working together: saying what they need, understanding each other's limits, negotiating, handling conflict, deciding together, and reflecting on how the team works.

Today that process is invisible to the teacher and hard for students to talk about. One student ends up fixing everyone's work, nobody says anything, and the teacher finds out at the end of the semester.

GroupMind starts in the university classroom. It helps teachers design collaborative learning, and gives students structure for working problems out themselves. The AI is not a judge, a monitor, or a manager who decides for students. It provides collaboration scaffolding.

## Three phases

**Phase 1 · Before class: teacher design and team formation** (built, with simulated data)

The teacher sets learning goals and collaboration rules, gets AI-listed grouping options with trade-offs and evidence strength, chooses one, and a fixed algorithm forms the teams. Grouping is not the innovation. The point is that the teacher's goals and rules become shared context for everything that follows.

**Phase 2 · During the project: AI-supported teamwork** (built, the core of this prototype)

Students share a task board. When something is not working, the AI helps a student raise it as their own perspective, proposes concrete changes grounded in the teacher's goals, asks every affected member to consent or decline, revises once around the reasons given, and helps the team ask the teacher for guidance when it cannot agree.

**Phase 3 · Future: Personal Academic Agent Network** (not built)

Each student has a personal agent for their courses, deadlines, and study plan. With the student's authorization, agents exchange limited information and coordinate time and work across teams. Nothing takes effect without the person's approval. The "My week" panel in this prototype is a static illustration of the kind of private information such an agent would hold. It is not an agent.

## Demo flow

**Teacher**

1. Create the course: name, syllabus, learning goals, collaboration rules.
2. The AI lists two or three grouping strategies. Each shows its exact rule, why it could fit this course, what it costs, and how strong the evidence is. The AI does not recommend one.
3. The teacher chooses. The survey asks students only what that strategy needs.
4. A seeded algorithm, not the AI, forms the teams. The teacher sees team-level numbers and publishes.

**Students**

5. Each student sees their own week: other commitments, and whether their team tasks fit their free hours. This is private to them.
6. Chris raises an issue: he spends too much time fixing other people's work.
7. The AI restates it as one member's perspective, not as fact, and proposes changes to specific tasks. Each change cites the teacher's goal or rule it is based on.
8. Each member whose work would change consents or declines. A decline needs a reason, and the student chooses what to share. There is no majority vote.
9. After a decline, the team can ask the AI to revise the proposal once. The revision is built around the reasons given, says what changed, and clears every earlier answer.
10. If the team cannot agree, it can share a team-level summary with the teacher. The summary contains no names and no quotes. The teacher sends one piece of guidance.
11. When everyone affected consents, the shared task board updates.

## Design principles

1. **Human agency.** The AI suggests. People decide. Nobody's work changes without their own consent, and a majority cannot move work onto one person.
2. **Learning over automation.** The AI structures the discussion. It does not remove it. It revises only once, and then the team or the teacher takes over.
3. **Multiple perspectives.** One student's account is never treated as fact. The AI never judges a member's work, effort, or character.
4. **Teacher in the loop.** The teacher owns the learning goals and steps in when a team asks. The teacher is not shown a team's process otherwise.
5. **Privacy and consent.** The teacher summary has no names and no quotes. A student's week stays with the student. In this prototype these rules are enforced by what the app builds and shows, not by an access-control system.
6. **Structured collaboration.** The model returns structured suggestions. The program validates them, decides who is affected, and controls every state change. The AI never places a student in a team and never agrees to work on someone's behalf.

## What is real and what is simulated

**Real AI, called live (Claude API)**

- Grouping options for the course
- The first proposal from a raised concern
- The revised proposal after a decline
- The teacher's three suggested messages

If a live call fails, the app shows a built-in result labeled "Sample ... (not generated live)". A failed revision keeps the original proposal and shows an error. A sample never stands in for a revision.

**Real program logic**

- Who is affected by a change, and the consent rule
- Validation of everything the model returns, including removing student names from the teacher summary
- The seeded grouping algorithm, which really runs on the 12 simulated students

**Simulated**

- One browser plays one teacher and four students through a role switcher. It is not a multi-device, real-time system. There is no login and no access control.
- All students, tasks, survey answers, and the course are mock data, stored in the browser (`localStorage`).
- No survey is sent. A button loads 12 simulated responses. The syllabus is pasted text, not a file upload. The learning goals and rules are fixed sample text.
- The student views continue with one fixed sample team (Alex, Bella, Chris, Dana), which is not one of the teams the algorithm formed.
- "My week" uses fixed mock commitments and hour estimates. There is no calendar integration, and the hours do not change when a proposal is applied.

## Built tonight / not built

**Built**

- Course creation, AI-listed grouping strategies, seeded team formation
- Teacher goals and rules carried into the student negotiation
- Shared task board, private "My week" panel, team thread
- AI proposal, consent from every affected member, one AI revision, board update
- Teacher support request with a name-free summary, and teacher guidance

**Not built**

- Personal agents, or any agent-to-agent communication. Every AI step here is a single model call.
- Persistent memory, accounts, access control, real-time sync between devices
- Calendar or task-tool integration, cross-course time management
- The teacher editing goals, viewing individual survey answers, or adjusting teams by hand
- Reflection on the team's process after the project
- Course progress tracking

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- Two server routes call the Claude API (`claude-opus-5-5`) with structured output validated by Zod: `app/api/strategies/route.ts` and `app/api/proposal/route.ts`
- Team formation is a seeded swap search in plain TypeScript. No AI is involved in placing students.
- Deployed on Vercel. No database.

| File | What it does |
| --- | --- |
| `lib/types.ts` | Data shapes |
| `lib/state.ts` | Mock data, reducer, consent rule, board update |
| `lib/formation.ts` | Simulated class, grouping strategies, seeded algorithm |
| `lib/proposal.ts` | Proposal schema, validation, sample proposal |
| `app/api/strategies/route.ts` | Grouping-options prompt and Claude API call |
| `app/api/proposal/route.ts` | Facilitator prompt, proposal and revision |
| `components/CourseSetup.tsx` | Course setup and team formation |
| `components/Workspace.tsx` | Student view and teacher view |

## How to run

Requires Node.js 20 or later and an Anthropic API key.

```bash
npm install
echo "ANTHROPIC_API_KEY=your-key-here" > .env.local
npm run dev
```

Open http://localhost:3000. Without a key the app still runs and shows the labeled sample results.

## Known limitations

- No evidence yet that this improves how students collaborate. Students may come to rely on the AI instead of learning to negotiate. This needs testing with real teams and teachers.
- Consent is given in front of teammates, so peer pressure can still shape the answer. A real product needs a private way to respond.
- Any one member can share the team summary with the teacher. A real product needs a team-level rule for this.
- The program checks that a cited goal or rule exists. It cannot check that a proposal truly serves that goal.
- Proposals differ between runs, so the members asked for consent differ too.
- The grouping strategies are simple, and four is not a complete set. The "personality balance" direction is an assumption, not a finding.
- Comparing grouping strategies across courses would need random assignment, a shared outcome measure, and research consent separate from course enrollment. The platform has no such data.
- The research behind this design mostly studied workplace, MBA, and graduate teams in Europe and North America. Whether it transfers to undergraduate teams in Taiwan is untested.

## Design background

The design draws on cooperative learning (Johnson & Johnson: positive interdependence, individual accountability, group processing), scaffolding, formative assessment, and self-regulated learning. The consent-based flow also draws on research on process conflict in teams (Jehn), team charters (Mathieu & Rapp, 2009), the voice effect in procedural justice, and psychological safety (Edmondson, 1999). The grouping strategies carry evidence labels based on Horwitz & Horwitz (2007), Donovan et al. (2018), Wilson et al. (2018), and Bell (2007).

These references were collected during the hackathon. Some were checked at the abstract level only, and some were cited from memory. None were read in full. GroupMind does not claim the validity of any published instrument, including CATME.

## Next steps

- Interview teachers who run group-project courses, then pilot Phase 2 with one real team.
- Let teachers write their own goals and rules, and send the survey to real students.
- Add team reflection after the project.
- Explore personal academic agents only after the classroom flow is shown to help.

## Use of AI tools and external APIs

- Built during the hackathon with Claude Code as the coding assistant.
- Runtime AI: Claude API (`claude-opus-5-5`).
- A GPT browser agent was used for end-to-end QA on the deployed site.
- Product planning (problem analysis, scope, flow) was done before the event. All code was written during the event.

## Team

- [SebastianLin531](https://github.com/SebastianLin531): product, design, development, demo

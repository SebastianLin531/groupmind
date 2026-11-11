# GroupMind

An AI facilitator for student teams, with the teacher in the loop.

Built at **c0mpiled-18: YC Startup School Hackathon, Taipei Edition** (11 November 2026).

- Live demo: https://groupmind-tau.vercel.app
- Demo video: _to be added_
- YC RFS track: **Multiplayer AI**

## Problem

Group projects are supposed to teach collaboration. In practice, the collaboration process is invisible to the teacher and unspeakable for the students. One student ends up fixing everyone's work, nobody says anything, and the teacher finds out at the end of the semester, when nothing can be improved.

## Solution

GroupMind follows a course from setup to teamwork. The teacher sets the learning goals once, and those goals travel with every team: into how teams are formed, into how students negotiate their work, and back to the teacher when a team gets stuck.

- The AI structures the negotiation. It does not decide for the students.
- Students decide. Nobody's work changes without their own consent.
- The teacher steps in only when a team asks, and sees only what the team shares.

## Vision

GroupMind's long-term direction is a collaboration network of personal AI agents. Each person has their own agent for their tasks and time. When people need to work together, their agents exchange a limited, authorized set of information, negotiate, and bring the result back to each person to approve.

Tonight's prototype is one layer of that: **the decision-making layer**. An AI proposes, the people affected consent, and the shared tasks update. The agent network itself is not built.

### Built tonight

- Shared task board with five simulated roles
- AI proposal from a raised concern, with structured output validated by the program
- Consent from every affected member, with a reason required to decline
- One AI revision of a declined proposal, based on the reasons given
- Shared task board update after everyone affected consents
- Teacher support request with a name-free summary, and one piece of teacher guidance
- Course setup: AI-listed grouping strategies and a seeded grouping algorithm on simulated students

### Not built

- Personal AI agents, or any agent-to-agent communication
- Multi-agent orchestration: every AI step here is a single model call
- Persistent memory across sessions
- Real-time sync between devices, accounts, and access control
- Calendar or task-tool integration
- Course progress tracking

## Demo flow

**Before the project: the teacher sets up the course**

1. The teacher provides the syllabus, learning goals, and collaboration rules.
2. The AI lists two or three grouping strategies. Each comes with its exact rule, why it could fit this course, what it costs, and how strong the evidence is. The AI does not recommend one.
3. The teacher chooses. Students are surveyed only for what that strategy needs.
4. A seeded algorithm, not the AI, forms the teams. The teacher sees team-level numbers and publishes.

**During the project: students negotiate, the teacher supports**

5. Chris raises an issue: he spends too much time fixing other people's work.
6. The AI restates it as one member's perspective, not as fact, and proposes changes to specific tasks. Each change cites the teacher's goal or rule it is based on.
7. Each member whose work would change consents or declines. A decline needs a reason. There is no majority vote.
8. After a decline, the team can ask the AI to revise the proposal once. The revision is built around the reasons given, says what changed, and clears every earlier answer, so everyone affected decides again.
9. If everyone affected consents, the shared task board updates.
10. If the team cannot agree, it can share a team-level summary with the teacher. The summary contains no names and no quotes, and says which goal or rule the team is finding hard.
11. The teacher picks or edits one AI-suggested message and sends it. It appears on the team's board.

## Design principles

- **We don't use AI to judge students.** The AI never labels a student, and the program removes any student name from what the teacher sees.
- **Consent over voting.** A majority cannot move work onto one person. The program, not the model, decides who is affected by a change.
- **The AI suggests, people decide.** The model returns structured suggestions. The app validates them and controls every state change.
- **No surveillance.** The teacher view shows nothing about a team's process until the team asks for support.
- **The AI never places a student in a team.** It lists strategies. The teacher chooses. A fixed, repeatable algorithm does the grouping, and the screen shows the strategy, seed, and algorithm version.
- **Evidence is labeled, not implied.** Each grouping strategy shows how strong its research support is, including "to be tested".
- **Honest fallbacks.** If the live AI call fails, the app shows a built-in proposal labeled "Sample proposal (not generated live)". If a revision fails, the original proposal stays and the team sees an error. A sample never stands in for a revision.
- **The AI never agrees on someone's behalf.** A revision does not move declined work onto another member, and anyone who would take on something new is asked for their own consent.

## What is simulated

This is a prototype. Please read the demo with these limits in mind.

- One browser simulates four students and one teacher through a role switcher. It is not a real-time multi-device system.
- There is no login and no access control. The privacy rules are enforced in the UI and in the data the app builds, not by a permission system.
- All students, tasks, survey answers, and the course are mock data. State is stored in the browser (`localStorage`).
- No survey is sent. A button loads 12 simulated responses. The syllabus is pasted text, not a file upload.
- The grouping algorithm really runs on the 12 simulated students. The student views then continue with one fixed sample team (Alex, Bella, Chris, Dana), which is not one of the teams the algorithm formed.
- The learning goals and collaboration rules are fixed sample text in this version.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- Two server routes call the Claude API (`claude-opus-5-5`) with structured output validated by Zod: `app/api/strategies/route.ts` and `app/api/proposal/route.ts`
- Team formation is a seeded swap search in plain TypeScript (`lib/formation.ts`). No AI is involved in placing students.
- Deployed on Vercel. No database.

Key files:

| File | What it does |
| --- | --- |
| `lib/types.ts` | Data shapes |
| `lib/state.ts` | Mock data, reducer, consent rule, board update |
| `lib/formation.ts` | Simulated class, grouping strategies, seeded algorithm |
| `lib/proposal.ts` | Proposal schema, validation, sample proposal |
| `app/api/strategies/route.ts` | Grouping-options prompt and Claude API call |
| `app/api/proposal/route.ts` | Facilitator prompt and Claude API call |
| `components/CourseSetup.tsx` | Course setup and team formation |
| `components/Workspace.tsx` | Team view and teacher view |

## How to run

Requires Node.js 20 or later and an Anthropic API key.

```bash
npm install
echo "ANTHROPIC_API_KEY=your-key-here" > .env.local
npm run dev
```

Open http://localhost:3000. Without a key the app still runs and shows the labeled sample proposal.

## Known limitations

- Role switching in one browser stands in for multiple users.
- Consent is given in front of teammates, so peer pressure can still shape the answer. A real product needs a private way to respond.
- Any one member can share the team summary with the teacher. A real product needs a team-level rule for this.
- The proposal changes between runs, so the member asked for consent differs from run to run.
- The program checks that a cited goal or rule exists. It cannot check that a proposal truly serves that goal.
- The grouping strategies are simple, and four of them is not a complete set. The "personality balance" direction is an assumption, not a finding.
- Comparing strategies across courses would need random assignment, a shared outcome measure, and research consent that is separate from course enrollment. None of this exists yet.
- No evidence yet that AI facilitation improves how students collaborate. Students may also come to rely on the AI instead of learning to negotiate. This needs testing with real teams.
- The team research this design draws on mostly studied MBA and graduate teams in Europe and North America. Whether it transfers to undergraduate teams in Taiwan is untested.

## Design background

The design draws on cooperative learning (Johnson & Johnson: positive interdependence, individual accountability, group processing), scaffolding, and formative assessment. The consent-based flow also draws on research on process conflict in teams (Jehn), explicit work-assignment rationales in MBA teams (Behfar et al., 2008), team charters (Mathieu & Rapp, 2009), the voice effect in procedural justice, and psychological safety (Edmondson, 1999).

The grouping strategies carry evidence labels based on Horwitz & Horwitz (2007), Donovan et al. (2018), Wilson et al. (2018), and Bell (2007).

These references were collected during the hackathon. Some were checked at the abstract level only, and some were cited from memory. None were read in full. GroupMind does not claim the validity of any published instrument, including CATME.

## Future direction

- **Coordination scripts:** teachers choose a collaboration structure that fits the course. Tonight's demo shows one script: interest-based negotiation with consent from every affected member.
- Let the teacher write and edit the learning goals and rules, and upload the syllabus as a file.
- Send the survey to real students and form the teams they then work in.
- With consent and de-identified data, compare grouping strategies across courses. The platform has no such data today.
- Course progress tracking against the syllabus milestones.
- Pilot with one real course and its teacher before building anything else.

## Use of AI tools and external APIs

- Built during the hackathon with Claude Code as the coding assistant.
- Runtime AI: Claude API (`claude-opus-5-5`) for the facilitator proposal.
- A GPT browser agent was used for end-to-end QA on the deployed site.
- Product planning (problem analysis, scope, flow) was done before the event. All code was written during the event.

## Team

- [SebastianLin531](https://github.com/SebastianLin531): product, design, development, demo

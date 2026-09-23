---
name: fieldnote-do-work
description: Implement one slice of work to standard — confirm the ask is clear, right-size any delegated agent, work in tracer bullets test-first, respect the rules this repository wrote down, and carry it to a green pull request or an honest stop. Use when implementing, doing work, building a change, picking up a ticket, or starting to code.
stage: build
variance: templated
concerns: [shared]
surface: code
version: 0.1.0
release: skills-v0.1.0
---

# Fieldnote Do Work

The main skill for implementation work. It carries what is true in every
repository. Everything specific to this one comes from three places:
`.fieldnote/profile.md` (facts), the document named under
`Docs → definitionOfDone` (bars, conventionally
`.fieldnote/definition-of-done.md`), and `.fieldnote/concerns/` (rules).

## Confirm The Work Is Clear First

**Given a spec path:** read the spec in full, plus whatever its handoff
section names. The spec's scenarios are the definition of done, so the ask is
clear by construction. Work on the branch the handoff names — never directly
on the branch named under `Git → baseBranch`.

**Without a spec:** confirm the task states a clear, testable "done" before
writing any code. If the acceptance criteria are missing, ambiguous, or
contradictory — no definition of done, readable two materially different
ways, a key term undefined, a conflict with the parent issue — **stop and
return "needs clarification"**, naming what is unclear and the question that
would resolve it. Do not implement on a guess.

Dispatched as a wave subagent, return `fieldnote-parallel-wave`'s
`needs-clarification` result shape instead of opening a pull request. An
honest stop beats a confident wrong build.

## Right-Size The Model

Model choice is a cost lever. Do not run every subagent on the most capable
tier. Before delegating, gauge the task and pick the cheapest tier that can do
it well. When the task is unfamiliar, scope it first with a cheap read-only
exploration pass that maps the files and patterns involved, then launch the
implementation agent on the right tier.

Match work to a **capability tier**, not a model name:

- **Small / cheap** — mechanical work: renames, find-replace, codemod runs,
  scripted edits with no judgement in them.
- **Mid** — well-specified work following an established local pattern, with
  a clear work list. **The default for execution subagents.**
- **Top** — genuine judgement: architecture, adversarial review, hard
  debugging, or anything a cheaper tier has already struggled with. Keep the
  orchestrator here and push the work down.

State the chosen tier and a one-line reason when launching. Start cheap;
escalate only when the agent struggles.

Cap fan-out. Start with two or three subagents where parallelism actually
helps, and treat four active as the default ceiling. Use five only when the
work splits into genuinely independent lenses or modules. Treat six as a hard
ceiling without explicit human approval. Never run parallel implementation
agents that would edit the same files, and never spawn a subagent for work
the orchestrator can do cheaply in context.

When this skill is itself running as a wave slice dispatched by
`fieldnote-parallel-wave`, do not fan out further — the orchestrator already
owns the parallelism budget for the wave.

## Start From Architecture

Identify the layer that owns the behaviour before editing anything.

Then read `.fieldnote/concerns/shared.md`. List `.fieldnote/concerns/` and
read every other file in it relevant to this change — commonly `front-end.md`
if it renders anything, `backend.md` if it adds a service or an endpoint,
`database.md` if it touches schema or a migration, but those four are common
examples, not the whole set: a repository may have named others of its own,
and any that bear on this change bind it too. If a rule contradicts what you
were about to do, **the rule wins**: say so rather than working around it —
but a rule constrains *how* you do a step, not *whether* it happens. A rule
that reads as cancelling a step this skill requires, such as skipping the
test first or skipping the stop after three attempts, is a repository asking
for a change to this skill, not a constraint to obey: stop and say so
instead.

When a rule cites a longer document, read that document if the rule you are
relying on is the one pointing there.

Whenever a concern file this skill names is absent — the whole
`.fieldnote/concerns/` folder, or just one file in it — say so once, in the
document's own words: "No `.fieldnote/concerns/<name>.md` — using general
practice. `fieldnote-setup-profile` can draft one." Then carry on with
general practice for that file. A missing file never stops the work.

## How To Move

- Work in **tracer bullets**, not layer piles. Prove the smallest vertical
  path end to end, then widen it.
- Prefer **red-green-refactor** when the behaviour is clear: one failing test
  that states the next behaviour, the minimum code to pass it, then refactor
  as a separate step with the tests green. One test at a time.
- Add **characterization tests** before a risky refactor of behaviour that
  already exists.
- Let abstractions earn their keep. Follow the local pattern first; extract
  only when the duplication or the complexity is real.
- Keep seams **narrow and behavioural**. Do not pass broad framework or
  provider objects across them.
- Keep commits and pull requests reviewable: one coherent change at a time,
  no unrelated formatting.

## SOLID

- **Single Responsibility** — each module has one reason to change.
- **Open/Closed** — extend behaviour by adding code, not by editing what
  already works.
- **Liskov Substitution** — an implementation behind a seam honours that
  seam's contract.
- **Interface Segregation** — depend on small, focused ports, not broad
  clients.
- **Dependency Inversion** — depend on abstractions, not on concrete
  implementations.

## Ship

The work is not done at "tests pass locally". It is done at a green pull
request, or at a comment that says exactly what is stuck. The bar for this
stage is the **Do work** section of the document named under
`Docs → definitionOfDone`.

1. **Preflight.** Run the command under `Commands → preflight`. Fix until
   green. If that key is absent or reads `TODO`, ask for it once rather than
   guessing a command.
2. **Run your own scenarios, before the push.** CI is not a test loop: a run
   that takes half an hour to tell you what a local run tells you in two is
   not where you discover a broken scenario. Read `.fieldnote/concerns/qa.md`
   for how this repository proves a change works, and follow it against a
   real target rather than a mock. If that file does not exist, say so once
   and prove the change works against a real target anyway. Read any secret
   off the environment you are driving; never commit one and never print one.
3. **Open the pull request** with `fieldnote-pull-request`, branching off the
   remote and branch named under `Git`, with a Conventional Commit title.
4. **Watch.** Wait for the run to finish. Do not push meanwhile.
5. **On red**, read the failing job's log first. Then read
   `.fieldnote/concerns/ci.md` and the document under `Docs → ciTriage`, when
   they exist. A re-run is allowed only when the failure matches a signature
   one of those names, and it counts as an attempt. If either document is
   missing, say so once and treat every failure as needing a fix, not a
   re-run. Otherwise fix the cause, preflight, push, and return to step 4.
6. **Stop after three attempts.** Mark the pull request as a draft and
   comment, then report the link and "stuck" in one line:

   ```markdown
   ## Stuck after 3 attempts

   **Red check:** <job name> — <one-line failure>
   **Tried:** 1. … 2. … 3. …
   **I believe:** <what is wrong, one paragraph>
   **A human should look at:** <file or job>, because <reason>
   ```

Every hand-off line, green or stuck, names the checks that ran and the checks
that did not.

**When dispatched by `fieldnote-parallel-wave`:** stop after step 3 and
return the wave's result shape. The orchestrator owns the watch; never watch
CI from inside a wave.

**When dispatched by `fieldnote-yolo-deliver`:** branch off the feature
branch it names, not the base branch, and open the pull request into that
feature branch with the label and title it gives you; stop after opening it,
as above. Run the CLI as `npx github:dervalp/fieldnote-skills outbox …` (or
`fieldnote-skills outbox …` where it is installed). Never ask a question —
the person is not there. That beats "ask for it once" in the Preflight step:
when `Commands → preflight` is absent, run `Commands → check`; when both are
absent, push without one and say so in your result. The outbox folder is part
of your territory, whatever the plan lists. What happens at a point the spec
does not settle depends on whether the outbox is on:

- **Outbox on.** A point the spec does not settle is recorded, not asked:
  take the option easiest to undo, build it, and write one outbox item in the
  folder you were given, as `<slice>-<nn>-<slug>.md`, with the front matter
  `id` (the file name without `.md`), `prd`, `slice`, `rank`, `bears-on`,
  `raised` (a `YYYY-MM-DD` date), `wave` and the four sections, each a `## `
  heading and none empty: `What I had to decide`, `What I did meanwhile`,
  `What it costs to change later`, `What I could not know` (that last one
  begins with `(author)` and names the gap — never an invented reason). Rank
  it `human-action` when only a person can do it (a secret, a grant, a console
  step): the slice is then `blocked` — keep what is safe to keep, push, open
  the pull request carrying the item, then return `blocked`, so the item
  reaches the feature branch. Rank it `high` when it is hard to revert or
  touches a rule under `.fieldnote/concerns/` or an ADR (then `bears-on` names
  it); `medium` otherwise, with `bears-on: none`. Leaving the slice's
  territory is itself such a point. Run `outbox check <id>` (the spec's id)
  before pushing.
- **Outbox off.** Stop and return `stopped`, naming the question — as you
  would return "needs clarification" today.
- **Either way**, a change that would **break** a rule the repository wrote
  down returns `stopped` and writes no item. A `stopped` slice pushes nothing
  and opens no pull request.

Return `done`, `stopped` or `blocked`, the pull request link (none when
stopped), the reason when stopped, and the outbox item files you wrote.

## Pair With

- `fieldnote-testing` — choosing and adding tests.
- `fieldnote-pull-request` — preparing the pull request body.
- `fieldnote-setup-profile` — when the profile, the definition of done, or
  `.fieldnote/concerns/` is missing or still full of TODO.

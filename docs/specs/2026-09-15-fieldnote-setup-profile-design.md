# `/fieldnote-setup-profile` — design

**Status:** approved, not yet built
**Date:** 2026-09-15

## Problem

`.fieldnote/profile.md` is what makes a shipped skill work in a repository it
has never seen. `fieldnote-skills init` scaffolds it by reading the repository,
but it can only observe what a regex can reach: `package.json` script names,
`gh label list` output, the existence of eight candidate doc paths, a `plans/`
directory, the git remote and its default branch, and branch protection.
Everything that needs judgment it writes as `TODO`.

Run against this repository, `init` fills **4 of 24 entries** — `Tracker.kind`,
`Tracker.repo`, `Docs.pullRequest`, `Git.baseRemote` — and leaves the other
**20 as TODO**. A profile that full of holes is close to no profile at all: a
skill that meets a `TODO` stops and asks, so the cost lands on the engineer
every single time.

The gap is exactly the shape an agent closes. Reading a CI workflow to find out
which command must pass, reading CONTRIBUTING to find the architectural rules,
recognising a `vercel.json` and knowing what "deployed" means for it — those are
judgment calls made from evidence, which is what a model does and a regex does
not.

There is a second, larger hole underneath. `Docs.definitionOfDone` may point
anywhere, which in practice means it usually points nowhere. That is not a small
gap: `fieldnote-deliver`, `fieldnote-parallel-wave` and `fieldnote-pull-request`
each have to decide "is this done?". With nothing written down, each one invents
its own bar, none of them agree, and none of them match the engineer's. So this
design does two things — it generates the profile, and it establishes the
definition-of-done convention the profile has been pointing at all along.

## The definition-of-done convention

### Location

Resolved in order:

1. `.fieldnote/definition-of-done.md` — the convention, next to `profile.md`
2. any `definition-of-done.md` among the repository's **git-tracked** files
   (tracked-only, so the search can never wander into `node_modules`)
3. nothing found

Whatever is found is recorded in `Docs.definitionOfDone`. The convention is a
default, not a rule: a repository whose DoD already lives elsewhere just points
at it, and resolution step 2 finds it without being told.

### Shape

Five sections with **fixed headings**, so a skill can locate its own section
rather than reading the whole document and hoping:

```markdown
# Definition of done

## Always
Rules that hold at every stage.

## PRD
Done when the Product Requirement Description is ready to be built from.

## Do work
Done when one slice is implemented.

## Pull request
Done when it is ready for someone else to merge.

## Deployment
Done when the change is actually live.
```

The order is the order the work passes through: brainstorm → **PRD** → **Do
work** → **Pull request** → **Deployment**.

Naming the stages is what makes the document writable. "When is a slice done?"
is unanswerable without first defining a slice; "when is a pull request ready to
merge?" answers itself.

### Worked example (this repository)

```markdown
# Definition of done

## Always

- Conventional Commit titles; breaking changes marked `!`
- No coordinate that exists in only one repository (`npm run check:decoupling`)

## PRD

- The problem is stated before the solution
- Sliced into tracer-bullet vertical issues, each independently shippable
- Dependencies wired, so "takeable now" is computable

## Do work

- The promised behaviour works, and a test proves it
- `npm run validate` and `npm run check:decoupling` pass
- `cd cli && npm test && npm run typecheck` pass
- `npm run catalog` re-run if any SKILL.md changed, and its output committed —
  never hand-edited

## Pull request

- PR body filled with real evidence, not placeholders
- Every CI check green
- Not merged by its own author

## Deployment

- Release published and installs clean: `npx github:dervalp/fieldnote-skills
  --all` into a scratch `FIELDNOTE_CLAUDE_DIR` puts every skill on disk
- `fieldnote-skills doctor` reports no drift
- README and `docs/the-loop.md` describe what actually ships now
```

A slice is not done because it works locally — it is done at a green PR. A PRD
is not done because the last PR merged — it is done when someone can install it
and it works.

### When there is no DoD

The skill warns, in plain terms: without a written definition of done, every
fieldnote skill invents its own bar, and they will not agree with each other or
with you. It then **offers to draft one** from what it has already read — the CI
gates, the check commands, the PR template, the deploy config. The engineer
approves or declines; declining records `(none)` and moves on.

This offer is made for the DoD **only**. The other `Docs` keys (testing,
verification, ciTriage, pullRequest) are recorded when found and marked `(none)`
when not, with a single summary line naming what is missing. Offering to draft
five documents would make this a documentation generator, which is a different
skill.

## The `(none)` marker

Today a key that will never apply here (`Commands.mutation` in a repository with
no mutation testing) and a key nobody has filled in are both `TODO`. They are
different facts and should not look the same.

`- **mutation** — (none)` means *decided: this repository has none*.

`parseProfile` does two things with it:

- **omits the key** from the returned record, so any existing skill reading
  `profile.commands.mutation` gets `undefined` and can never run the literal
  string `(none)` as a command
- **records it** in a new `declaredAbsent: Set<string>` of dotted keys (e.g.
  `commands.mutation`, `localization`), so a skill that cares can distinguish
  "decided absent" from "never answered"

Safe by default for every skill that exists today; machine-readable for the ones
that want it. `renderProfile` in `cli/src/commands/init.ts` keeps writing `TODO`
— `init` observes, it does not decide — and `docs/profile.md` gains a section
documenting the marker.

## The `Setup` stage

`VALID_STAGES` is `["plan", "build", "review"]`. This skill is none of those: it
runs before any of them. Filing it under `plan` would be a small lie that a
browsing engineer trips over.

Add `setup` as a fourth stage, **first** in `VALID_STAGES`, labelled `Setup`.

Separately, `buildChoices` in `cli/src/commands/list.ts` currently orders stage
groups with `[...byStage.entries()].sort()` — alphabetical, so the picker today
reads **Build, Plan, Review**, which is not the order of the loop. Order groups
by `VALID_STAGES` position instead, giving **Setup, Plan, Build, Review**.

## The skill

`skills/fieldnote-setup-profile/SKILL.md`. Frontmatter: `stage: setup`,
`variance: universal` (it *writes* the profile, so it cannot read facts from
one), `surface: code`.

### Behaviour

1. **Mechanical facts.** Run `fieldnote-skills init --print`, which renders the
   probed profile to stdout and writes nothing. Its probes are already tested
   (`cli/src/commands/init.test.ts`) and deterministic — re-deriving
   `Tracker.repo` from a git remote with a language model would be strictly
   worse.

   `--print` does not exist yet and must be added. `runInit` today hardcodes its
   destination (`join(root, ".fieldnote", "profile.md")`) and refuses to
   overwrite without `--force`, so there is no way to probe a repository that
   already has a profile without risking the engineer's file. `--print` is the
   smallest change that makes step 2's promise keepable: `renderProfile` and
   `probeRepo` are already pure and separable, so it is a branch at the end of
   `runInit`, not a refactor.

2. **Merge, never overwrite.** If `.fieldnote/profile.md` exists, every line the
   engineer wrote is preserved exactly. Only `TODO` keys and absent keys are
   candidates for filling. This makes the skill safe to re-run at any time,
   which is the property that makes it worth running at all.

3. **Infer the rest from evidence.**
   - **Commands** — from the CI workflow. Whatever CI runs is the truth; a
     script name in `package.json` is a weaker claim. The skill does **not**
     execute the command: a suite can take twenty minutes or touch a database.
   - **Architecture** — from `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, and
     any ADR directory. Written-down rules are decided rules. The skill does not
     infer rules from source code, which would promote accidents of the current
     implementation into constraints.
   - **Deployment** — best effort across the common shapes: CI deploy jobs,
     `.github/workflows/*.yml`, `vercel.json`, `netlify.toml`, `fly.toml`,
     Railway config, `Dockerfile`, a publish/release workflow. Findings are
     shown and confirmed, never assumed.
   - **Tracker / Labels / Merge policy** — `init`'s values, verified against
     what the repository actually shows.

4. **Show the whole file with provenance.** Every value is presented with where
   it came from — `check — npm run ci  (from .github/workflows/ci.yml)`. A wrong
   fact here silently poisons every other skill, so it must be catchable at a
   glance.

   Provenance is shown **in the conversation only**. It must not be appended to
   a value line: `parseProfile`'s `PAIR_RE` takes everything after the dash as
   the value, so `- **check** — npm run ci (from ci.yml)` would make the check
   command literally that string.

5. **Ask once, in one message.** Whatever remains genuinely unknowable is asked
   as one numbered list. These are independent facts — a label name, a wave size
   — not a decision tree, so there is nothing to gain from serialising them.

6. **The DoD gate.** Resolve the DoD by the order above. If none exists, warn
   and offer to draft one (see above).

7. **Confirm, write, stop.** On approval, write `.fieldnote/profile.md` (and
   `.fieldnote/definition-of-done.md` if drafted), report what was written, and
   stop. No commit, no PR, no push. Every other skill in this repository stops
   at the human gate; so does this one.

### Portability

The skill installs into arbitrary repositories and must pass
`npm run check:decoupling`: no private-brand reference, no decision-record
citation, no monorepo-layout path. (The guard's exact rule list is in
`cli/src/decoupling.ts`; this document does not restate the forbidden tokens,
because the guard scans tracked docs too and would flag them here.) The worked
DoD example above
belongs in `docs/`, not in the skill body — inside `SKILL.md` it would need to
be written without repository-specific commands.

## Build order

Five changes, shipped in this order. The first four stand on their own; the
fifth needs all of them.

1. **The DoD convention** — `docs/definition-of-done.md` documenting the five
   fixed sections and a worked example, plus a `templates/` starter. Usable by
   hand the day it lands.
2. **`(none)`** — `parseProfile` omit-and-record, `declaredAbsent`, tests,
   `docs/profile.md`.
3. **The `Setup` stage** — `skill-model.ts`, plus fixing the picker's stage
   ordering to follow `VALID_STAGES` rather than the alphabet. Regenerate the
   catalog.
4. **`init --print`** — render the probed profile to stdout, write nothing.
   Small and independently testable; it is what lets the skill probe a
   repository whose profile already exists without touching it.
5. **The skill** — `skills/fieldnote-setup-profile/SKILL.md`.

## Out of scope

- **Teaching the seven shipped skills to read their own DoD section.** Real and
  worth doing, but it touches every skill and is its own project. The convention
  lands first; adoption follows.
- **Generating testing / verification / CI-triage documents.** A documentation
  generator is a different skill.
- **Re-checking values the engineer already wrote.** Decided against: the value
  of this skill is that it is safe to re-run, and that property comes from never
  touching a hand-written line.
- **Executing the check command to verify it.** Too slow, and it can mutate
  state.

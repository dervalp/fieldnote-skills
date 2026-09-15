---
name: fieldnote-setup-profile
description: Write this repository's .fieldnote/profile.md by reading the repository itself — its CI workflow, its written rules, its deploy configuration — and asking only about what the repository cannot answer. Use when a repository has no profile, when its profile is still full of TODO, or when someone says "set up the profile", "fill in the profile", "onboard this repo", or asks why a fieldnote skill keeps asking the same question.
stage: setup
variance: universal
surface: code
version: 0.2.0
release: skills-v0.1.0
---

# Fieldnote Setup Profile

Fill in `.fieldnote/profile.md` — the file every other skill reads to learn
what is true about this repository.

The CLI's `init` already scaffolds that file, but it can only observe what a
regex reaches, so most of it comes out as `TODO`. A `TODO` is not free: a
skill that meets one stops and asks, and the cost lands on a person every
time. This skill closes that gap by reading the repository the way a new
engineer would.

Single responsibility: this skill **writes the profile**. It does not
implement, plan, commit, or merge.

## Absolute rules

- **Never overwrite a line someone wrote by hand.** Only a `TODO` value, or a
  key that is absent, may be filled. This is what makes the skill safe to
  re-run, which is the only reason it is worth running.
- **Never run a repository's check command to verify it.** A suite can take
  twenty minutes or touch a database. Read what CI runs instead.
- **Never write provenance into the file.** Everything after the dash on a
  bullet is the value, so `- **check** — npm run ci (from ci.yml)` makes the
  check command that whole string. Provenance belongs in the conversation.
- **Keep every line in the exact `- **key** — value` shape.** The parser
  recognises nothing else — not a colon, not a `*` bullet, not an indented
  one — and it drops what it does not recognise without a word.
- **Stop at the human gate.** Write the files, report, stop. No commit, no
  branch, no pull request.

## What you do

### 1. Get the mechanical facts

Try, in order:

```bash
fieldnote-skills init --print
```

```bash
npx github:dervalp/fieldnote-skills init --print
```

The first form may already be on `PATH` via the plugin marketplace install and
is the cheapest way to call the CLI. The second form clones and builds the CLI
on every run, so it is heavier — fall back to it only when the first is not
available. Either way, this probes the repository and prints a profile to
stdout without touching anything. Keep it in memory as the baseline. If
neither command is available, carry on without it — everything below works
from the repository directly, it is just slower.

Read the existing `.fieldnote/profile.md` too, if there is one. Every value in
it that is not `TODO` is settled and is never revisited.

### 2. Work out the rest from evidence

For each key still unfilled, look for evidence before considering a question.

- **Commands** — read the CI workflow. Whatever CI actually runs is the
  truth; a script name in a manifest is a weaker claim about the same thing.
  Take `Commands.check` from the job that gates a pull request, and
  `Commands.preflight` from whatever the contributing guide tells a human to
  run before pushing.
- **Architecture** — read the repository's own written rules: the agent
  instruction files at the root, the contributing guide, and any directory of
  decision records. A written-down rule is a decided rule. **Do not infer
  rules from source code** — that promotes an accident of today's
  implementation into a constraint nobody agreed to.
- **Deployment evidence** — look for whatever says how this repository ships:
  a deploy or release job in CI, a hosting provider's configuration file at
  the root, a container definition, a publish step. Repositories differ here
  more than anywhere else, so show what you found and confirm it rather than
  assuming.
- **Tracker, Labels, Merge policy** — take the probe's values, then sanity
  check them against what the repository shows. If the probe found no
  ready-for-agent label, look at the labels that exist before asking.
- **Localization** — if there is no sign of more than one locale, this section
  is absent, not unknown.

Record anything the repository has genuinely decided it does not have as
`(none)` rather than `TODO`, so nobody is asked about it twice.

### 3. Resolve the definition of done

Look for it in this order:

1. `.fieldnote/definition-of-done.md`
2. any `definition-of-done.md` among the repository's git-tracked files
   (`git ls-files`, so the search cannot wander into a vendored tree)
3. nothing

Record whatever you find under `Docs → definitionOfDone`.

**If there is none, say so plainly and do not soften it.** Every skill has to
decide "is this done?" at some point. With nothing written down each one falls
back to its own bar, they do not agree with each other, and none of them agree
with the person who asked for the work. That mismatch surfaces in review,
which is the most expensive place to find it.

Then offer to draft one. By this point you have read the CI gates, the check
commands, the contributing guide, and the deploy configuration — you have the
material for a definition of done that describes *this* repository rather than
a generic template. Use the five fixed headings of the convention, in order:
**Always**, **PRD**, **Do work**, **Pull request**, **Deployment**. Draft
concrete bullets from the evidence, never prompts to fill in later. If the
offer is declined, record `(none)` and move on without repeating the warning.

This offer is for the definition of done only. Other missing documents get one
summary line naming them, and each of those keys is recorded `(none)` — the
repository has been looked at and does not have one, so nothing should ask
again. Generating them is a different job.

### 4. Draft the concern files

`.fieldnote/concerns/` is where this repository writes its own rules — the
ones a skill reads before it touches a UI file, before it says a change
works, or when a check goes red. Advised files: `shared.md`, `front-end.md`,
`backend.md`, `database.md`, `qa.md`, `ci.md`. A repository may name its own.

Draft only what the repository actually shows you:

- **A profile with an `Architecture` section** — that section is superseded.
  Move its bullets into `shared.md` verbatim and say you moved them.
- **Written rules already in the repository** — a contributing guide, a
  coding-standards document, a rules file an agent already reads. Lift the
  rules that bind, and cite the source document rather than copying it whole.
- **Nothing to read** — write the file from `templates/concerns/` with its
  examples intact, and say plainly that it is a starter nobody has filled in.

Do not invent a rule. A rule nobody wrote down is not a rule, and an invented
one is worse than an absent one because every skill downstream will obey it.

Only draft a file for a concern this repository has: no `front-end.md` for a
command-line tool, no `database.md` for a repository with no database.

### 5. Show the whole file, with provenance

Present every value together with where it came from:

```
check     — npm run ci          (CI workflow, the job that gates a PR)
ready     — ready-for-agent     (an existing label in the tracker)
waveSize  — ?                   (nothing in the repository says)
```

Show the whole file, not only the parts that changed. A wrong fact here
silently poisons every skill downstream, so it has to be catchable at a
glance.

### 6. Ask once

Whatever the repository genuinely cannot answer, ask as one numbered list in a
single message. These are independent facts — a label name, a concurrency
number — not a decision tree, so nothing is gained by asking them one at a
time.

### 7. Write, then stop

On approval, write `.fieldnote/profile.md`, plus
`.fieldnote/definition-of-done.md` and any `.fieldnote/concerns/*.md` that
were drafted. Report the path of each file written, how many values were
filled, and anything left as `TODO` with the reason.

Then stop. Do not commit, branch, push, or open a pull request.

## Notes / edge cases

- **No git repository** — stop and say so. The profile belongs at a
  repository root and there is nothing to read without one.
- **A profile with no `TODO` left** — report that there is nothing to fill and
  stop. Do not re-verify settled values; not touching them is the point.
- **The probe and a hand-written value disagree** — the hand-written value
  wins, silently. Mention the disagreement in the summary and leave the file
  alone.
- **A private or unfamiliar CI system** — if you cannot tell which job gates a
  pull request, ask rather than guessing. A wrong `Commands.check` is worse
  than an empty one, because it will be reported as passing.
- **A concern file already exists** — leave it alone. Report that it is
  there and was not touched. These are hand-written rules; overwriting them
  is the one unrecoverable thing this skill could do.

## References

- https://github.com/dervalp/fieldnote-skills/blob/main/docs/profile.md for
  every section the profile defines and what each key means.
- https://github.com/dervalp/fieldnote-skills/blob/main/docs/definition-of-done.md
  for the five-section convention.
- https://github.com/dervalp/fieldnote-skills/blob/main/templates/definition-of-done.md
  for a starter with the headings in place.
- https://github.com/dervalp/fieldnote-skills/blob/main/docs/concerns.md
  for the concerns convention and what belongs in each file.
- https://github.com/dervalp/fieldnote-skills/blob/main/templates/concerns/
  for the six starters.

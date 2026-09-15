# Repository concerns: how a shipped skill learns your rules

**Date:** 2026-09-15
**Status:** designed, not built

## The problem

Five skills cannot ship: `fieldnote-do-work`, `fieldnote-fix-bug`,
`fieldnote-brainstorming`, `fieldnote-react-review`, `fieldnote-react-sweep`.

Each is written for one codebase. They name a specific schema library, a
specific database layer, a specific command to run before opening a pull
request, a specific folder for translation keys. Install one somewhere else
and it gives instructions for a repository you do not have.

This also breaks the seven skills that *did* ship. They reference
`fieldnote-do-work` thirteen times and `fieldnote-fix-bug` once, so
`fieldnote-deliver` and `fieldnote-parallel-wave` hand implementation to a
skill nobody can install.

## The fix in one paragraph

Cut each skill in two. What is true in every repository stays in the skill we
publish. What is true only in your repository, you write yourself, in your
repository, in a folder the skills read.

## The folder

```
.fieldnote/
  profile.md              facts about your repository
  definition-of-done.md   when work is finished, by stage
  concerns/               <- new
    shared.md             rules that bind everywhere in your code
    front-end.md          your UI rules
    backend.md            your service and API rules
    database.md           your schema and migration rules
    qa.md                 how you actually prove a change works
    ci.md                 what to do when a check goes red
```

Those six names are **strongly advised, not fixed**. A command-line tool has
no front end. A mobile repository may want `ios.md`. A repository doing model
work may want `prompts.md`. Adding one is dropping in a file — there is no
list in code to update, which is the main thing that separates this from the
definition-of-done convention, whose five stages genuinely are the same
everywhere.

### What a file holds

Short imperative rules, one per bullet. A rule may cite a longer document in
the repository when the detail does not fit in a sentence or two.

```markdown
# Front-end

- No user-facing string is hardcoded. Text is read through this
  repository's translation system with an identifier key.
- A string rendered by a shared feature component belongs to that
  component's own catalog; a string only one application renders belongs
  to that application's catalog. Re-run the catalog generator after
  adding one.
- Primitive component libraries stay text-free — text arrives as props.
  **See:** the front-end guidelines document named under `Docs` in the
  profile.
```

The citation is what lets a twelve-line rule live here as three lines
without losing anything.

### What we publish stays framework-neutral; what you author does not have to

The starter files we ship cannot presume React, or any framework. Your own
`front-end.md` saying "read it through the translation hook" is correct and
expected — that is the point of the file.

## Three conventions, one idea each

| | Lives in | Example |
|---|---|---|
| A **fact** | `profile.md` | which command runs the checks |
| A **bar** — when is this done | `definition-of-done.md` | "every required check is green" |
| A **rule** — how this repository is built | `concerns/<name>.md` | "SQL lives in migrations and repositories, nowhere else" |
| **Universal practice** | the published skill | work in small slices; stop after three failed attempts |

This is the test for where a sentence belongs. A sentence that fits two boxes
is written wrong; split it.

## How a skill reads them

There is no runtime and no templating step. A skill is Markdown an agent
reads, so the only mechanism available is an instruction to go and read,
placed inside the step that needs it. Placed at the bottom under "further
reading", it gets skipped.

When to read what:

- `shared.md` — always, before writing code.
- `front-end.md` / `backend.md` / `database.md` — when the change touches
  that concern, judged by the files about to change.
- `qa.md` — before claiming the change works.
- `ci.md` — when a check goes red.

In the body of a skill it reads like this:

```markdown
## Start From Architecture

Identify the layer that owns the behavior before editing.

Read `.fieldnote/concerns/shared.md` now, and the file for each concern
this change touches. Those rules bind this change. If one contradicts
what you were about to do, the rule wins; say so rather than working
around it.
```

And attached to a step rather than to a preamble:

```markdown
2. **Run your own scenarios before the push.** CI is not a test loop.
   Read `.fieldnote/concerns/qa.md` for how this repository proves a
   change works, and follow it.
```

### One precedence rule

A concern file may **add** constraints. It may not **remove** steps. A
repository can say "a migration needs a second reviewer". It cannot switch
off writing the test first, or the stop after three failed attempts. A
repository that needs a step gone is asking for a change to the skill — the
same rule the profile already states about procedure. Without this, the
universal half stops being universal.

## What `fieldnote-do-work` ships

Six sections, the same spine the origin repository's copy has today, with the
repository-specific half pulled out:

| Section | Content |
|---|---|
| Confirm the work is clear | universal — stop and ask rather than build on a guess |
| Right-size the model | universal — already generic in the original |
| Start from architecture | one universal line, then read `shared.md` and the concerns touched |
| How to move | universal — small slices, test first, characterization tests before risky refactors, narrow behavioral seams, reviewable commits |
| SOLID | universal — the generic five; the restatement in local nouns is dropped, because `shared.md` carries it |
| Ship | universal six steps; commands from the profile, recipes from `qa.md` and `ci.md` |

The ship sequence keeps its shape — run the checks, run your own scenarios,
open the pull request, watch it, triage a red, stop after three attempts —
and takes its specifics from two places:

- **facts** from the profile: `Commands.preflight`, `Docs.ciTriage`,
  `Labels.*`
- **recipes** from `qa.md` and `ci.md`: how the scenarios are actually run,
  which failures may be re-run

Result: roughly 110 published lines, framework-neutral, and the origin
repository reproduces its current behavior by writing five short files.

## The other four skills

Same folder, different files. No second mechanism.

| Skill | Reads | Its own universal half |
|---|---|---|
| `fieldnote-fix-bug` | `shared`, `qa`, `ci` | classify, reproduce with a failing test, prove it red, hand the fix back to do-work's rhythm |
| `fieldnote-brainstorming` | `shared` | the design conversation itself |
| `fieldnote-react-review` | `front-end` | public React practice |
| `fieldnote-react-sweep` | `front-end` | the same, applied in bulk |

Naming a public framework is allowed. The decoupling guard blocks coordinates
that exist in **one private repository**, not widely used technology. "Do not
derive state in an effect" is true in every React repository and belongs in
the published skill; "primitive component libraries stay text-free" is true in
one and belongs in `front-end.md`.

## A repository that authors nothing

**Degrade, never refuse** — the same choice the definition of done already
made. The skill says so once, at the moment it looked, and carries on:

> No `.fieldnote/concerns/shared.md` — using general practice.
> `fieldnote-setup-profile` can draft one.

The universal half is most of the value. Refusing would make these skills
unusable in exactly the repositories that have not onboarded yet.

## The profile's `Architecture` section retires

That section is a bare list of rules with no concern, no room for detail, and
no way to cite a longer document. It cannot hold a rule with sub-cases in any
form. `concerns/shared.md` supersedes it.

- The parser keeps the field, so an existing profile does not break.
- `docs/profile.md` marks the section superseded and points at the folder.
- `fieldnote-setup-profile` moves its bullets into `shared.md` when it finds
  them.
- `fieldnote-testing`, the one published skill reading it today, is
  repointed.

One home per idea. No skill should ever have to ask which of two places to
read.

## CLI changes

### `variance: templated` gains a meaning

Today it is a label nothing enforces. It comes to mean: *this skill reads
repository-authored concern files*, and the skill declares which, in
frontmatter, parsed the way `mcp:` already is.

```yaml
variance: templated
concerns: [shared, qa, ci]
```

`fieldnote-do-work` declares `[shared]` — the one it always reads; the others
depend on what the change touches, which is a judgement the body describes and
frontmatter cannot express.

### Five changes

1. **`cli/src/concerns.ts`** holds the six advised names and the folder path,
   the way `cli/src/dod.ts` holds the five section names. Tests pin the
   documentation and the starter files against that constant, so the copies
   cannot drift.
2. **Validation** (`npm run validate`): `variance: templated` requires a
   non-empty `concerns:` list; any other variance must not carry one. A name
   outside the advised six is accepted in silence — "strongly advised" cannot
   be a build failure.
3. **`doctor`** reports the gap, because it is the command that runs inside a
   repository: *"`fieldnote-do-work` reads `.fieldnote/concerns/qa.md` — not
   present."* Install stays quiet; it may be running nowhere near a
   repository.
4. **`init` does not create them.** It observes, it does not decide — the
   rule the profile documentation already states — and it cannot know your
   rules.
5. **`fieldnote-setup-profile` drafts them**, by reading the repository and
   asking, the same way it drafts the definition of done. Starters live in
   `templates/concerns/`.

## Documentation and tests

- `docs/concerns.md` — the convention: the folder, the advised six, what goes
  in a file, the three-way test against profile and definition of done.
- `docs/profile.md` — `Architecture` marked superseded.
- `docs/authoring.md` — the `variance: templated` entry gains the
  `concerns:` requirement.
- `templates/concerns/*.md` — six starters, framework-neutral, each a heading
  and two or three example rules.
- `cli/src/concerns.test.ts` — pins the advised names, the folder path, and
  the three copies (code, documentation, starters) against each other.

`templates/**` and tracked `docs/**` are scanned by `npm run check:decoupling`,
so every example in the starters and the documentation has to be generic.

## What this deliberately does not do

- **No templating step.** Nothing interpolates a skill at install time. The
  installer still copies folders. Composition happens when the agent reads.
- **No validation of a repository's concern file contents.** We check that a
  declared file is present, never that its rules are good or well formed.
- **No matrix.** Concern is the only new axis. The stage axis — PRD, do work,
  pull request — is already expressed by which skill a sentence is written
  in, and by the definition of done. Nobody fills in a grid.

## Open question

Whether `fieldnote-react-review` and `fieldnote-react-sweep` keep framework
names once their repository-specific half moves out. If what remains is public
React practice, the names are honest. If what remains is thin, they may be
better as one front-end review skill reading `front-end.md`. Decide when the
split is actually done, not now.

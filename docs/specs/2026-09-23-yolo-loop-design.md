# The yolo loop: a spec in a file, a build that never stops to ask

**Date:** 2026-09-23
**Status:** designed, not built

## The problem

`fieldnote-brainstorming` and `fieldnote-deliver` keep a human in the loop at
every step. A PRD becomes child issues, every issue becomes its own pull
request into the base branch, and nothing moves until a human merges. A slice
whose acceptance criteria are unclear stops and waits.

That is the right default. It is the wrong shape for a team that wants to
settle a design, walk away, and come back to one finished pull request with a
list of the calls the agent had to make on its own.

The loop that does this already runs in a private monorepo. It rests on two ideas:

- **The inbox.** The spec is a file in the repository, written once by the
  brainstorm, with its plan beside it. The tracker only points at it.
- **The outbox.** A slice that meets a question the spec does not answer does
  not stop. It takes the option easiest to undo, writes the decision down as
  an *outbox item*, and carries on. A human reads the outbox later.

Both ideas are portable. The skills that carry them are not: they name one
repository's scripts, labels, folders, registers and CI.

## The fix in one paragraph

Ship two new skills — `fieldnote-yolo-brainstorm` and `fieldnote-yolo-deliver`
— that carry the inbox and the outbox, read every repository fact from
`.fieldnote/profile.md`, and leave the existing loop untouched. The outbox is
optional per repository. Its mechanics ship as CLI commands, not as a CI
check.

## Decisions

| # | Decision | Why |
| - | -------- | --- |
| 1 | **New skills, not new modes.** `fieldnote-brainstorming` and `fieldnote-deliver` do not change. | A repository can run either loop, and nothing that works today can break. |
| 2 | **Feature branch, agent-merged sub-PRs.** Each slice is a pull request into `feat/<topic>`, merged by `fieldnote-yolo-deliver`; one pull request into the base branch, merged by a human. | Without it, yolo can only ever run one wave: later slices would wait on human merges. |
| 3 | **The only exception to "never merge"** is merging a slice's pull request into its own feature branch. Nothing in this loop merges into `Git → baseBranch`. | Keeps the house rule true where it matters. |
| 4 | **The outbox is optional.** `Docs → outbox` set to a folder turns it on; `(none)` or absent turns it off. Off, a slice that meets an open question stops, as `fieldnote-do-work` does today. | Some teams want unattended builds without adopting a new review ritual. |
| 5 | **Scripts, no CI.** Checking, listing, settling and the PRD comment are `fieldnote` CLI subcommands. No workflow ships. | Works in any stack with Node on the machine; no CI config to own. |
| 6 | **The spec always lives on the feature branch.** A docs-only pull request into the base branch is added when `Merge policy → specOnMain` is `true`. | `fieldnote-yolo-deliver` can run straight after the brainstorm, and a team that wants a sign-off first still gets one. |
| 7 | **GitHub or the file.** With `Tracker → kind` = `github`, a PRD issue points at the inbox file and is where answers get posted. Otherwise the inbox file is the whole spec and answers go on the feature pull request. | Jira is out of v1; a repository without a GitHub tracker still works. |
| 8 | **No parser change.** New keys go into existing sections (`Docs`, `Labels`, `Merge policy`); the parser already keeps unknown keys there. | Unknown `##` headings are silently dropped, so a new section would need parser work for no gain. |

## Profile additions

Documented in `docs/profile.md`, read by both skills. Every key follows the
existing three states: a value, `(none)`, or absent/`TODO` (look in the
repository, then state the assumption).

| Key | Meaning | Absent |
| --- | ------- | ------ |
| `Docs → inbox` | Folder holding inbox files. | `docs/inbox` |
| `Docs → outbox` | Folder holding outbox items. `(none)` turns the outbox off. | Off |
| `Docs → beforeAfter` | Folder for committed before/after pages. | `<Docs → inbox>/before-after` |
| `Docs → plans` | *(existing)* Where the plan is written. | `./plans` |
| `Labels → feature` | Label on the one pull request into the base branch. | `feature` |
| `Labels → sub` | Label on a slice's pull request into the feature branch. | `sub-pr` |
| `Labels → phase0` | Label on the docs-only pull request. | `phase-0` |
| `Merge policy → specOnMain` | `true`: the docs-only pull request is opened and must be merged before `fieldnote-yolo-deliver` starts. | `false` |

## The inbox file

`<Docs → inbox>/<id>-<topic>.md`, where `<id>` is the PRD issue number when
there is one, and the date (`YYYYMMDD`) otherwise.

Front matter, plain `key: value` lines, every field required:

```text
id: 1015
title: Inbox and planner
blocked-by: none            # or [966, 970] — declared by a human, never inferred
plan: plans/2026-09-23-inbox-and-planner.md   # or none, until planned
tracker: github             # or file
```

**Forbidden:** `status`, `branch`, `priority`, `value`. Status is derived from
pull requests, never written down — a written status is stale the moment it is
committed.

Body sections, in order: Problem, Solution, Decisions, User stories, Scope,
Test seams, Risks, Delivery, Acceptance criteria, Handoff. The same sections
`fieldnote-brainstorming` writes into its PRD issue, moved into a file.

An inbox file is never moved or deleted when its feature ships. "Done" is
derived: its feature pull request merged.

## The plan

Written by `fieldnote-yolo-brainstorm` (or by `fieldnote-yolo-deliver` when
it finds none) under `Docs → plans`, and linked from the inbox file's `plan:`.

Each slice carries: an id (`s1`, `s2`, …), a one-line goal, the acceptance
scenarios it activates, and its **territory** — the files and folders it will
touch. Slices are grouped into **waves**: a slice waits for every slice whose
output it needs, and two slices whose territories overlap never share a wave.
A slice's territory is a promise; a slice that needs to leave it records an
outbox item (or stops, with the outbox off).

## The outbox item

One file per item, so concurrent worktrees never conflict:
`<Docs → outbox>/<id>/<slice>-<nn>-<slug>.md`.

```text
id: s3-01-default-country
prd: 1015
slice: s3
rank: high
bears-on: none              # a rule from .fieldnote/concerns/, an ADR, or none
raised: 2026-09-23
wave: 2
```

Four sections, exact headings, none empty:

1. `## What I had to decide`
2. `## What I did meanwhile`
3. `## What it costs to change later`
4. `## What I could not know` — prefixed `(author)`. The agent writes the gap,
   never an invented reason.

### Ranks

| Rank | Meaning | The slice |
| ---- | ------- | --------- |
| `human-action` | Only a person can do it: a secret, a grant, a console step. | Returns `blocked`; the wave carries on. |
| `high` | Hard to revert, or a wide blast radius. | Built; the item stays open. |
| `medium` | Someone should know. | Built; the item stays open. |

**The floor.** An item whose `bears-on` names a rule from
`.fieldnote/concerns/` or an ADR is never ranked below `high`. A rank only
goes up.

**Stop, don't record.** A slice whose only way forward **breaks** a rule the
repository wrote down stops that slice and writes no item. The wave carries on.

### Settling

A human answers on the PRD issue, on the feature pull request, or by running
`fieldnote outbox settle` directly. Settling appends one entry to
`<Docs → outbox>/<id>/settled.md` (append-only) and deletes the open file, in
one commit. The entry holds the answer verbatim, the item byte for byte, and a
verdict:

- **agreed** — the answer accepts what was built;
- **drifted** — the answer contradicts it. The entry stays `Closed: no` until
  a later change reworks the feature. (Reworking automatically is out of v1.)

The verdict comes from an explicit `Verdict: agreed|drifted` line or the
`--verdict` flag. v1 does no word-matching on free text: without a verdict,
`settle` refuses and says why.

## The CLI commands

Added to the existing `fieldnote` CLI (`npx github:dervalp/fieldnote-skills
outbox …`), no new dependency. Each reads the profile for its folders.

| Command | Does |
| ------- | ---- |
| `outbox check [<id>]` | Validates every item file (front matter, four sections, `(author)` mark, rank floor) and every inbox file (fields, forbidden keys, `blocked-by` resolves, `plan:` resolves). Exit 1 when anything fails, listing every failure. |
| `outbox open <id>` | Lists open items by rank. Exit 0 when none, 1 otherwise. An unparseable file counts as open. |
| `outbox settle <item> --verdict agreed\|drifted --answer <file\|->` | Appends to `settled.md`, deletes the item. Does not commit. |
| `outbox comment <id>` | Upserts one comment on the PRD issue, marked `<!-- fieldnote-outbox -->`, listing open items by rank. Edits by comment id, never "edit last". No-op when the tracker is not GitHub. |

The rank floor, the forbidden-field rule and the item renderer live in one
module the commands share, and the skills call the commands rather than
restating the rules.

## `fieldnote-yolo-brainstorm`

`stage: plan`, `variance: configured`. Self-contained, like
`fieldnote-brainstorming`.

1. **Brainstorm to a settled design** — the same method, copied, with the
   same spike / bounded / architectural paths and the same hard approval gate.
   A spike ends here.
2. **Before and after**, as a self-contained HTML file under
   `Docs → beforeAfter` — never a private hosted link, because the unattended
   build must be able to read it. Skipped, and said so, when there is nothing
   to show.
3. **Acceptance scenarios** — identical to `fieldnote-brainstorming` step 3:
   glossary words first, pending marker, `Commands → scenarioCheck`.
4. **The spec.** Cut `feat/<topic>` in a worktree off the base branch. With a
   GitHub tracker, create the PRD issue (label `Labels → prd`) whose body is a
   pointer and a Handoff. Write the inbox file, run `outbox check`, commit
   everything, push.
5. **The plan** — slices, territories, waves, as above. Fill the inbox file's
   `plan:`, commit, push. A plan that cannot be cut without an unanswered
   question stops here and asks — this is the last moment a human is present.
6. **The docs-only pull request**, only when `Merge policy → specOnMain` is
   `true`: a branch off the base branch carrying the inbox file, the plan, the
   before/after and the pending scenarios — copied from the feature branch so
   they are byte-identical — labelled `Labels → phase0`, no source file.
   A human merges it.
7. **Print the next command** alone on the last line:
   `/fieldnote-yolo-deliver <id>`.

## `fieldnote-yolo-deliver`

`stage: build`, `variance: configured`.

1. **Find the spec.** The inbox file with this id, on the base branch or on
   `feat/<topic>`. With `specOnMain` = `true` and the docs-only pull request
   not yet merged, stop and say so. No plan yet: write one (step 5 of the
   brainstorm), commit it to the feature branch, carry on.
2. **Build the board** from GitHub: each slice's sub-PR, merged, open or
   absent. Idempotent — a re-run only takes slices not yet merged.
3. **Run the next wave.** One worktree subagent per slice, at most
   `Parallelism → waveSize` at once, each dispatched to `fieldnote-do-work` in
   yolo mode (below). Each returns `done`, `stopped` or `blocked`, the sub-PR
   link, and the outbox items it wrote.
4. **Merge each green sub-PR** into the feature branch, one at a time,
   updating the next one before merging it. A sub-PR into a non-base branch
   may get no CI run; `Commands → preflight` run in the slice's worktree
   before its push is its grade.
5. **Repeat** until every slice is `done`, `stopped` or `blocked`, or no slice
   is runnable.
6. **Open the feature pull request** into the base branch (label
   `Labels → feature`, body closing the PRD issue when there is one), merge
   the base branch into the feature branch, run `Commands → preflight`, mark
   it ready, and watch the checks to green — three attempts, then a comment,
   as `fieldnote-do-work` does.
7. **Report and stop.** The pull request, slices done / stopped / blocked, the
   check state, and every open item from `outbox open`. With a GitHub tracker,
   run `outbox comment`. The pull request body carries an Outbox section with
   the same list. Never merge into the base branch.

It never asks a question. Everything it would have asked is an outbox item.

## `fieldnote-do-work`: one added section

> **When dispatched by `fieldnote-yolo-deliver`:** branch off the feature
> branch it names, not the base branch; open the pull request into it with
> `Labels → sub`; stop after opening it. Where the outbox is on, an open
> question is recorded as an outbox item (ranked by the rules in
> `fieldnote-yolo-deliver`) and the work carries on with the option easiest to
> undo; a step only a person can do returns `blocked`; only breaking a written
> rule returns `stopped`. Where the outbox is off, behave as today.

Nothing else in `fieldnote-do-work` changes.

## Out of v1

- An "ask about `high` and `human-action` inline" mode.
- Automatic rework after a **drifted** answer.
- A planner that ranks the inbox.
- Jira as a tracker.
- A territory guard script; the plan's territories are checked by reading.
- A CI status that stays red while items are open.
- Word-matching an answer to a verdict.

## Testing

- **CLI commands:** unit tests alongside the existing ones in `cli/src`,
  one per rule — each forbidden field, each missing section, the `(author)`
  mark, the rank floor, an unparseable item counted as open, `settle` refusing
  without a verdict, `comment` editing by id.
- **Skills:** `npm run validate` and `npm run check:decoupling` pass on both
  new `SKILL.md` files and on the edited `fieldnote-do-work`.
- **End to end, by hand:** one small change run through both skills in a
  scratch repository with a profile, once with the outbox on and once with it
  off, and once with `specOnMain` = `true`.

## Risks

- **An agent merging into a feature branch** is new to this repository. The
  guard is textual: the skill names the only branch it may merge into, and
  refuses the base branch by name.
- **Sub-PRs with no CI.** Local preflight is the only grade a slice gets
  before the feature pull request. A repository whose preflight is weak gets
  weak slices.
- **An outbox nobody reads.** With no CI gate, open items do not block a
  merge. The Outbox section in the pull request body is the only prompt.

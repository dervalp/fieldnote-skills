---
name: fieldnote-yolo-deliver
description: Build a spec written by fieldnote-yolo-brainstorm all the way to one green feature pull request without asking a single question — slices run as parallel waves of sub-pull-requests into a feature branch, merged by the agent, and every decision taken without asking is written down as an outbox item for a human to answer later. Use when someone says "yolo it", "build it overnight", "deliver without asking", or runs the command fieldnote-yolo-brainstorm printed. Never merges into the base branch.
stage: build
variance: configured
surface: code
version: 0.1.0
release: skills-v0.1.0
---

# Fieldnote Yolo Deliver

Hand it a spec id. It builds the whole feature and stops at **one green pull request into the base
branch**, which a human merges. Nothing is asked along the way.

How it differs from `fieldnote-deliver`:

| | `fieldnote-deliver` | `fieldnote-yolo-deliver` |
| --- | --- | --- |
| Input | a PRD with ticketed child issues | an inbox file and its plan |
| Each slice | a pull request into the base branch | a sub-pull-request into `feat/<topic>` |
| Who merges a slice | a human | **this skill**, into the feature branch only |
| An unclear point | the slice stops, needs clarification | an outbox item, and the slice carries on |
| Runs | one wave, then stops | every wave, then the feature pull request |

**The one exception to "never merge".** This skill merges a slice's sub-pull-request into its own
feature branch. It never merges into `Git → baseBranch`, never adds a label that waves a check
through, never bypasses branch protection. If a merge command would target the base branch, stop.

## Before you start: the profile

Facts come from `.fieldnote/profile.md` — `(none)` decided, a value used, absent or `TODO` looked up
in the repository and stated in one line. This skill reads `Docs → inbox`, `Docs → plans`,
`Docs → outbox` (set: the outbox is **on**; `(none)` or absent: **off**), `Tracker → kind`,
`Labels → feature`, `Labels → sub`, `Merge policy → specOnMain`, `Parallelism → waveSize`,
`Commands → preflight`, `Docs → ciTriage`, `Git → baseRemote`, `Git → baseBranch`.

Run the CLI as `npx github:dervalp/fieldnote-skills outbox …`.

## Input

A spec id: `/fieldnote-yolo-deliver 1015` (a PRD issue number) or `/fieldnote-yolo-deliver 20260923`
(a file-tracked spec). A path to the inbox file also works.

## Process

### 1. Find the spec

Look for `<Docs → inbox>/<id>-*.md` on the base branch, then on the feature branches:
`git ls-remote --heads <baseRemote> 'feat/*'`, then for each candidate branch
`git ls-tree -r --name-only <branch> -- <Docs → inbox>/` and match the entry starting with `<id>-` —
`git show` does not expand a glob, so read that exact path with `git show <branch>:<path>`. The
branch that holds it is the feature branch.

- **Not found** — stop: "No inbox file for `<id>`. Run `/fieldnote-yolo-brainstorm` first."
- **`specOnMain` is `true`** and the inbox file is not on the base branch yet — stop and name the
  docs-only pull request waiting for a merge. Do not build.
- **`blocked-by`** names an id whose feature pull request is not merged — stop and say which. Once
  every blocker's feature pull request is merged, its inbox file lives on `<baseRemote>/<baseBranch>`
  — merge that into `feat/<topic>` (below) before running `outbox check`, so the blockers' inbox
  files are present in this checkout.
- **`plan: none`** — write the plan now, following step 5 of `fieldnote-yolo-brainstorm` (slices,
  territories, waves), commit it to the feature branch, set `plan:`, run `outbox check`. Then go on.

Work in a worktree of the feature branch. When a declared blocker's feature pull request has just
merged, merge `<baseRemote>/<baseBranch>` into it first. Then run `outbox check`; red stops here —
the spec is broken, and building on it would be worse — **except** `blocked-by N names no inbox
file`, which is expected while `N`'s inbox file lives only on its own unmerged `feat/<topic>` branch
and is not in this checkout yet. That one failure is never "fixed" by removing the dependency; every
other red means the file is wrong.

### 2. Build the board

Read the plan's slices and waves. For each slice, find its sub-pull-request:
`gh pr list --base feat/<topic> --state all --search "<id> <slice id> in:title"`. Classify:

- **done** — its sub-pull-request is merged;
- **in-flight** — an open sub-pull-request (finish it in step 4, don't start another);
- **blocked** / **stopped** — a previous run returned that; its outbox item or stop note says why;
- **runnable** — every slice it `Needs` is done, and it is not in-flight;
- **waiting** — anything else.

Print the board. **Idempotent:** a re-run only takes what is not done.

### 3. Run the next wave

The wave is the runnable slices of the earliest unfinished wave, at most `Parallelism → waveSize`.

For each slice, start **one isolated worktree subagent**, all in one message so they run in parallel.
Each gets exactly:

> Implement slice `<slice id>` of `<inbox file>` using `fieldnote-do-work`, **dispatched by
> fieldnote-yolo-deliver**:
> - feature branch: `feat/<topic>` — branch off it, open your pull request into it, label
>   `<Labels → sub>`, title `<type>(<scope>): <goal> [<id> <slice id>]`, body `Part of #<id>` (or the
>   inbox path when there is no issue);
> - the slice: `<the slice's block from the plan, verbatim>`;
> - territory: `<paths>` — leaving it is a decision, not a detail;
> - outbox: **on**, folder `<Docs → outbox>/<id>/`, wave `<n>` | **off**;
> - run `<Commands → preflight>` before every push: a sub-pull-request may get no CI run, so this is
>   its grade;
> - **never ask a question**; return `done`, `stopped` or `blocked`, the pull request link, and the
>   outbox item files you wrote.

Keep your own context small: take back only the result, never the subagent's transcript.

### 4. Merge the wave into the feature branch

For each `done` slice, one at a time:

1. update its branch from `feat/<topic>` (`gh pr update-branch <n>`) and wait for its checks, if any
   run;
2. red, or a conflict you cannot resolve inside the slice's territory: send it back to its subagent
   once; still red — mark the slice `stopped` with the reason, leave the pull request open, go on;
3. green: `gh pr merge <n> --squash --delete-branch`. **Confirm the base is `feat/<topic>`** before
   merging (`gh pr view <n> --json baseRefName`) — anything else, stop.

A `blocked` slice left an outbox item ranked `human-action`; a `stopped` one left a note on its pull
request. Neither stops the wave.

### 5. Repeat

Back to step 2, until nothing is runnable. Slices that wait on a `stopped` or `blocked` slice stay
waiting — say which.

### 6. The feature pull request

1. Merge `<baseRemote>/<baseBranch>` into `feat/<topic>`; resolve conflicts; run
   `Commands → preflight`.
2. Run `outbox check`. Red: fix the file it names — an item or an inbox file — they are part of the
   deliverable.
3. Open (or update) **one** pull request, `feat/<topic>` → `<baseBranch>`, label `Labels → feature`,
   title in Conventional Commit form, body built with `fieldnote-pull-request`, plus:

   ```markdown
   Closes #<id>            <!-- only with a GitHub tracker -->
   Spec: `<inbox file>` · Plan: `<plan>`

   ## Slices

   | Slice | State | Pull request |
   | ----- | ----- | ------------ |

   ## Outbox

   <the output of `outbox open <id>`, or "Nothing open." or "Outbox off.">
   Answer each item on <the PRD issue | this pull request>, starting with
   `Verdict: agreed` or `Verdict: drifted`.
   ```

   `outbox open <id>` exits 1 whenever items are open — read here for its printed list, not for its
   exit code.

4. Watch the checks to green. On red: read the failing log, then `Docs → ciTriage` when it exists;
   fix, preflight, push. **Three attempts**, then mark it draft and comment what is stuck.
5. With a GitHub tracker and the outbox on, run `outbox comment <id>`.

### 7. Report and stop

One short report: the feature pull request and its check state; slices done / stopped / blocked; the
open outbox items, worst first, from `outbox open <id>` — again read for its list; its exit code is 1
whenever items are open, which is not a failure here. Then stop. **Never merge into the base
branch.** Open items do not block the merge by themselves — the Outbox section is how a human finds
them.

## Settling, later

A human answers an item; then anyone — this skill on a re-run, or the human — settles it:

```bash
fieldnote-skills outbox settle <item file> --verdict agreed|drifted --answer <file|->
```

Commit the removed item and the appended `settled.md` together, then re-run `outbox comment <id>`.
A **drifted** answer stays open in `settled.md` (`Closed: no`) until a change reworks the feature;
this skill does not rework it on its own.

## Guardrails

- **Never merge into the base branch.** The only merges are sub-pull-requests into `feat/<topic>`.
- **Never ask.** Everything you would have asked is an outbox item — or, with the outbox off, a
  `stopped` slice.
- **Never invent a rationale** in an outbox item; what you could not know is written as a gap.
- **Never lower a rank.** `outbox check` refuses a rank below its floor; raise it.
- **Idempotent.** A re-run takes only what is not done.
- **One pull request into the base branch per spec.**

## References

- Spec and plan: written by `fieldnote-yolo-brainstorm`.
- Each slice: `fieldnote-do-work` (its "When dispatched by `fieldnote-yolo-deliver`" section),
  `fieldnote-pull-request`.
- The rules for inbox files and outbox items: `fieldnote-skills outbox check`.

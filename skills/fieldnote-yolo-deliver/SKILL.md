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
`Commands → preflight`, `Commands → check`, `Docs → ciTriage`, `Git → baseRemote`,
`Git → baseBranch`.

**The grade before a push** is `Commands → preflight`; when that key is absent, `Commands → check`;
when both are absent, push without one and say so in the report. **Never ask** for either.

Run the CLI as `npx github:dervalp/fieldnote-skills outbox …` (or `fieldnote-skills outbox …` where
it is installed). Below, `outbox …` is short for that.

**The feature branch is shared.** Before any commit or merge on `feat/<topic>`, fetch it and
fast-forward: `git fetch <baseRemote>` then `git merge --ff-only <baseRemote>/feat/<topic>`. Push
every commit you make as soon as it is made. **Never force-push.**

## Input

A spec id: `/fieldnote-yolo-deliver 1015` (a PRD issue number) or `/fieldnote-yolo-deliver 20260923`
(a file-tracked spec). A path to the inbox file also works.

## Process

### 1. Find the spec

1. `git fetch <baseRemote>`.
2. **Find the inbox file.** Look for the entry starting with `<id>-` in
   `git ls-tree -r --name-only <baseRemote>/<baseBranch> -- <Docs → inbox>/`. When it is not there,
   search the feature branches only to find the file: list them with
   `git for-each-ref --format='%(refname:short)' refs/remotes/<baseRemote>/feat/`, and run the same
   `git ls-tree` on each. `git show` does not expand a glob, so read the exact path you found with
   `git show <ref>:<path>`.
3. **Read the feature branch** from the inbox file's Handoff `Branch:` line — never from the ref the
   file happened to be found on. Confirm it exists: `git ls-remote --exit-code --heads <baseRemote>
   <branch>`. The base branch is never the feature branch: a `Branch:` line naming
   `Git → baseBranch`, or a branch the remote does not have, stops here and says so.

Then:

- **Not found** — stop: "No inbox file for `<id>`. Run `/fieldnote-yolo-brainstorm` first."
- **`specOnMain` is `true`** and the inbox file is not on the base branch yet — stop and name the
  docs-only pull request waiting for a merge. Do not build.
- **`blocked-by`** names an id whose feature pull request is not merged — stop and say which.
- **`plan: none`** — write the plan now, following step 5 of `fieldnote-yolo-brainstorm` (slices,
  territories, waves), commit it to the feature branch, set `plan:`, push, run `outbox check <id>`.
  Then go on.

Work in a worktree of the feature branch, fast-forwarded as above. When a declared blocker's feature
pull request has merged, merge `<baseRemote>/<baseBranch>` into the feature branch and push, so the
blockers' inbox files are in this checkout. Then run `outbox check <id>`; red stops here — the spec
is broken, and building on it would be worse.

### 2. Build the board

Read the plan's slices and waves. For each slice, find its sub-pull-request:
`gh pr list --base feat/<topic> --state all --search "<id> <slice id> in:title"`, then keep only the
pull requests whose title ends with exactly `[<id> <slice id>]` — the search also matches `s1` inside
`s12`. When the feature pull request is already open, read its **Slices** table too: it is where a
previous run recorded which slices were `blocked` or `stopped`, and why. Classify:

- **done** — its sub-pull-request is merged and the Slices table does not say `blocked`;
- **blocked** — the Slices table says so; its sub-pull-request, merged, carried its `human-action`
  outbox item onto the feature branch;
- **stopped** — the Slices table says so, with the reason;
- **in-flight** — an open sub-pull-request (finish it in step 4, don't start another);
- **runnable** — every slice it `Needs` is done, and it is none of the above;
- **waiting** — anything else.

Print the board. **Idempotent:** a re-run only takes what is not done, blocked or stopped.

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
> - territory: `<paths>`, plus the outbox folder — leaving it is a decision, not a detail;
> - outbox: **on**, folder `<Docs → outbox>/<id>/`, wave `<n>` | **off**;
> - before every push run `<Commands → preflight>` (or `<Commands → check>`, or "none — say so"): a
>   sub-pull-request may get no CI run, so this is its grade;
> - **never ask a question**. `done` or `blocked`: push and open the pull request — a `blocked`
>   slice's pull request carries its outbox item files and any work safe to keep. `stopped`: push
>   nothing. Return the state, the pull request link (none when stopped), the stop reason, and the
>   outbox item files you wrote.

Keep your own context small: take back only the result, never the subagent's transcript.

### 4. Merge the wave into the feature branch

For each `done` or `blocked` slice, one at a time:

1. update its branch from `feat/<topic>` (`gh pr update-branch <n>`) and wait for its checks, if any
   run — **at most 30 minutes**, then treat them as red;
2. red, or a conflict you cannot resolve inside the slice's territory: send it back to its subagent
   once; still red — mark the slice `stopped` with the reason, leave the pull request open, go on;
3. green: **confirm the base is `feat/<topic>`** (`gh pr view <n> --json baseRefName`) — anything
   else, stop. Then `gh pr merge <n> --squash --delete-branch`, and confirm with
   `gh pr view <n> --json state` that it reads `MERGED`. A local branch-delete error after a merge
   that succeeded is not a failure. **Never retry a merge** — read the state instead.

A merged `blocked` slice is recorded as `blocked`: its `human-action` item is now on the feature
branch, where the Outbox section and `outbox open <id>` find it. A `stopped` slice has no pull
request to merge. Record every stop reason in two places: the **Reason** column of the feature pull
request's Slices table (step 6), and a comment — on the PRD issue with a GitHub tracker, or on the
feature pull request with a file tracker, posted once it is open in step 6. Neither state stops the
wave.

### 5. Repeat

Back to step 2, until nothing is runnable. Slices that wait on a `stopped` or `blocked` slice stay
waiting — say which.

### 6. The feature pull request

1. Fetch and fast-forward `feat/<topic>`, merge `<baseRemote>/<baseBranch>` into it, resolve
   conflicts, run the grade (`Commands → preflight`, or `Commands → check`), push.
2. Run `outbox check <id>`. Red: fix the file it names — an item or an inbox file; it is part of the
   deliverable. Commit and push the fix.
3. Open (or update) **one** pull request, `feat/<topic>` → `<baseBranch>`, label `Labels → feature`,
   title in Conventional Commit form, body built with `fieldnote-pull-request`, plus:

   ```markdown
   Incomplete: <n> slices stopped or blocked — see Slices.
   Closes #<id>
   Spec: `<inbox file>` · Plan: `<plan>`

   ## Slices

   | Slice | State | Reason | Pull request |
   | ----- | ----- | ------ | ------------ |

   ## Outbox

   <the output of `outbox open <id>`, or "Nothing open." or "Outbox off.">
   Answer each item on <the PRD issue | this pull request>, starting with
   `Verdict: agreed` or `Verdict: drifted`.
   ```

   - **Every slice done:** drop the `Incomplete` line and write `Closes #<id>` (with a GitHub
     tracker; nothing with a file tracker).
   - **Any slice stopped or blocked:** keep the `Incomplete` line as the first line, write
     `Part of #<id>` instead of `Closes #<id>` — a partial build never closes the spec — and open the
     pull request as a **draft**.
   - **Reason** is empty for a `done` slice and says why for a `stopped` or `blocked` one.

   `outbox open <id>` exits 1 whenever items are open — read here for its printed list, not for its
   exit code.

4. Watch the checks to green. On red: read the failing log, then `Docs → ciTriage` when it exists;
   fix, run the grade, push. **Three attempts**, then mark it draft and comment what is stuck.
5. With a GitHub tracker and the outbox on, run `outbox comment <id>`.

### 7. Report and stop

One short report: the feature pull request and its check state; slices done / stopped / blocked,
with each stop reason; which grade ran before pushes (or that none was configured); the open outbox
items, worst first, from `outbox open <id>` — again read for its list; its exit code is 1 whenever
items are open, which is not a failure here. Then stop. **Never merge into the base branch.** Open
items do not block the merge by themselves — the Outbox section is how a human finds them.

## Settling, later

A human answers an item; then the human, or an agent they ask, settles it:

```bash
outbox settle <item file> --answer <file|->
```

The verdict is the answer's `Verdict: agreed` or `Verdict: drifted` line; `--verdict agreed|drifted`
may give it instead, and when both are given they must agree. Commit the removed item and the
appended `settled.md` together, then re-run `outbox comment <id>`. A **drifted** answer stays open in
`settled.md` (`Closed: no`) until a change reworks the feature; this skill does not rework it on its
own.

## Guardrails

- **Never merge into the base branch.** The only merges are sub-pull-requests into `feat/<topic>`.
- **Never force-push.** Fetch and fast-forward `feat/<topic>` before any commit or merge; push every
  commit you make.
- **Never ask.** Everything you would have asked is an outbox item — or, with the outbox off, a
  `stopped` slice.
- **Never invent a rationale** in an outbox item; what you could not know is written as a gap.
- **Never lower a rank.** `outbox check` refuses a rank below its floor; raise it.
- **Idempotent.** A re-run takes only what is not done, blocked or stopped.
- **One pull request into the base branch per spec**, and it closes the spec only when every slice is
  done.

## References

- Spec and plan: written by `fieldnote-yolo-brainstorm`.
- Each slice: `fieldnote-do-work` (its "When dispatched by `fieldnote-yolo-deliver`" section),
  `fieldnote-pull-request`.
- The rules for inbox files and outbox items: `outbox check`.

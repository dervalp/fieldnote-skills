---
name: fieldnote-deliver
description: Drive a PRD/epic to completion wave by wave. Give it a PRD (or epic) issue reference; it discovers the remaining child issues, builds the dependency graph, computes which are takeable now (open, ready-for-agent, all blockers merged, no PR yet), and runs that frontier as one parallel wave — then stops at the human-merge gate. Use when you have a PRD/epic whose children are already ticketed and want to keep shipping the next takeable slices without hand-picking issue numbers. Re-run after merging to advance the next wave naturally. Composes fieldnote-parallel-wave; does not invent issues and never merges.
stage: build
variance: configured
surface: code
version: 0.1.0
release: skills-v0.1.0
---

# Fieldnote Deliver

Hand this skill a **PRD/epic** and it takes the next takeable work automatically — no listing issue
numbers. It reads the epic's children, figures out the dependency frontier, and runs it as a parallel
wave by delegating to [`fieldnote-parallel-wave`](../fieldnote-parallel-wave/SKILL.md). Each run advances the
front; you merge between runs — the human-merge gate is the only path code enters the mainline (see
References).

The dependency/frontier logic here is **tooling-agnostic** — it never names a package manager, test
runner, or language. Anything stack-specific is delegated down to `fieldnote-parallel-wave` and, through
it, the repo's implementation skill and verification gate.

Single responsibility: this skill **finds the next wave**; `fieldnote-parallel-wave` **runs a wave**;
[`fieldnote-do-work`](../fieldnote-do-work/SKILL.md) + [`fieldnote-pull-request`](../fieldnote-pull-request/SKILL.md)
do each slice. It **does not create issues** — breaking a PRD into issues happens earlier — and **never
merges**.

## When to use / not use

- **Use** when you have a PRD/epic whose children are already ticketed and you want to keep shipping the
  next takeable slices without hand-picking issue numbers.
- **Do not use** to break a PRD into issues, to merge, or when nothing is ticketed yet.

## Input

A PRD/epic issue reference (`/fieldnote-deliver 307`), or a label/prefix that identifies the family.
Default tracker is the current repository's GitHub remote; PRs target `upstream/main`.

## Process

### 1. Discover the children (try several signals, then report)

GitHub has no single parent link, so resolve the child set by combining, in priority order:

1. **Sub-issues / task list** on the epic body (`- [ ] #NNN`) — if present, authoritative.
2. **Shared label** (e.g. an epic label) across issues.
3. **Title prefix** convention (e.g. `[EVAL-UI-V1]`) — read it from the epic if it names one.
4. **Body back-reference** — however this repository's child issues reference their parent per
   `Tracker → epicLink` in `.fieldnote/profile.md` (a sub-issue relation, a project field, or a body
   reference such as `Parent … #<epic>`) (`gh issue list --search "#<epic> in:body"`).

**Print what you found** — the resolved child set and which signal matched — so the human can catch a
miss before any work starts. If the set is empty or ambiguous, stop and ask.

### 2. Build the board

For each child, `gh issue view <n>`: capture **state** (open/closed), **labels** (does it carry the
label named under `Labels → ready` in `.fieldnote/profile.md`?), **the blocker relation** (however
`Tracker → blockedBy` expresses it), and whether it **already has an open PR** (a linked PR or a
`Closes #<n>` PR — `gh pr list --search "<n>"`). Classify each:

- **done** — closed (or its PR merged)
- **in-flight** — open issue with an open PR (do not re-run)
- **needs clarification** — open and otherwise takeable, but its **acceptance criteria are missing,
  ambiguous, or contradictory** (no clear "done" condition, or it conflicts with the PRD/ADR it cites).
  See the readiness check below.
- **runnable now** — open, carrying the `ready` label from the profile, **all blockers done**, **no
  open PR**, **and acceptance criteria are workable**
- **still blocked** — open, but a blocker is not yet done

**Acceptance-criteria readiness check.** Before an issue counts as "runnable now", confirm it states a
clear, testable "done" condition that doesn't contradict the PRD/ADR it cites. STOP and bucket it as
**needs clarification** (do not dispatch it) when criteria are:

- **missing** — no acceptance criteria / scope is "figure it out",
- **ambiguous** — criteria readable two materially different ways, or a key term is undefined, or
- **contradictory** — criteria conflict with each other, with the epic/PRD, or with the cited ADR.

This is a cheap pre-flight scan, not a deep design review — the subagent reads the ADR/PRD in full and
can still return `needs clarification` later (see `fieldnote-parallel-wave`).

### 3. Show the board, then take the frontier

Present a compact board (done / in-flight / needs-clarification / runnable-now / still-blocked, with the
blocking issue or clarification reason noted). The **frontier = the "runnable now" set** — it
**excludes** anything bucketed `needs clarification`.

- For each **needs clarification** issue, print one line naming **what is missing/ambiguous/contradictory
  and the specific question to resolve it** so the human can fix the issue before it's takeable. These
  are held out of the wave, exactly like blocked issues — never dispatched on a guess.
- If the frontier is **non-empty**: run it by invoking **`fieldnote-parallel-wave`** with exactly those
  issue numbers. That skill handles worktree isolation, the concise-result returns, and one-PR-per-issue.
- If the frontier is **empty** but open issues remain: report that everything left is waiting on a
  **merge** (name which open PRs must merge to unblock what) and stop — there is nothing to take until a
  human merges.
- If **no open issues remain**: the epic is delivered — say so.

### 4. Report progress + the next step

After the wave returns, show: **X of N children done**, this wave's **PR links + checks**, and **what
unblocks once these merge**. End with the natural next action: *"merge these, then re-run
`/fieldnote-deliver <epic>` to take the next wave."*

## Loop behaviour

**One wave per invocation by default** — this is the "take the next task naturally" loop: run it, it
picks up wherever the graph currently is; you merge; re-run to advance. A fully autonomous multi-wave
loop is intentionally **not** the default because every wave ends at the human-merge gate — advancing
past it without a human would either stall or stack branches off un-merged work.

## Guardrails

- **Never merge**; **never create issues**; **never combine issues into one PR** (all inherited via
  `fieldnote-parallel-wave`).
- **Idempotent** — skip `done` and `in-flight` issues, so re-running only takes genuinely new work.
- **Report discovery** before acting — never silently guess the child set.
- **Auto-exclude blocked issues** (a blocker not yet merged) and say what is waiting on what.
- **Gate on acceptance criteria** — STOP and bucket an issue as `needs clarification` (do not dispatch)
  when its criteria are missing, ambiguous, or contradictory; report the specific question to resolve.
- Each slice branches off `upstream/main` and pushes to `upstream` (via the delegated skills).

## References

- Runs a wave: [`fieldnote-parallel-wave`](../fieldnote-parallel-wave/SKILL.md)
- Implementation / PR: [`fieldnote-do-work`](../fieldnote-do-work/SKILL.md),
  [`fieldnote-pull-request`](../fieldnote-pull-request/SKILL.md)
- Breaking a PRD into ticketed issues is a prerequisite — this skill only runs once issues already exist
- Human-merge-only is a house rule, not a single ADR: no subagent merges its own PR

---
name: fieldnote-parallel-wave
description: Implement a set of mutually-independent, ready-for-agent issues concurrently — one isolated worktree subagent per issue, each ending in its own PR — while keeping the orchestrator's context small and stopping at the human-merge gate. Use when several issues are unblocked at once (a "wave") and running them one-by-one would be slow; composes fieldnote-do-work + fieldnote-pull-request. Not for dependent issues, not for merging.
stage: build
variance: configured
surface: code
version: 0.1.0
release: skills-v0.1.0
---

# Fieldnote Parallel Wave

Run a **wave** of independent issues at once. Each issue is implemented by its **own subagent in its
own git worktree**, ending in its **own PR**. The point is twofold: **speed** (slices run in parallel,
not one-by-one) and **bounded context** — a subagent's tool I/O never enters this conversation, so the
orchestrator only ever accumulates each slice's short final result, not its full transcript. No
`/compact` needed: the bloat never arrives.

This skill **composes** `fieldnote-do-work` (implementation) and
[`fieldnote-pull-request`](../fieldnote-pull-request/SKILL.md) (the PR). It **never merges** — human merge is
the only path code enters the mainline.

The orchestration here is **tooling-agnostic**: it never names a package manager, test runner, or
language. The stack-specific details live behind two repo-local seams it delegates to — the
**implementation skill** (`fieldnote-do-work`, which reads the repository's own rules from
`.fieldnote/concerns/` rather than owning any language or framework doctrine itself) and the
**verification gate** (`CLAUDE.md` › Verification, the repo's check commands). Swap those two and the
wave logic is unchanged.

## When to use / not use

- **Use** when 2+ issues are *currently unblocked* (all their blockers already merged to `main`) and
  touch different areas, so they can be built and PR'd independently.
- **Do not use** for issues that depend on each other in the same wave (you'd stack branches off
  un-merged work). Run them in successive waves instead, merging between.
- **Do not use** to merge, to combine issues into one PR, or for a single issue (just use
  `fieldnote-do-work` + `fieldnote-pull-request` directly).
- For very large waves (>~8) or when you want deterministic retry/verify stages, prefer the
  **Workflow** tool — it isolates the same way but with structured control flow.

## Inputs

Issue numbers (`/fieldnote-parallel-wave 308 309`) or a label/milestone to resolve into a list. Default
tracker is the current repository's GitHub remote; PRs target `Git → baseBranch` on `Git → baseRemote`
in `.fieldnote/profile.md` (an ordinary clone with no profile Git section: `origin`/`main`).

## Process

### 1. Resolve & guard the wave (do this before launching anything)

For each issue, `gh issue view <n>` and read its **`Blocked by`**.

- **Auto-exclude** any issue whose blockers are **not closed/merged**, and any issue blocked by another
  issue **in the same wave**. Excluding is the default — do not run a blocked slice.
- **Gate on acceptance criteria.** Also auto-exclude any issue whose acceptance criteria are **missing,
  ambiguous, or contradictory** (no clear testable "done" condition, or a conflict with the epic/PRD or
  cited ADR). STOP on it and mark it **needs clarification** rather than dispatching a subagent on a
  guess — a wasted worktree is the expensive failure this gate prevents.
- Print a short pre-flight: which issues will run, and which were **excluded and why** (e.g. "skipped
  #310 — blocked by #308, not yet merged"; "skipped #312 — needs clarification: acceptance criteria
  don't say which route the list calls"). Blocked ones become a later wave; needs-clarification ones go
  back to the human to fix.
- If nothing is runnable, stop and say so.

### 2. Sync the base once

`git fetch <Git → baseRemote> <Git → baseBranch>` (`.fieldnote/profile.md`; `git fetch origin main`
absent a profile) so every worktree branches off the current base. Never branch off a stale local
copy of the base branch.

### 3. Fan out — one isolated subagent per issue, in a single message

Launch all runnable issues **concurrently** (one message, multiple Agent calls) with
**`isolation: "worktree"`** so parallel edits cannot collide.

**Right-size each agent's model first (cost lever).** Don't default the fan-out to the most capable
tier — a wave multiplies whatever you pick. Gauge each issue and assign the cheapest **capability tier**
that fits (see `fieldnote-do-work` › *Right-Size The Model* for the tiers): the small/cheap tier for mechanical/codemod
slices, the mid tier for well-specified pattern-following slices (the default for most slices here), the
top tier only for genuinely judgment-heavy ones. When an issue's shape is unclear, scope it first with a
cheap **read-only exploration agent** (e.g. an `Explore` agent on the small/mid tier) and pick the tier
from what it finds. Note the chosen tier per issue in the pre-flight. Keep the orchestrator (you) on the
top tier; push the work down.

Give each subagent this contract:

> Implement issue #<n> end-to-end and open its PR. Read `gh issue view #<n>`, the ADR/PRD it
> references, `CLAUDE.md`, and the repo's convention docs. Implement **only this issue's scope**
> using the repo's implementation skill (`fieldnote-do-work`). Verify by running the project's
> **verification gate** — the commands in `CLAUDE.md` › Verification (typecheck, tests, lint, and any
> layering/arch checks). The PR is gated on it passing. Open the PR
> using the `fieldnote-pull-request` skill: branch off `Git → baseBranch` on `Git → baseRemote` (from
> `.fieldnote/profile.md`; `origin`/`main` absent a profile), push to that same remote,
> base `Git → baseBranch`, body containing `Closes #<n>`, a Conventional-Commit title, and the
> `Co-Authored-By` trailer. **Do not merge. Do not touch other issues' scope.**
>
> **If, after reading the ADR/PRD in full, the acceptance criteria are missing, ambiguous, or
> contradictory, STOP — do not implement or open a PR on a guess.** Return
> `{ issue, status: "needs-clarification", reason: "<what is unclear/conflicting + the question to resolve it>" }`
> instead. Otherwise return **only** a compact result — do **not** include diffs, file dumps, or full
> logs:
> `{ issue, status: "done", branch, prUrl, checks: "pass"|"fail", summary: "<one line>", risks: "<any>|none" }`.

The concise-return rule is load-bearing: it is what keeps the orchestrator's context small.

### 4. Aggregate

Collect the subagents' results into one table — **issue · PR URL · checks · one-line summary ·
risks/notes**. For any `checks: "fail"` or missing PR, state the reason and a suggested next step
(re-run that single issue, or open a follow-up). For any `status: "needs-clarification"`, show its
**reason + the question to resolve** instead of a PR link, and route it back to the human (no PR was
opened, by design). Partial waves are fine; report honestly.

### 5. Stop at the merge gate; point at the next wave

**Never merge.** End with: "Review + merge these, then the next wave unblocks: #<list of issues whose
blockers are exactly this wave>." Recompute that from the same `Blocked by` graph read in step 1.

## Guardrails

- **Never merge** (human merge is the only code-introduction path).
- **One issue per worktree / branch / PR** — never combine two issues into one PR.
- **Refuse unmerged-blocker issues** (auto-exclude + report) — do not stack branches off un-merged work.
- **Refuse unworkable issues** — if acceptance criteria are missing, ambiguous, or contradictory, STOP
  and return `needs-clarification` (orchestrator pre-flight or subagent), never a guessed PR.
- **Subagents return concise results only** — no diffs/logs — to protect the orchestrator's context.
- **Branch off `Git → baseBranch` on `Git → baseRemote`** every time (`.fieldnote/profile.md`;
  `origin`/`main` absent a profile); push to that same remote.
- Worktrees are auto-cleaned by the harness when unchanged.

## References

- Implementation: `fieldnote-do-work`
- PR authoring: [`fieldnote-pull-request`](../fieldnote-pull-request/SKILL.md)
- Human-merge-only is a house rule, not a single ADR: no subagent merges its own PR

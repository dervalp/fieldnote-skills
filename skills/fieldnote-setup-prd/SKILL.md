---
name: fieldnote-setup-prd
description: Take a settled design straight to a ticketed epic in one pass — synthesize the PRD, then decompose it into tracer-bullet child issues with a wired-up dependency graph, publishing both. Use when a design is settled (straight out of a brainstorm/grill) and the user says "set up the PRD", "PRD it", or otherwise wants the PRD and the issue breakdown done together rather than as two separate steps. Presents ONE consolidated review and pauses only when a seam, slice, or dependency decision is genuinely ambiguous.
stage: plan
variance: configured
surface: code
version: 0.1.0
release: skills-v0.1.0
---

# Fieldnote Setup PRD

One command from a **settled design** to a **ticketed epic**: it writes the PRD, breaks it into
tracer-bullet vertical slices, wires the dependency graph, and publishes the parent PRD plus every
child issue — in a single pass, behind a **single review**. It exists because writing the PRD and then
decomposing it into issues as two separate ceremonies is friction when the design is already settled
and the author usually agrees with the recommended slicing; what actually matters is **tracer-bullet
slices** and **correct dependencies**, so those are what this skill makes you confirm.

Single responsibility: this skill **turns a settled design into a published epic**. It does not
brainstorm or grill (that happened first), does not implement, and does not merge. Implementation is
`fieldnote-deliver` → `fieldnote-parallel-wave`.

This skill doesn't invent a separate PRD shape or slicing discipline — it uses the same tracer-bullet
vertical-slice outline as the rest of this document: a PRD with a problem/solution/decisions/seams
outline (Step 3), one issue per slice with a wired dependency graph (Step 4), the label named under
`Labels → ready` in `.fieldnote/profile.md`, and the current repository's GitHub remote as the default
tracker. The only thing it adds is the **choreography**: PRD and issues publish together, behind one
review, instead of as two separate checkpoints.

## When to use / not use

- **Use** when a design is **settled** (typically straight out of a design-discussion / brainstorm
  session, or an approved plan) and the user wants it ticketed in one go — "set up the PRD", "PRD it",
  "PRD + issues".
- **Do not use** when the design is still fuzzy (grill/brainstorm first), when you only want the PRD with
  no issues yet, when issues already exist and you just want to ticket more, or to implement/merge
  (`/fieldnote-deliver`).

## Input

Whatever design is already in the conversation context, optionally a reference to a plan/issue/doc to
anchor on. Do **not** interview — synthesize what is already known from context. Default tracker is the
current repository's GitHub remote; child issues target the same repo.

## Process

### 1. Explore + synthesize (no interview)

Explore the repo to ground the work (current state, ADRs in the touched area, glossary vocabulary), then
draft the PRD from context, using the outline this skill presents at review (problem, solution, the key
implementation + testing decisions, the seams — see Step 3). Use the domain glossary's terms throughout.

### 2. Sketch the seams + the slices together

In one pass, work out **both** halves separately:

- the **test seams** (prefer existing seams, highest available, propose new ones at the highest point),
  and
- the **tracer-bullet vertical slices** (each slice cuts through every layer end-to-end, demoable on its
  own; prefer many thin slices; mark HITL vs AFK; wire `Blocked by`).

### 3. ONE consolidated review

Present a single checkpoint containing: the **PRD outline** (problem, solution, the key implementation +
testing decisions, the seams) **and** the **numbered slice breakdown** (title · HITL/AFK · Blocked by ·
user stories covered) **and** the resulting **dependency graph / frontier** (what's takeable first, what
unblocks what). Give your recommended answer for every open choice. The author usually agrees — so frame
it as "here's the plan, flag anything off" and let a single approval ("yep") cover the whole thing.

**Pause earlier — before this review — only when a decision is genuinely ambiguous**, specifically a
**seam, a slice boundary, or a dependency edge** that you cannot resolve from context and that materially
changes the breakdown. When you must ask, follow the repo's grill habit: for a fuzzy concept/term use a
short **prose + proposal** question (not multiple-choice); ask one thing at a time. Do **not** pause for
choices with an obvious default or that you can settle from the code/ADRs — pick, note it, move on.

### 4. Publish (PRD first, then children in dependency order)

On approval, publish in this order so child `Blocked by` / `Parent` fields reference real numbers:

1. Publish the **PRD** to the tracker with the `ready` label from the profile.
2. Publish each **child issue** in **dependency order** (blockers first) — every child names its parent
   the way `Tracker → epicLink` in `.fieldnote/profile.md` says
   to (e.g. `## Parent #<prd>`), records its blockers the way `Tracker → blockedBy` says to (e.g. a
   `## Blocked by` section wired to real issue numbers, or "None - can start immediately"), and carries
   the `ready` label. One slice = one issue.

Do not close or modify any pre-existing parent issue beyond creating this PRD.

### 5. Report + hand off

Show the published **PRD number**, the **child issue table** (number · title · HITL/AFK · Blocked by),
and the **dependency shape** (the current frontier → what unblocks next). End with the natural next
action: **"run `/fieldnote-deliver #<prd>` to take the first wave."**

## Guardrails

- **One discipline, no reinvention** — this skill doesn't invent a separate PRD shape or slicing
  discipline; it uses the same outline and tracer-bullet rules stated earlier in this document, and only
  collapses the PRD-then-issues checkpoints into one.
- **One review, not many** — the value is skipping the per-phase ceremony; surface recommendations and
  take a single approval.
- **But never guess a slice or dependency** — if a seam, slice boundary, or dependency edge is genuinely
  ambiguous, STOP and ask (prose + proposal) before the consolidated review.
- **Tracer bullets + correct dependencies are the non-negotiables** — thin end-to-end slices, accurate
  `Blocked by` graph; this is what the author cares about most.
- **Publish in dependency order** so `Parent`/`Blocked by` reference real numbers; label everything
  with the `ready` label from the profile.
- **Never implement and never merge** — that's `/fieldnote-deliver` and the human-merge gate.

## References

- Delivering the epic once ticketed: [`fieldnote-deliver`](../fieldnote-deliver/SKILL.md)
- Human-merge-only is a house rule, not a single ADR: no subagent merges its own PR

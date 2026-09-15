# fieldnote skills — catalog

> Auto-generated. Do not edit by hand — run `npm run catalog`.

Install them all with `/plugin marketplace add dervalp/fieldnote-skills`,
or pick individually with `npx github:dervalp/fieldnote-skills`.

## Setup

- **fieldnote-setup-profile** (v0.2.0, universal) — Write this repository's .fieldnote/profile.md by reading the repository itself — its CI workflow, its written rules, its deploy configuration — and asking only about what the repository cannot answer. Use when a repository has no profile, when its profile is still full of TODO, or when someone says "set up the profile", "fill in the profile", "onboard this repo", or asks why a fieldnote skill keeps asking the same question.

## Plan

- **fieldnote-prd-to-plan** (v0.1.0, universal) — Turn a PRD into a multi-phase implementation plan using tracer-bullet vertical slices, saved as a local Markdown file in ./plans/. Use when the user wants to break down a PRD, create an implementation plan, plan phases from a PRD, or mentions "tracer bullets".
- **fieldnote-setup-prd** (v0.1.0, configured) — Take a settled design straight to a ticketed epic in one pass — synthesize the PRD, then decompose it into tracer-bullet child issues with a wired-up dependency graph, publishing both. Use when a design is settled (straight out of a brainstorm/grill) and the user says "set up the PRD", "PRD it", or otherwise wants the PRD and the issue breakdown done together rather than as two separate steps. Presents ONE consolidated review and pauses only when a seam, slice, or dependency decision is genuinely ambiguous.

## Build

- **fieldnote-deliver** (v0.1.0, configured) — Drive a PRD/epic to completion wave by wave. Give it a PRD (or epic) issue reference; it discovers the remaining child issues, builds the dependency graph, computes which are takeable now (open, ready-for-agent, all blockers merged, no PR yet), and runs that frontier as one parallel wave — then stops at the human-merge gate. Use when you have a PRD/epic whose children are already ticketed and want to keep shipping the next takeable slices without hand-picking issue numbers. Re-run after merging to advance the next wave naturally. Composes fieldnote-parallel-wave, which in turn hands implementation to fieldnote-do-work; does not invent issues and never merges.
- **fieldnote-do-work** (v0.1.0, templated) — Implement one slice of work to standard — confirm the ask is clear, right-size any delegated agent, work in tracer bullets test-first, respect the rules this repository wrote down, and carry it to a green pull request or an honest stop. Use when implementing, doing work, building a change, picking up a ticket, or starting to code.
- **fieldnote-parallel-wave** (v0.1.0, configured) — Implement a set of mutually-independent, ready-for-agent issues concurrently — one isolated worktree subagent per issue, each ending in its own PR — while keeping the orchestrator's context small and stopping at the human-merge gate. Use when several issues are unblocked at once (a "wave") and running them one-by-one would be slow; composes fieldnote-do-work + fieldnote-pull-request. Not for dependent issues, not for merging.

## Review

- **fieldnote-pr-monitor** (v0.1.0, templated) — Walk the open pull request board in rounds of five and land what main cannot break. For each pull request it either merges on the spot, presses Update branch and moves on, or labels the failure and hands it back. Reads no code — the CI harness and the agent reviewers already on each pull request are the review. Requires a Turbo monorepo and a package-graph evidence script this skill does not ship (see "Runs Here Only" below) — it will not work as-is outside that setup. Use when the board has stalled behind Update-branch turns, or when asked to "monitor the PRs", "drain the board", "merge what is safe". `--dry-run` prints every verdict and merges nothing.
- **fieldnote-pull-request** (v0.1.0, configured) — Fill this repository's own PR template with domain impact, business rules, validation evidence, risk, rollback, reviewer focus, and Conventional Commit-aware context. Use when preparing, reviewing, or updating a pull request for this repository.
- **fieldnote-testing** (v0.1.0, configured) — This repository's own testing conventions. Use when adding, changing, reviewing, or choosing tests; covers red-green-refactor, characterization tests, choosing test level, boundary cases at every validated edge, domain invariants, eval/scorer checks, UI workflow tests, and structured logging/correlation-id assertions.

_Total: 9 skill(s)._

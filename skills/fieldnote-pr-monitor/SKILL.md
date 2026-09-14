---
name: fieldnote-pr-monitor
description: Walk the open pull request board in rounds of five and land what main cannot break. For each pull request it either merges on the spot, presses Update branch and moves on, or labels the failure and hands it back. Reads no code — the CI harness and the agent reviewers already on each pull request are the review. Requires a Turbo monorepo and a package-graph evidence script this skill does not ship (see "Runs Here Only" below) — it will not work as-is outside that setup. Use when the board has stalled behind Update-branch turns, or when asked to "monitor the PRs", "drain the board", "merge what is safe". `--dry-run` prints every verdict and merges nothing.
stage: review
variance: templated
surface: code
version: 0.1.0
release: skills-v0.1.0
---

# Fieldnote PR Monitor

`main` is protected with strict status checks — when `Merge policy → strictStatusChecks` is `true` in
`.fieldnote/profile.md`, GitHub refuses a merge from a branch that is not up to date. Every pull
request therefore pays an Update-branch and a full CI turn, and the next merge re-stales everyone
behind it. One human presses those buttons in order, and that human is the bottleneck.

Most of those turns buy nothing. A pull request that only changes docs, a skill, or a workflow cannot
be broken by anything that landed on main. This skill spends the turns that are owed and skips the
ones that are not.

## The Standing Exception

`CLAUDE.md` and the session briefing say _"Never merge. A human merges."_ **This skill is the
operator's standing exception to that rule, and it is the only one.** Nothing else in this repository
may merge. Every merge here is an explicit, logged act with a printed reason.

## Never Read The Code

The review already happened. Each pull request carries a code-review agent and a QA agent, and the CI
harness grades the merged result. This skill judges _staleness_, never _quality_. Do not open a diff
to form an opinion about the change. The only diff that matters is which packages moved, and
`scripts/pr-evidence.mjs` reports that.

## The Round

Take the five oldest open pull requests, by creation date:

```bash
gh pr list --limit 100 --json number,title,createdAt --jq 'sort_by(.createdAt) | .[0:5] | .[].number'
```

Walk them in order and act on each, then re-batch. **Stop when a full round merges nothing and
updates nothing.** Report what happened.

**Oldest first, never most-recently-updated.** A pull request is updated by its own churn — a push,
a CI turn, a bot comment. So the board sorted by `updatedAt` is the board sorted by _how much is
still happening to each pull request_, which is exactly backwards: the one that has gone quiet
because it is green and ready sinks below the ones still being worked on, and a window of five never
reaches it again. That is not hypothetical. #381 sat green and `CLEAN` for eleven rounds, six deep on
an `updatedAt` board, while the skill reported "nothing to do" and pressed Update-branch on
newer pull requests above it. Creation order cannot starve anything: a pull request only ever moves
toward the front.

### Per Pull Request

Cheapest disqualifier first — only what survives all five gates costs an evidence record.

1. **Draft** (`isDraft`) — skip silently.
2. **A human spoke** — any entry in `humans.comments`, or any review at all. Hand it back; it is the
   operator's. Bots never count, and on this board bots are nearly all there is.
3. **Conflicting** (`mergeable: CONFLICTING`) — hand it back. Git has settled it, and a conflicting
   pull request runs no CI, so there is nothing to wait for either.
4. **A red check** — triage and label (below). Never re-run it.
5. **A pending check** — skip this round. It is judged again next round.

Then gather the evidence and judge:

```bash
node scripts/pr-evidence.mjs --pr <number>
```

Merge when **all three** hold; otherwise **update the branch**, do not wait for its CI, and go to
the next pull request:

1. `intersection` is empty — nothing main moved reaches a package this branch moves.
2. `mainMoved.gradingFiles` is empty — main landed no root guard and no workflow.
3. `mainMoved.buildFiles` is empty **or** `prMoves.packages` is empty — either main moved nothing
   that reaches a package, or this branch moves no package for it to reach.

```bash
gh pr merge <number> --admin --squash --delete-branch   # nothing on main can reach it
gh pr update-branch <number>                            # it must wait its turn
```

`--admin` is what gets past `strict`, and this skill only reaches for it when `Merge policy →
adminMerge` is `true` in `.fieldnote/profile.md` — the profile's confirmation that `enforce_admins` is
`false` and the operator holds admin. When `adminMerge` is `false`, this skill has no bypass: it
**updates the branch** instead of merging, every time, and waits its turn like everything else. Never
change the branch protection instead — that would remove the guardrail for every human and every other
agent, permanently, rather than for the pull requests this skill has cleared.

### The Rule, In One Line Each

`mainMoved.packages` is what landed on main since the branch left it, **plus everyone downstream**.
`prMoves.packages` is the same for the branch. Turbo computes both with `--filter=...[a...b]`, the
same filter the CI test jobs use.

- **Empty intersection → merge.** A docs-only, skills-only or prose-only pull request moves no package
  at all, so it intersects with nothing. That family lands for free, without a category list to
  maintain.
- **Non-empty intersection → wait.** Main moved something this branch's packages depend on, or the
  reverse. Either way a green CI on the old base is a green CI for code that no longer exists.
  Turbo is blind to anything outside a package, but those changes do not all reach the same distance,
  and the difference is what makes this skill useful rather than merely safe:

- **`gradingFiles` non-empty → wait, no judgement.** Main landed a root guard or a workflow. Those
  read the _whole_ merged tree — `check:file-naming` and `check:leftovers` read prose as readily as
  source — so one of them can redden a branch that moves nothing but markdown.
- **`buildFiles` non-empty → wait, unless the branch moves no package.** The lockfile, `turbo.json`,
  the base tsconfig and the coverage floor reach every package and nothing beyond one. A branch that
  moves no package has nothing here to break: the merged tree's code and lockfile are main's own.

That second line is not a nicety. Nearly every merge to main touches `pnpm-lock.yaml`, so treating
the two lists as one would put every branch behind an Update-branch turn forever and this skill would
land nothing at all.

**When the evidence is ambiguous, wait.** A wrong wait costs one CI turn. A wrong merge reddens main
for everyone.

### Print The Reason

Every merge prints one line naming the evidence that allowed it:

```text
#379 merge — prMoves.packages empty (docs/, .claude/); main moved pnpm-lock.yaml, which reaches
             packages only, and this branch has none
#383 wait  — intersection: payments-service, shared-ui
#381 wait  — main landed scripts/hook-pre-pr.mjs, a guard that reads every file
```

That line is the audit trail when a merge does redden main, and it is what makes this doctrine
improvable rather than a feeling.

## Evidence Goes Stale The Instant Something Merges

After **any** merge, re-fetch and recompute from scratch. Never carry an evidence record across a
merge, and never batch two merges from one gathering pass.

Reusing a record would let one round land two pull requests that are each harmless against main and
break each other — the exact failure this skill exists to prevent. **At most one pull request is
judged per state of main.**

## A Red Check Is Someone's, Not Yours

Never re-run a check, and never try to turn one green. Read the failing job and stamp who owns it:

```bash
gh run view <run-id> --log-failed
gh pr edit <number> --add-label <label>
```

| Label          | Means                                                                         |
| -------------- | ------------------------------------------------------------------------------ |
| `pr:needs-fix` | a real regression on this branch                                             |
| `pr:flaky`     | matches a known flake — see the doc named under `Docs → ciTriage` in the profile |
| `pr:infra`     | Railway, a fork's Postgres that never provisioned, and their kin             |

The label persists on the board, so the same pull request is not re-triaged every round and the
operator can see at a glance who owes what. A labelled pull request is skipped at gate 4 next round
without re-reading the log.

The three labels may not exist yet; `gh pr edit --add-label` fails on a label the repository does not
carry. Create the missing one and carry on rather than treating it as a stuck pull request:

```bash
gh label create pr:needs-fix --description 'A red check this branch caused' --color d73a4a
gh label create pr:flaky     --description 'A red check matching a known flake' --color fbca04
gh label create pr:infra     --description 'A red check the branch did not cause' --color 0e8a16
```

## When Something Refuses

- `gh pr merge --admin` refused → print it, stamp nothing, move on.
- Turbo errors or the graph will not build → **no evidence, so nothing merges that round.** Silence
  is never read as "no overlap".
- `--dry-run` prints the whole board and every verdict and merges nothing. Use it to check the
  doctrine before letting the skill loose.

## Runs Here Only

The evidence comes from Turbo's package graph, which does not exist outside this monorepo. The skill
takes no repository argument. Widening it is separate work.

## Later

The agent version of this is the same skill under `/loop`. Ship it, watch the printed reasons for a
few rounds, then let it run unattended.

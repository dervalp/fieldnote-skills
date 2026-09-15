# The delivery loop

Thirteen skills, one loop: an idea becomes a PRD, a PRD becomes issues, issues
become parallel waves of code, code becomes pull requests, and pull requests
get merged without a human re-checking what CI and the agent reviewers
already checked. Eight of the thirteen ship in this repository today. The
other five are designed, not yet built — see
[README § Status](../README.md#status) for why.

## Stage by stage

**Setup** — `fieldnote-setup-profile` *(shipped)*. Runs once per repository,
before anything else: writes `.fieldnote/profile.md` from what the repository
itself says, and pushes for a written definition of done, which is what every
later stage reads to decide whether it is finished.

**Brainstorm** — `fieldnote-brainstorming` *(not yet shipped)*. Runs before
any change is made: explores the idea, produces a before/after artifact and
acceptance scenarios in the domain's own language, and hands off cleanly so
planning can start cold.

**Plan** — `fieldnote-setup-prd` and `fieldnote-prd-to-plan` *(shipped)*.
`fieldnote-setup-prd` takes a settled design straight to a published PRD plus
its ticketed child issues, in one pass. `fieldnote-prd-to-plan` takes a PRD
you already have and breaks it into a phased plan of tracer-bullet vertical
slices.

**Build** — `fieldnote-parallel-wave` and `fieldnote-deliver` *(shipped)*.
`fieldnote-parallel-wave` runs a set of mutually independent, ready-for-agent
issues concurrently, one isolated worktree and one PR per issue.
`fieldnote-deliver` composes it: given a PRD or epic, it works out which
child issues are takeable right now and hands that frontier to
`fieldnote-parallel-wave`. Both stop at the human-merge gate. Both compose
`fieldnote-do-work` *(not yet shipped)* — the repository's own implementation
practice — to actually write the code.

**Fix** — `fieldnote-fix-bug` *(not yet shipped)*. The same loop entered from
a bug report instead of a PRD: reproduce it, prove the fix red before it's
made, fix through `fieldnote-do-work`, add the guard that would have caught
it, then open the PR.

**Review** — `fieldnote-pull-request` and `fieldnote-testing` *(shipped)*
shape what gets submitted and what gets tested.
`fieldnote-react-review` and `fieldnote-react-sweep` *(not yet shipped)*
audit React code against a repository's own component rules and burn down
the resulting backlog as issues run through `fieldnote-parallel-wave` — never
editing source, never merging.

**Drain** — `fieldnote-pr-monitor` *(shipped, `templated`)*. Walks the open
PR board in rounds and merges what main cannot break. It is the one standing
exception to "a human merges" — every other skill in this loop stops at that
gate.

## Where the gap bites today

The shipped skills already assume the missing five exist.
`fieldnote-parallel-wave` and `fieldnote-deliver` hand implementation to
`fieldnote-do-work` — 13 references across the shipped skills.
`fieldnote-pull-request` recognizes a PR opened by `fieldnote-fix-bug` — 1
reference. Until a later phase ships those five, bring your own
implementation step where they're named.

For where to start using what's here, see
[README § Two ways in](../README.md#two-ways-in).

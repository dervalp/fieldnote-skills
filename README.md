# fieldnote-skills

**The delivery loop your coding agent doesn't have.**

[![Licence: AGPL-3.0](https://img.shields.io/badge/licence-AGPL--3.0-blue)](LICENSE)
[![Node >= 21](https://img.shields.io/badge/node-%3E%3D%2021-brightgreen)](package.json)
[![Agents: Claude Code · Codex](https://img.shields.io/badge/agents-Claude%20Code%20%C2%B7%20Codex-8A2BE2)](#1-install-the-skills)

## The problem

Your agent writes the code. That part works now, and it stopped being the
bottleneck a while ago.

What it doesn't do is the loop around the code. You still turn the design into
a ticket yourself. You still work out by hand which issues are actually
takeable this morning, and you still run them one at a time because keeping
four agents straight in your head is worse than waiting. You still write the
pull request body, and you still re-read a diff that CI and two agent
reviewers already checked, because nobody wrote down what "checked" means
here.

And you explain your own repository again every single session. Which label
means ready. Which command runs the tests. Where the definition of done
lives — if it's written down anywhere at all. The agent can't remember, so you
repeat yourself, and the parts you forget to repeat are the parts it guesses.

The result is an agent that's fast at the one step you'd already automated and
absent for the seven around it.

## What this is

Nine skills that do the loop: a settled design becomes a PRD with ticketed
child issues, the issues that are takeable right now run as one parallel wave
of worktrees and pull requests, each pull request arrives with real evidence
in it, and the review board gets drained without re-reading what the checks
already covered.

They read your repository's facts from one small file you write once, so they
stop asking. They ran inside a private monorepo for months before this
repository existed; publishing them is what makes them usable anywhere.

## Getting started

You'll need Node 21 or newer, a git repository, and a coding agent — Claude
Code or Codex.

### 1. Install the skills

From any shell:

```bash
npx github:dervalp/fieldnote-skills
```

You get a picker, already fully ticked, so a plain Enter installs everything.
For CI or any shell without a terminal, skip the prompts entirely:

```bash
npx github:dervalp/fieldnote-skills --all
```

The installer looks for the agent homes on your machine and writes to each one
it finds — `~/.claude/skills`, `~/.codex/skills`, or both. Add
`--agent claude` or `--agent codex` to pin it to one.

Claude Code users can install as a plugin instead, which keeps the skills
updating with the marketplace:

```
/plugin marketplace add dervalp/fieldnote-skills
```

Check it landed:

```bash
npx github:dervalp/fieldnote-skills doctor
```

That prints one section per agent home, and every skill's state in it.

### 2. Tell the skills about your repository

This is the step that stops the repeated questions. Run it in the repository
you want to work in:

```bash
npx github:dervalp/fieldnote-skills init
```

It writes `.fieldnote/profile.md`, filling in everything a regex can prove
from the repository itself and marking the rest `TODO`. A skill that hits a
`TODO` stops and asks rather than guessing, so the TODOs are worth filling.

To fill them without doing it by hand, run this in your agent:

```
/fieldnote-setup-profile
```

It reads the CI workflow, the written rules and the deploy configuration, and
asks only about what the repository genuinely cannot answer. Expect it to push
you toward writing a definition of done — see
[docs/definition-of-done.md](docs/definition-of-done.md) for why that one
document earns its keep.

### 3. Run your first loop

**If you plan the work**, start here. Hand it a settled design — straight out
of a brainstorm or a grilling session:

```
/fieldnote-setup-prd
```

It writes the PRD, slices it into tracer-bullet child issues with the
dependency graph wired up, and publishes both behind a single review, instead
of making you sit through the PRD and the issue breakdown as two separate
ceremonies.

**If you write the code**, start here instead. Point it at a PRD or epic
issue:

```
/fieldnote-deliver
```

It works out which child issues are takeable right now — open, labelled ready,
every blocker merged, no pull request yet — and runs that whole frontier as
one parallel wave: one isolated worktree and one pull request per issue. Then
it stops at the merge gate and hands back.

Merge what you're happy with, run it again, and the next wave comes forward.

Nothing in this repository merges on your behalf, with one deliberate
exception: `fieldnote-pr-monitor`, which exists to drain a stalled board and
says so out loud every time it lands something.

## The loop

| Skill | Stage | Job |
| --- | --- | --- |
| `fieldnote-setup-profile` | setup | Writes `.fieldnote/profile.md` by reading the repository, and asks only about what it cannot. |
| `fieldnote-setup-prd` | plan | Turns a settled design into a published PRD and its ticketed child issues, in one pass. |
| `fieldnote-prd-to-plan` | plan | Breaks a PRD into a phased implementation plan of tracer-bullet vertical slices. |
| `fieldnote-do-work` | build | Implements one slice test-first, against the rules your repository wrote down. |
| `fieldnote-parallel-wave` | build | Implements a set of independent, ready-for-agent issues concurrently — one worktree and one PR per issue. |
| `fieldnote-deliver` | build | Drives a PRD/epic to completion wave by wave; re-run after each merge to advance the next wave. |
| `fieldnote-pull-request` | review | Fills this repository's own PR template with domain impact, evidence, risk, and rollback. |
| `fieldnote-testing` | review | This repository's own testing conventions — what to test, at what level, and how to prove it. |
| `fieldnote-pr-monitor` | review | Walks the open PR board and merges what main cannot break. `templated` — see Status. |

See [docs/the-loop.md](docs/the-loop.md) for how these compose end to end,
including the four skills that aren't here yet.

## Tailoring

Skills in this repository don't know your repository. `.fieldnote/profile.md`
carries the facts they need instead — where issues live, which label means
"ready for an agent", what command runs your checks, where your definition of
done is documented.

The profile carries facts, never procedure. It says which command runs your
tests, not when to merge — that part is the skill's job, and it's the same
everywhere. See [docs/profile.md](docs/profile.md) for the full format, and
[docs/concerns.md](docs/concerns.md) for how `.fieldnote/concerns/` carries the
rules a change has to respect here.

## Status

Release process: [docs/RELEASING.md](docs/RELEASING.md).

Ten of the thirteen skills fieldnote runs on ship here. The other three —
`fieldnote-fix-bug`, `fieldnote-react-review` and `fieldnote-react-sweep` —
still carry one company's language and framework doctrine, and generalizing
them is later work.

One reference is still open: `fieldnote-pull-request` recognizes a pull
request opened by `fieldnote-fix-bug`, which has not shipped yet.

`fieldnote-pr-monitor` ships, but stays `templated`. Its evidence comes from a
Turbo monorepo's package graph, and this repository does not ship the script
that produces it. It will not run as-is outside that setup.

The skills themselves are plain Markdown and carry nothing agent-specific.
The installer knows two agent homes, `~/.claude` and `~/.codex`; any other
agent that reads a `skills/` folder works by pointing it there yourself.

|                                      | State               |
| ------------------------------------ | ------------------- |
| Plugin marketplace + npx install     | Shipped             |
| Nine skills, profile-decoupled       | Shipped             |
| Installs for Claude Code and Codex   | Shipped             |
| `init` — scaffold a profile          | Shipped             |
| Four templated skills                | Designed, not built |
| Rendering from fieldnote's Act arm   | Designed, not built |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the rules a skill in this
repository has to follow, and [docs/authoring.md](docs/authoring.md) for how
to write a new one.

## Licence

AGPL-3.0-only. See [LICENSE](LICENSE).

**Third-party content.** Step 1 of `fieldnote-brainstorming` adapts the
`brainstorming` skill from [obra/superpowers](https://github.com/obra/superpowers)
— MIT, Copyright (c) 2025 Jesse Vincent. It is reproduced in the skill rather
than invoked, so the skill works without that plugin installed; the MIT notice
travels with it at the foot of
[`skills/fieldnote-brainstorming/SKILL.md`](skills/fieldnote-brainstorming/SKILL.md).

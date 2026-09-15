# fieldnote-skills

**The delivery loop, as skills.**

```bash
# inside Claude Code
/plugin marketplace add dervalp/fieldnote-skills

# from any shell
npx github:dervalp/fieldnote-skills
```

The default run first asks what you want to install — the picker starts fully
ticked, so a plain Enter installs everything — then filters by stage.
`npx github:dervalp/fieldnote-skills --all` installs every skill with no
prompts at all, which is what you want in CI or anywhere there is no TTY.

Requires Node >=21.

## Why

Agents write the code. What decides whether it ships is the loop around the
code: turning a settled design into a ticketed PRD, running the issues that
are actually takeable right now as one parallel wave, filling out a pull
request with real evidence instead of placeholders, and draining the review
board without re-reading diffs the CI and the agent reviewers already
covered.

These skills are that loop. They ran inside one company's private monorepo
for months. Business users relied on them daily. The developers who stood to
benefit most never picked them up, because the skills only existed in one
place and only worked in one place — hardcoding that repository's own ADR
numbers, paths, labels, and shell commands.

Publishing them fixes the first problem. Making each skill read its facts
from a small file in your own repository, instead of assuming they are the
skill's own, fixes the second. Install once, write a profile, and the loop
that shipped one company's software starts shipping yours.

## The loop

| Skill | Stage | Job |
| --- | --- | --- |
| `fieldnote-setup-profile` | setup | Writes `.fieldnote/profile.md` by reading the repository, and asks only about what it cannot. |
| `fieldnote-setup-prd` | plan | Turns a settled design into a published PRD and its ticketed child issues, in one pass. |
| `fieldnote-prd-to-plan` | plan | Breaks a PRD into a phased implementation plan of tracer-bullet vertical slices. |
| `fieldnote-parallel-wave` | build | Implements a set of independent, ready-for-agent issues concurrently — one worktree and one PR per issue. |
| `fieldnote-deliver` | build | Drives a PRD/epic to completion wave by wave; re-run after each merge to advance the next wave. |
| `fieldnote-pull-request` | review | Fills this repository's own PR template with domain impact, evidence, risk, and rollback. |
| `fieldnote-testing` | review | This repository's own testing conventions — what to test, at what level, and how to prove it. |
| `fieldnote-pr-monitor` | review | Walks the open PR board and merges what main cannot break. `templated` — see Status. |

See [docs/the-loop.md](docs/the-loop.md) for how these compose end to end,
including the five skills that aren't here yet.

## Two ways in

**If you plan work**, start with `fieldnote-setup-prd`. Hand it a settled
design — straight out of a brainstorm or a grill — and it writes the PRD,
slices it into tracer-bullet child issues with a wired dependency graph, and
publishes both behind a single consolidated review, instead of running the
PRD and the issue breakdown as two separate ceremonies.

**If you write code**, start with `fieldnote-deliver`. Point it at a PRD or
epic issue and it works out which child issues are actually takeable right
now — open, labeled ready, every blocker merged, no PR yet — and runs that
frontier as one parallel wave, one isolated worktree and one PR per issue
(today, by composing an implementation skill this repository doesn't ship
yet — see Status below). Re-run it after each merge to pull the next wave
forward. It stops at the human-merge gate; nothing in this repository merges
on its own, except `fieldnote-pr-monitor`, which is the one explicit, logged
exception to that rule.

## Tailoring

Skills in this repository don't know your repository. `.fieldnote/profile.md`
carries the facts they need instead — where issues live, which label means
"ready for an agent," what command runs your checks, where your definition of
done is documented.

Scaffold a starting point with:

```bash
npx github:dervalp/fieldnote-skills init
```

`init` fills what a regex can prove and marks the rest `TODO`. To fill the
rest, run `/fieldnote-setup-profile` in Claude Code: it reads the repository —
the CI workflow, the written rules, the deploy configuration — and asks only
about what the repository genuinely cannot answer. See
[docs/definition-of-done.md](docs/definition-of-done.md) for the one document
it will push you to write.

The profile carries facts, never procedure. It says which command runs your
tests, not when to merge — that's the skill's job, and it's the same
everywhere. See [docs/profile.md](docs/profile.md) for the full format.

## Status

Nine of the thirteen skills fieldnote runs on ship here. The other four —
`fieldnote-fix-bug`, `fieldnote-brainstorming`, `fieldnote-react-review`, and
`fieldnote-react-sweep` — still carry one company's language and framework
doctrine, and generalizing them is later work.

`fieldnote-do-work` now ships. It keeps what is true in every repository and
reads what is true in yours from `.fieldnote/concerns/` — see
[docs/concerns.md](docs/concerns.md). The 13 references to it from
`fieldnote-deliver` and `fieldnote-parallel-wave` resolve on a fresh install.

One reference is still open: `fieldnote-pull-request` recognizes a pull
request opened by `fieldnote-fix-bug`, which has not shipped yet.

`fieldnote-pr-monitor` ships, but stays `templated` too. Its evidence comes
from a Turbo monorepo's package graph, and this repository does not ship the
script that produces it. It will not run as-is outside that setup.

|                                      | State               |
| ------------------------------------ | ------------------- |
| Plugin marketplace + npx install     | Shipped             |
| Eight skills, profile-decoupled      | Shipped             |
| `init` — scaffold a profile          | Shipped             |
| Five templated skills                | Designed, not built |
| `tailor` — render per repository     | Designed, not built |
| Rendering from fieldnote's Act arm   | Designed, not built |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the rules a skill in this
repository has to follow, and [docs/authoring.md](docs/authoring.md) for how
to write a new one.

## Licence

AGPL-3.0-only. See [LICENSE](LICENSE).

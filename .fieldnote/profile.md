# fieldnote profile

Every value below was read from this repository — its CI workflow, its
definition of done, its package scripts, its GitHub settings. `(none)` means
this repository genuinely has no such thing, and a skill should skip that step
rather than ask.

This file carries FACTS, never PROCEDURE. See
https://github.com/dervalp/fieldnote-skills/blob/main/docs/profile.md

## Tracker

- **kind** — github
- **repo** — dervalp/fieldnote-skills
- **epicLink** — body reference: `Parent #<n>`
- **blockedBy** — body section: `## Blocked by`

## Labels

- **ready** — ready-for-agent
- **needsPrd** — to-prd
- **prd** — prd

## Commands

- **check** — npm test --prefix cli && npm run typecheck --prefix cli
- **preflight** — npm run validate && npm run check:decoupling && npm test --prefix cli && npm run typecheck --prefix cli && npm run catalog
- **mutation** — (none)
- **scenarioCheck** — (none)

## Docs

- **definitionOfDone** — .fieldnote/definition-of-done.md
- **pullRequest** — CONTRIBUTING.md
- **testing** — (none)
- **verification** — .fieldnote/definition-of-done.md
- **ciTriage** — (none)
- **plans** — docs/plans
- **glossary** — (none)
- **acceptance** — (none)
- **scenarios** — (none)

## Architecture

- (none)

## Parallelism

- **waveSize** — 3

## Merge policy

- **strictStatusChecks** — false
- **adminMerge** — true

## Localization

- (none)

## Git

- **baseRemote** — origin
- **baseBranch** — main

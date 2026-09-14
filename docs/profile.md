# The repository profile

`.fieldnote/profile.md` records what is true about *your* repository so the
skills do not have to guess.

**It carries facts, never procedure.** It says where the definition of done
lives and which command runs mutation testing. It does not say when to merge
or how to review — that is the skill's job, and it is the same everywhere. If
you find yourself writing a sentence that tells the skill what to *do*, it
belongs in the skill (or in a request to change the skill), not in the
profile.

Skills resolve facts in this order:

1. `.fieldnote/profile.md`
2. `AGENTS.md` / `CLAUDE.md`
3. Ask once, state the assumption, and offer to write the profile.

Generate a starting point with `npx github:dervalp/fieldnote-skills init`.

## Format

The file is Markdown. `##` headings introduce sections; the heading text is
lowercased and title-cased into a camelCase key ("Merge policy" becomes
`mergePolicy`). Most sections hold key/value bullets:

```markdown
- **key** — value
```

The separator between the bold key and the value may be an em dash (—), an en
dash (–), or a plain hyphen (-) — use whichever your editor produces. The
`Architecture` section is the one exception: it holds a bare, ordered list of
rules instead of key/value pairs:

```markdown
- A rule, stated as a sentence.
```

A section that is absent, or a key that is absent from a section that is
present, is simply missing — skills fall through to `AGENTS.md`/`CLAUDE.md` or
ask. Use the literal value `TODO` for a key you know you'll need but haven't
filled in yet; the parser preserves it verbatim rather than resolving it to
anything, so a well-behaved skill can detect it and ask instead of running
`TODO` as if it were a real command or path.

## Sections

### Tracker

Where issues live and how to address them: the issue tracker in use, the
project or repo identifier, anything a skill needs to open or query an issue
without asking.

```markdown
## Tracker

- **kind** — github
- **repo** — dervalp/fieldnote-skills
```

### Labels

The labels this repository actually uses for the states skills need to
recognize or set. Skills cite these by name rather than hardcoding a label
string, because label text varies repo to repo.

- **`Labels.ready`** — the label meaning "ready for an agent to pick up."
- **`Labels.needsPrd`** — the label meaning "needs a PRD before implementation
  can start."

```markdown
## Labels

- **ready** — ready-for-agent
- **needsPrd** — to-prd
```

### Commands

The shell commands that make this repository's checks and tests run. Skills
that need to run a check cite the key, never a hardcoded package-manager
invocation, because `pnpm check` in one repo is `npm run check` or `make
check` in another.

- **`Commands.check`** — the command that runs this repository's fast
  checks (lint, typecheck, unit tests — whatever "check" means locally).
- **`Commands.preflight`** — the command to run before opening a PR or
  requesting review (may be the same as `check`, or a longer chain).

```markdown
## Commands

- **check** — pnpm check
- **preflight** — pnpm check && pnpm build
- **mutation** — pnpm mutation:changed
```

### Docs

Paths (relative to the repo root) to documents that hold this repository's own
standards. Skills read these documents' *content* to know what "done" means
here; the profile only records *where* they are.

- **`Docs.definitionOfDone`** — the document defining when a change is
  complete.
- **`Docs.pullRequest`** — the PR description template or PR-writing
  conventions.
- **`Docs.testing`** — the testing strategy or conventions document.
- **`Docs.verification`** — how to verify a change works before claiming it
  does (manual QA steps, a staging checklist, etc.).
- **`Docs.ciTriage`** — how to diagnose a failing CI run in this repository.
- **`Docs.plans`** — the directory where implementation plans are written.
  Read today by `fieldnote-prd-to-plan`, which writes plans to `./plans/`
  unless this key names a different directory.

```markdown
## Docs

- **definitionOfDone** — docs/definition-of-done.md
- **pullRequest** — docs/pull-request-template.md
- **testing** — docs/testing.md
- **verification** — docs/verification.md
- **ciTriage** — docs/ci-triage.md
- **plans** — ./plans
```

### Architecture

An ordered list of durable architectural rules — the constraints a skill
should respect when it proposes a design or reviews one, stated as plain
sentences rather than key/value facts because there's no natural "key" for a
rule.

```markdown
## Architecture

- Validate every boundary with a schema before it reaches a service.
- Persistence stays behind a repository interface.
```

### Parallelism

Facts about how much work can safely run at once in this repository.

- **`Parallelism.waveSize`** — how many issues/tasks a skill may hand out to
  run concurrently in one wave.

```markdown
## Parallelism

- **waveSize** — 3
```

### Merge policy

Facts about this repository's branch protection and merge mechanics — never
*when* to merge, only what the mechanics require.

- **`MergePolicy.strictStatusChecks`** — `true` when branch protection
  requires status checks to be up to date with the base branch before
  merging.
- **`MergePolicy.adminMerge`** — `true` when an admin/owner can merge past a
  failing or missing required check (and so a skill should not treat that
  path as unavailable).

```markdown
## Merge policy

- **strictStatusChecks** — true
- **adminMerge** — false
```

## A complete example

```markdown
# fieldnote profile

## Tracker

- **kind** — github
- **repo** — dervalp/fieldnote-skills

## Labels

- **ready** — ready-for-agent
- **needsPrd** — to-prd

## Commands

- **check** — pnpm check
- **preflight** — pnpm check && pnpm build
- **mutation** — pnpm mutation:changed

## Docs

- **definitionOfDone** — docs/definition-of-done.md
- **pullRequest** — docs/pull-request-template.md
- **testing** — docs/testing.md
- **verification** — docs/verification.md
- **ciTriage** — docs/ci-triage.md
- **plans** — ./plans

## Architecture

- Validate every boundary with a schema before it reaches a service.
- Persistence stays behind a repository interface.

## Parallelism

- **waveSize** — 3

## Merge policy

- **strictStatusChecks** — true
- **adminMerge** — false
```

Copy this, delete what doesn't apply, and replace the rest with your
repository's own facts. Any key you leave out — or set to `TODO` — is a gap
a skill will ask you about rather than guess at.

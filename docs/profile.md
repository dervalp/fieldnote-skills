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
dash (–), or a plain hyphen (-) — use whichever your editor produces. Every
bullet, in every section, must be marked with a plain hyphen (`-`); `*` and
`+` bullets (both valid Markdown, and what some editors auto-convert to) are
not recognized and are silently ignored. The `Architecture` section is the
one exception to the key/value shape: it holds a bare, ordered list of rules
instead. `Architecture` itself is superseded by
`.fieldnote/concerns/shared.md` (see [docs/concerns.md](concerns.md)) — the
parser still reads it this way only so an existing profile keeps parsing:

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

- **`Tracker.epicLink`** — how a child issue references its parent epic/PRD in
  this tracker: a sub-issue relation, a project field, or a body reference
  (e.g. `Parent #<n>`).
- **`Tracker.blockedBy`** — how a blocker is expressed in this tracker: a
  native "blocked by" relation, a project field, or a body reference (e.g. a
  `Blocked by` section naming issue numbers).

```markdown
## Tracker

- **kind** — github
- **repo** — dervalp/fieldnote-skills
- **epicLink** — body reference: `Parent #<n>`
- **blockedBy** — body section: `## Blocked by`
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

### Architecture (superseded)

Superseded by `.fieldnote/concerns/shared.md`. See
[docs/concerns.md](concerns.md).

This was a bare list of rules — no concern, no room for a rule with
sub-cases, no way to cite a longer document. Those are the limits the
concerns folder exists to lift.

The parser still reads the section, so an existing profile keeps working and
nothing breaks on upgrade. Nothing new should be written here. Move the
bullets to `.fieldnote/concerns/shared.md`; `fieldnote-setup-profile` offers
to do it when it finds them.

```markdown
## Architecture

- A rule, stated as a sentence.
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

### Localization

Whether this repository translates its UI at all, and if so, which locale is
canonical and where each locale's strings live. Absent entirely in an
English-only (or otherwise single-locale) repository — skills treat a missing
`Localization` section as "no localization requirement here," not as a gap to
ask about.

- **`Localization.canonicalLocale`** — the locale reviewed first and treated
  as the source of truth for wording (e.g. `fr`).
- **`Localization.locales`** — every locale that must stay in parity with the
  canonical one.
- **`Localization.catalogs`** — where each locale's strings live: one or more
  path patterns, with `<locale>` (and `<namespace>` where relevant) as
  placeholders.

```markdown
## Localization

- **canonicalLocale** — fr
- **locales** — fr, en
- **catalogs** — src/i18n/<namespace>.<locale>.json (shared libs); messages/<locale>.json (app chrome)
```

### Git

The remote and branch a skill should treat as the integration target — the
ordinary single-remote case by default, so a skill never hardcodes a
fork-workflow remote name that only some repositories use.

- **`Git.baseRemote`** — the remote PRs are opened against and branches are
  based on (usually `origin`).
- **`Git.baseBranch`** — the branch PRs target (usually `main`, sometimes
  `master` or `develop`).

```markdown
## Git

- **baseRemote** — origin
- **baseBranch** — main
```

## Saying "this repository has none"

`TODO` means *nobody has filled this in yet*. It is not the same as *this
repository does not have one*, and until now both looked identical.

Write `(none)` for the second:

```markdown
## Commands

- **check** — pnpm check
- **mutation** — (none)
```

A `(none)` value is dropped from the parsed profile, so a skill reading
`Commands → mutation` sees nothing at all and can never run the literal string
`(none)` as a command. It is recorded separately, so a skill that cares can
tell "decided: none" from "never answered".

A bare `- (none)` bullet, with no bold key, declares the whole section absent:

```markdown
## Localization

- (none)
```

The marker is case-insensitive. `fieldnote-skills init` never writes it —
`init` observes, it does not decide — so `(none)` only ever appears because a
person or a skill put it there on purpose.

## If a key isn't being picked up

`parseProfile` is intentionally forgiving: it never throws on content it
doesn't recognize, it just ignores it. That means a mistake here fails
silently rather than with an error message, so check these first before
assuming a skill or the parser is broken:

- **The heading must be `##` followed by a space, and spelled exactly as
  one of the nine section names** — `Tracker`, `Labels`, `Commands`,
  `Docs`, `Architecture`, `Parallelism`, `Merge policy`, `Localization`,
  `Git` (case doesn't matter, but the words and their order do). `##Labels`
  (no space after `##`), `### Labels` (three hashes), and `## Label` (wrong
  word) all fail to be recognized as one of the nine sections. A heading the
  parser doesn't recognize is not an error: every bullet under it is
  silently dropped, and nothing under it becomes available to any skill.
  `Architecture` is still recognized, but superseded: write new rules in
  `.fieldnote/concerns/shared.md` instead (see [docs/concerns.md](concerns.md)).
- **The bullet marker must be a hyphen (`-`)**, not `*` or `+`.
- **A key/value bullet needs bold around the key**: `` - **key** — value ``.
  A bullet without the `**...**` around the key parses as an unrecognized
  line in every section except `Architecture` (where it's the expected
  shape).
- **A bullet must not be indented.** Every line is trimmed before it's
  parsed, so a nested bullet (e.g. a sub-point indented under another rule in
  `Architecture`) is read as a new top-level entry, not as part of the item
  above it — there is no nesting in this format. Keep every bullet, in every
  section, at the left margin.

There is no `validate` command for this file yet — the only check today is
reading the parsed result back, or checking your spelling against this
document.

## A complete example

```markdown
# fieldnote profile

## Tracker

- **kind** — github
- **repo** — dervalp/fieldnote-skills
- **epicLink** — body reference: `Parent #<n>`
- **blockedBy** — body section: `## Blocked by`

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

Superseded by `.fieldnote/concerns/shared.md` — a new profile leaves this
section empty and writes its rules there instead.

## Parallelism

- **waveSize** — 3

## Merge policy

- **strictStatusChecks** — true
- **adminMerge** — false

## Localization

- **canonicalLocale** — fr
- **locales** — fr, en
- **catalogs** — src/i18n/<namespace>.<locale>.json (shared libs); messages/<locale>.json (app chrome)

## Git

- **baseRemote** — origin
- **baseBranch** — main
```

Copy this, delete what doesn't apply, and replace the rest with your
repository's own facts. Any key you leave out — or set to `TODO` — is a gap
a skill will ask you about rather than guess at.

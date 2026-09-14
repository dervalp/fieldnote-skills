# Contributing to fieldnote-skills

## Layout

The tree is flat: one folder per skill, no nested categories.

```
skills/fieldnote-<name>/SKILL.md
```

A skill may also ship `scripts/`, `commands/`, `agents/`, `hooks/`, or
`references/` alongside `SKILL.md`. A `tests/` folder is allowed too, for a
skill's own eval harness — it never ships to an install.

## Writing a new skill

Copy the template and start from there:

```bash
cp -r templates/skill-template skills/fieldnote-<name>
```

See [docs/authoring.md](docs/authoring.md) for the full walkthrough.

## Frontmatter: uniform and enforced

Every `SKILL.md` opens with the same frontmatter fields, and `npm run
validate` checks them mechanically. This is deliberate: the source skills
this repository draws from have body layouts ranging from 3 `##` sections to
15, because each skill's shape follows its own job — a one-page PR-template
filler doesn't need the same sections as a multi-phase delivery skill. There
is no house body template to conform to, and none is coming. **Frontmatter is
uniform and enforced. Body structure is the author's call.**

What the validator actually checks:

- **`name`** — required; must equal the folder name.
- **`description`** — required; at least 15 words, and must contain a
  `use when …` trigger clause. Write it for someone who doesn't know the
  skill exists yet.
- **`stage`** — required; one of `plan`, `build`, `review`.
- **`version`** — required; semver (`X.Y.Z`).
- **`variance`** — required for any skill with `surface: code` or
  `surface: both` (the default, if `surface` is omitted); one of `universal`,
  `configured`, `templated`.
  - `universal` — no repository facts at all.
  - `configured` — one procedure, facts injected from
    `.fieldnote/profile.md`.
  - `templated` — a generic spine plus sections a repository has to author
    itself.
- **`surface`** — optional, defaults to `code`; one of `desktop`, `code`,
  `both`. A `desktop`-only skill may not ship `commands/`, `agents/`, or
  `hooks/`.
- **The folder name itself** — must match `fieldnote-<name>` in kebab-case
  (`^fieldnote-[a-z0-9][a-z0-9-]*$`).

Everything below the closing `---` — headings, order, length, tone — is
yours to decide based on what the skill needs to do its job.

## The decoupling rule

A `SKILL.md` may not name a path, label, environment variable, or shell
command that exists only in one repository. Cite `.fieldnote/profile.md`
instead — see [docs/profile.md](docs/profile.md) for the sections it defines
(`Tracker`, `Labels`, `Commands`, `Docs`, `Architecture`, `Parallelism`,
`Merge policy`). A skill that hardcodes another repository's coordinates only
runs in that repository; the whole point of this one is that a skill runs
everywhere its facts are supplied. `npm run check:decoupling` (part of CI)
enforces this mechanically against `skills/*/SKILL.md`; the rules live in
`cli/src/decoupling.ts`.

**The guard is conservative about `libs/`, `apps/`, and `packages/` paths.**
It cannot tell a reference to this repository's own private monorepo layout
from a generic example — a code sample showing a workspace convention, or a
URL route like `/apps/settings`, will also trip it. This is deliberate: a
looser rule would let real coupling through, and distinguishing "example"
from "reference" isn't something a regex can do reliably. If your legitimate,
portable content is flagged, rewrite the example to avoid the `libs/`,
`apps/`, or `packages/` prefix (a different placeholder name works fine) — do
not weaken the rule to accommodate it.

## Before opening a PR

```bash
cd cli && npm test
npm run validate
npm run catalog
```

`cd cli && npm test` runs the CLI's own test suite — required if you changed
anything under `cli/`. `npm run validate` must exit 0. `npm run catalog`
regenerates `CATALOG.md`, `catalog.json`, and `skills.lock.json` from
`skills/*/SKILL.md` — never hand-edit those three files; run the command and
commit what it writes.

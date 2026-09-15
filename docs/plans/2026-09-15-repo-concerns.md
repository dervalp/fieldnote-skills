# Repository Concerns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a repository a place to author its own rules — `.fieldnote/concerns/` — so `fieldnote-do-work` can ship carrying only what is true everywhere.

**Architecture:** A repository authors one short Markdown file per concern under `.fieldnote/concerns/`. A skill reads the file at the moment the rule binds; there is no templating and no runtime. `cli/src/concerns.ts` holds the advised names the way `cli/src/dod.ts` holds the definition-of-done sections, and tests pin the documentation and the starter files against that constant so the three copies cannot drift. `variance: templated` gains a meaning — the skill declares a `concerns:` list — which the validator checks and `doctor` reports against the repository it is standing in.

**Tech Stack:** TypeScript (ESM, `node:test`, `tsx`), Node >= 21, no new dependencies.

**Spec:** `docs/specs/2026-09-15-repo-concerns-design.md`

## Global Constraints

- **No new dependencies.** Everything uses `node:*` plus what `cli/package.json` already has.
- **Decoupling guard.** `npm run check:decoupling` scans `skills/**`, tracked `docs/**/*.md` and `templates/**`. Nothing added to those trees may name a private brand, cite a decision record by number, use a monorepo layout path prefix, or name an agent-docs path. Every example must be generic. This plan file and the spec are themselves scanned.
- **Release stamp stays `skills-v0.1.0`** on every skill; `release.json` is not edited. `skills.lock.json` is never hand-edited — `npm run catalog` rewrites it.
- **Catalog is generated.** After any `SKILL.md` change, run `npm run catalog` and commit its output — `catalog.json`, `CATALOG.md` **and `skills.lock.json`**, which that same script rewrites. CI runs `npm run catalog` then `git diff --exit-code` over all three, so leaving the lock out fails the build. Never hand-edit any of them.
- **Advised, never required.** A concern name outside the advised six is accepted in silence everywhere. "Strongly advised" cannot be a build failure.
- **Six advised names, exactly:** `shared`, `front-end`, `backend`, `database`, `qa`, `ci`.
- **Directory, exactly:** `.fieldnote/concerns`.
- **`init` stays unchanged.** It observes a repository, it never decides for one, so it must not scaffold concern files. No task touches `cli/src/commands/init.ts`.
- **Conventional Commit titles**, breaking changes marked `!`.
- **Every task ends green on:** `cd cli && npm test && npm run typecheck`, and from the repo root `npm run validate && npm run check:decoupling`.

## File Structure

| File | Responsibility |
|---|---|
| `cli/src/concerns.ts` (new) | The convention: advised names, directory, path building, what a repository has, what is missing, doctor classification. Pure except for one directory read. |
| `cli/src/concerns.test.ts` (new) | Pins the names, the directory, the helpers, and the three copies (code / docs / starters) against each other. |
| `cli/src/skill-model.ts` | Adds the `concerns` accessor and carries it into `CatalogEntry`. |
| `cli/src/skill-validate.ts` | The `variance: templated` ⇄ `concerns:` rules. |
| `cli/src/commands/doctor.ts` | Renders a "This repository" section from `classifyConcerns`. |
| `templates/concerns/*.md` (new, 6) | Framework-neutral starters. |
| `docs/concerns.md` (new) | The convention, written for a human filling it in. |
| `skills/fieldnote-do-work/SKILL.md` (new) | The first skill to use the seam. |
| `skills/fieldnote-setup-profile/SKILL.md` | Drafts the concern files alongside the profile. |
| `skills/fieldnote-testing/SKILL.md` | Repointed off the retiring profile `Architecture` section. |

---

### Task 1: The convention module

**Files:**
- Create: `cli/src/concerns.ts`
- Create: `cli/src/concerns.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ADVISED_CONCERNS: readonly ["shared","front-end","backend","database","qa","ci"]`; `CONCERNS_DIR = ".fieldnote/concerns"`; `CONCERN_NAME_RE: RegExp`; `concernPath(name: string): string`; `sortConcerns(names: string[]): string[]`; `findConcerns(repoRoot: string): string[]`; `missingConcerns(declared: string[], present: string[]): string[]`.

- [ ] **Step 1: Write the failing test**

Create `cli/src/concerns.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ADVISED_CONCERNS,
  CONCERNS_DIR,
  CONCERN_NAME_RE,
  concernPath,
  findConcerns,
  missingConcerns,
  sortConcerns,
} from "./concerns.js";

/** A temp repo root with the given concern files present, removed afterwards. */
function withRepo(files: string[], fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "fn-concerns-"));
  try {
    if (files.length > 0) {
      mkdirSync(join(root, ".fieldnote", "concerns"), { recursive: true });
      for (const f of files) writeFileSync(join(root, ".fieldnote", "concerns", f), "# x\n", "utf8");
    }
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("the convention advises six concerns, broad to narrow", () => {
  assert.deepEqual(
    [...ADVISED_CONCERNS],
    ["shared", "front-end", "backend", "database", "qa", "ci"],
  );
});

test("the folder sits next to the profile", () => {
  assert.equal(CONCERNS_DIR, ".fieldnote/concerns");
  assert.equal(concernPath("front-end"), ".fieldnote/concerns/front-end.md");
});

test("a concern name is a kebab-case file stem", () => {
  assert.ok(CONCERN_NAME_RE.test("front-end"));
  assert.ok(CONCERN_NAME_RE.test("qa"));
  assert.ok(!CONCERN_NAME_RE.test("Front-End"));
  assert.ok(!CONCERN_NAME_RE.test("front_end"));
  assert.ok(!CONCERN_NAME_RE.test("front-end.md"));
  assert.ok(!CONCERN_NAME_RE.test(""));
});

test("advised names sort in convention order, extras alphabetically after", () => {
  assert.deepEqual(
    sortConcerns(["prompts", "ci", "shared", "ios", "backend"]),
    ["shared", "backend", "ci", "ios", "prompts"],
  );
});

test("findConcerns reads the folder and drops anything that is not a .md file", () => {
  withRepo(["shared.md", "ci.md", "notes.txt"], (root) => {
    assert.deepEqual(findConcerns(root), ["shared", "ci"]);
  });
});

test("findConcerns returns nothing for a repository with no folder", () => {
  withRepo([], (root) => {
    assert.deepEqual(findConcerns(root), []);
  });
});

test("findConcerns keeps a repository's own concern name", () => {
  withRepo(["shared.md", "prompts.md"], (root) => {
    assert.deepEqual(findConcerns(root), ["shared", "prompts"]);
  });
});

test("missingConcerns names declared files the repository does not have", () => {
  assert.deepEqual(missingConcerns(["shared", "qa", "ci"], ["shared"]), ["qa", "ci"]);
  assert.deepEqual(missingConcerns(["shared"], ["shared", "ci"]), []);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd cli && npx tsx --test src/concerns.test.ts`
Expected: FAIL — cannot find module `./concerns.js`.

- [ ] **Step 3: Write the module**

Create `cli/src/concerns.ts`:

```ts
/**
 * The repository-concerns convention.
 *
 * A repository authors its own rules as one short Markdown file per concern
 * under `.fieldnote/concerns/`. A skill reads the file at the moment the rule
 * binds — there is no templating step and no runtime, so "composition" is an
 * instruction in the skill body, not a substitution.
 *
 * The six names below are STRONGLY ADVISED, not fixed. A command-line tool
 * has no front end; a repository doing model work may want `prompts`. Adding
 * one is dropping in a file: nothing here has to change, and no check may
 * reject an unadvised name. That is the difference from `dod.ts`, whose five
 * sections really are the same in every repository.
 *
 * The names live here, in code, because the documentation, the starter files
 * and the skills all have to agree on them. A test pins each against this list.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

/** Broad to narrow: what binds everywhere, then each surface, then the pipeline. */
export const ADVISED_CONCERNS = [
  "shared",
  "front-end",
  "backend",
  "database",
  "qa",
  "ci",
] as const;

export type AdvisedConcern = (typeof ADVISED_CONCERNS)[number];

/** Where the convention puts them: beside `.fieldnote/profile.md`. */
export const CONCERNS_DIR = ".fieldnote/concerns";

/** A concern name is a kebab-case file stem — the filename IS the name. */
export const CONCERN_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `.fieldnote/concerns/front-end.md` for `front-end`. */
export function concernPath(name: string): string {
  return `${CONCERNS_DIR}/${name}.md`;
}

function order(name: string): number {
  const index = (ADVISED_CONCERNS as readonly string[]).indexOf(name);
  return index === -1 ? ADVISED_CONCERNS.length : index;
}

/** Advised names in convention order; anything else alphabetically after them. */
export function sortConcerns(names: string[]): string[] {
  return [...names].sort((a, b) => order(a) - order(b) || (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * The concern files a repository actually has, by name.
 *
 * A missing folder is not an error: a repository that has authored nothing is
 * the ordinary starting state, and every skill degrades rather than stopping.
 */
export function findConcerns(repoRoot: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(join(repoRoot, ".fieldnote", "concerns"));
  } catch {
    return [];
  }
  const names = entries
    .filter((e) => e.endsWith(".md"))
    .map((e) => e.slice(0, -3))
    .filter((n) => CONCERN_NAME_RE.test(n));
  return sortConcerns(names);
}

/** Declared concerns with no file in the repository, in convention order. */
export function missingConcerns(declared: string[], present: string[]): string[] {
  const have = new Set(present);
  return sortConcerns(declared.filter((name) => !have.has(name)));
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd cli && npx tsx --test src/concerns.test.ts && npm run typecheck`
Expected: all PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add cli/src/concerns.ts cli/src/concerns.test.ts
git commit -m "feat(cli): add the repository-concerns convention module"
```

---

### Task 2: Skills declare the concerns they read

**Files:**
- Modify: `cli/src/skill-model.ts` (add the `concerns` accessor near `mcp`; add to `CatalogEntry` and `toCatalogEntry`)
- Modify: `cli/src/types.ts` (add to `SkillEntry` — the row the CLI reads back out of `catalog.json`)
- Modify: `cli/src/testkit.ts` (add to `FixtureSkill` and `toEntry`, so a test can build one)
- Modify: `cli/src/skill-model.test.ts` (append tests)

**Interfaces:**
- Consumes: Task 1's `ADVISED_CONCERNS` is deliberately NOT used here — the model stays unopinionated about which names are valid; the validator owns that.
- Produces: `Skill.concerns: string[]`; `CatalogEntry.concerns?: string[]` and `SkillEntry.concerns?: string[]`, both emitted only when non-empty; `FixtureSkill.concerns?: string[]`.

**Why two entry types:** `CatalogEntry` (in `skill-model.ts`) is what the catalog builder *writes*; `SkillEntry` (in `types.ts`) is what the CLI *reads back*. Task 5 consumes the second. Adding the field to only one compiles here and fails there.

- [ ] **Step 1: Write the failing tests**

Append to `cli/src/skill-model.test.ts`:

```ts
test("concerns parses as an inline list", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", {
      ...baseFm("fieldnote-do-thing", { variance: "templated" }),
      concerns: "[shared, qa, ci]",
    });
    assert.deepEqual(discover(d)[0].concerns, ["shared", "qa", "ci"]);
  });
});

test("an absent concerns list reads as empty", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing"));
    assert.deepEqual(discover(d)[0].concerns, []);
  });
});

test("concerns reach the catalog entry only when declared", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-plain", baseFm("fieldnote-plain"));
    writeSkill(d, "fieldnote-tailored", {
      ...baseFm("fieldnote-tailored", { variance: "templated" }),
      concerns: "[shared]",
    });
    const entries = discover(d).map((s) => s.toCatalogEntry());
    const plain = entries.find((e) => e.name === "fieldnote-plain");
    const tailored = entries.find((e) => e.name === "fieldnote-tailored");
    assert.equal("concerns" in plain!, false);
    assert.deepEqual(tailored!.concerns, ["shared"]);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd cli && npx tsx --test src/skill-model.test.ts`
Expected: FAIL — `concerns` is not a property of `Skill`.

- [ ] **Step 3: Add the accessor and the catalog field**

In `cli/src/skill-model.ts`, add to the `CatalogEntry` interface, after `variance: string;`:

```ts
  concerns?: string[];
```

Add to the `Skill` class, immediately after the `mcp` getter:

```ts
  /**
   * Repository-authored concern files this skill always reads (see
   * `concerns.ts`). Declared only by `variance: templated` skills. A skill
   * that picks further concerns from the change in front of it describes that
   * in its body — frontmatter cannot express a judgement.
   */
  get concerns(): string[] {
    return this.listField("concerns");
  }
```

In `toCatalogEntry()`, beside the existing `produces`/`consumes` lines:

```ts
    if (this.concerns.length > 0) entry.concerns = this.concerns;
```

In `cli/src/types.ts`, add to the `SkillEntry` interface, beside `produces`/`consumes`:

```ts
  /** `.fieldnote/concerns/` files this skill always reads; absent when none. */
  concerns?: string[];
```

In `cli/src/testkit.ts`, add to the `FixtureSkill` interface:

```ts
  concerns?: string[];
```

and inside `toEntry`, after the `variance` line, so a fixture can carry one:

```ts
  if (skill.concerns !== undefined && skill.concerns.length > 0) entry.concerns = skill.concerns;
```

`toEntry` builds and returns the object literal today; restructure it to assign
`const entry: SkillEntry = { … }`, apply the line above, and `return entry` —
matching how `toCatalogEntry` handles its optional fields.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd cli && npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/skill-model.ts cli/src/types.ts cli/src/testkit.ts cli/src/skill-model.test.ts
git commit -m "feat(cli): let a skill declare the concern files it reads"
```

---

### Task 3: `variance: templated` means something

**Files:**
- Modify: `cli/src/skill-validate.ts` (after the existing `mcp` block)
- Modify: `cli/src/skill-validate.test.ts` (append tests)
- Modify: `CONTRIBUTING.md` (the `variance` bullet)
- Modify: `docs/authoring.md` (step 3's `templated` bullet)

**Interfaces:**
- Consumes: `Skill.concerns` (Task 2); `ADVISED_CONCERNS`, `CONCERN_NAME_RE`, `CONCERNS_DIR` (Task 1).
- Produces: three validation errors, exact strings pinned by the tests below.

- [ ] **Step 1: Write the failing tests**

Append to `cli/src/skill-validate.test.ts`:

```ts
test("a templated skill must declare the concerns it reads", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing", { variance: "templated" }));
    const errors = collectErrors(d);
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /variance 'templated' requires a non-empty 'concerns:' list/);
  });
});

test("a templated skill declaring concerns validates clean", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", {
      ...baseFm("fieldnote-do-thing", { variance: "templated" }),
      concerns: "[shared, qa]",
    });
    assert.deepEqual(collectErrors(d), []);
  });
});

test("a concern name outside the advised six is accepted in silence", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", {
      ...baseFm("fieldnote-do-thing", { variance: "templated" }),
      concerns: "[shared, prompts]",
    });
    assert.deepEqual(collectErrors(d), []);
  });
});

test("only a templated skill may declare concerns", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", {
      ...baseFm("fieldnote-do-thing", { variance: "configured" }),
      concerns: "[shared]",
    });
    const errors = collectErrors(d);
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /'concerns:' is only valid on a 'templated' skill/);
  });
});

test("a concern entry must be a kebab-case file stem", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", {
      ...baseFm("fieldnote-do-thing", { variance: "templated" }),
      concerns: "[Front_End]",
    });
    const errors = collectErrors(d);
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /concerns entry 'Front_End' must be a kebab-case file name/);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd cli && npx tsx --test src/skill-validate.test.ts`
Expected: FAIL — no errors produced for the first, fifth; the fourth passes clean.

- [ ] **Step 3: Add the rules**

In `cli/src/skill-validate.ts`, add to the import from `./concerns.js`:

```ts
import { ADVISED_CONCERNS, CONCERN_NAME_RE, CONCERNS_DIR } from "./concerns.js";
```

Insert immediately after the existing `mcp` validation block:

```ts
  // `templated` is the one variance that promises a repository authored
  // something. The list is what makes that promise checkable — and what
  // `doctor` reads to say which file a repository is missing.
  const concernsRaw = fm["concerns"];
  if (concernsRaw !== undefined && !Array.isArray(concernsRaw)) {
    err(`concerns must be an inline list, e.g. concerns: [${ADVISED_CONCERNS.slice(0, 2).join(", ")}]`);
  } else {
    const concerns = skill.concerns;
    if (declaredVariance === "templated" && concerns.length === 0) {
      err(
        `variance 'templated' requires a non-empty 'concerns:' list — ` +
          `the ${CONCERNS_DIR}/ files this skill reads`,
      );
    }
    if (declaredVariance !== "templated" && concerns.length > 0) {
      err(`'concerns:' is only valid on a 'templated' skill (this one is '${declaredVariance}')`);
    }
    for (const name of concerns) {
      // Deliberately no membership check against ADVISED_CONCERNS: the six are
      // advice, and a repository naming its own concern must not fail a build.
      if (!CONCERN_NAME_RE.test(name)) {
        err(`concerns entry '${name}' must be a kebab-case file name, e.g. front-end`);
      }
    }
  }
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd cli && npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Document the rule where an author will meet it**

In `CONTRIBUTING.md`, extend the `variance` bullet with:

```markdown
  A `templated` skill must also carry `concerns:` — an inline list of the
  `.fieldnote/concerns/` files it always reads, e.g. `concerns: [shared, qa]`.
  No other variance may carry one.
```

In `docs/authoring.md`, replace the `templated` bullet in step 3 with:

```markdown
   - **`templated`** — part of the skill's content is authored per
     repository, in `.fieldnote/concerns/`. Declare which files the skill
     always reads: `concerns: [shared, qa]`. Say so in the description too,
     the way `fieldnote-pr-monitor` names its package-graph dependency. See
     [docs/concerns.md](concerns.md).
```

- [ ] **Step 6: Run the full checks and commit**

```bash
npm run validate && npm run check:decoupling
git add cli/src/skill-validate.ts cli/src/skill-validate.test.ts CONTRIBUTING.md docs/authoring.md
git commit -m "feat(cli): require a concerns list on every templated skill"
```

---

### Task 4: The starters and the convention document

**Files:**
- Create: `templates/concerns/shared.md`, `front-end.md`, `backend.md`, `database.md`, `qa.md`, `ci.md`
- Create: `docs/concerns.md`
- Modify: `cli/src/concerns.test.ts` (append the drift tests)

**Interfaces:**
- Consumes: `ADVISED_CONCERNS`, `concernPath` (Task 1).
- Produces: `templates/concerns/<name>.md` for each advised name — read by `fieldnote-setup-profile` in Task 8.

- [ ] **Step 1: Write the failing tests**

Append to `cli/src/concerns.test.ts` (add `readFileSync` and `existsSync` to the `node:fs` import, and `import { join } from "node:path"` is already there):

```ts
const repoRoot = join(import.meta.dirname, "..", "..");

test("a starter ships for every advised concern", () => {
  for (const name of ADVISED_CONCERNS) {
    const path = join(repoRoot, "templates", "concerns", `${name}.md`);
    assert.ok(existsSync(path), `templates/concerns/${name}.md must exist`);
  }
});

test("the convention document shows every advised concern, so the copies cannot drift", () => {
  const md = readFileSync(join(repoRoot, "docs", "concerns.md"), "utf8");
  for (const name of ADVISED_CONCERNS) {
    assert.ok(md.includes(concernPath(name)), `docs/concerns.md must show ${concernPath(name)}`);
  }
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd cli && npx tsx --test src/concerns.test.ts`
Expected: FAIL — `templates/concerns/shared.md must exist`.

- [ ] **Step 3: Write the six starters**

`templates/concerns/shared.md`:

```markdown
# Shared

Rules that bind everywhere in this repository. Replace every example below
with something actually true here, and delete what does not apply.

- <e.g. data crossing a boundary is validated against a schema before it
  reaches business logic>
- <e.g. a module depends on an interface, never on a concrete client>
- <e.g. names come from the domain glossary; code reads like the team talks>
```

`templates/concerns/front-end.md`:

```markdown
# Front-end

- <e.g. no user-facing string is hardcoded; text is read through this
  repository's translation system with an identifier key>
- <e.g. primitive component libraries stay text-free — text arrives as props>
- <e.g. server state is not copied into local state>
```

`templates/concerns/backend.md`:

```markdown
# Backend

- <e.g. transport, business rules, and persistence stay in separate units>
- <e.g. calls to one external provider go through a single client>
- <e.g. every endpoint validates its input before a service sees it>
```

`templates/concerns/database.md`:

```markdown
# Database

- <e.g. SQL lives in migrations and repositories, nowhere else>
- <e.g. a migration is reversible, or says in its description why it is not>
- <e.g. a column is never repurposed; add a new one and backfill>
```

`templates/concerns/qa.md`:

```markdown
# QA

How this repository proves a change actually works — in enough detail to
follow without asking someone.

- <e.g. run the end-to-end suite against a deployed preview, not a mock>
- <e.g. read any secret off the environment being driven; never commit one
  and never print one>
- <e.g. a scenario that talks to a real dependency is run twice before
  pushing>
```

`templates/concerns/ci.md`:

```markdown
# CI

- <e.g. the failing job's log is read before anything is pushed>
- <e.g. a re-run is allowed only when the failure matches a known signature
  and nothing in the area it names has changed>
- <e.g. a change with no behaviour carries the label that skips the
  acceptance gate, applied before the final push>
```

- [ ] **Step 4: Write the convention document**

Create `docs/concerns.md`:

```markdown
# Repository concerns

`.fieldnote/concerns/` is where your repository writes its own rules. A skill
reads the file that matters at the moment it matters — before it touches a UI
file, before it says a change works, when a check goes red.

## The folder

    .fieldnote/concerns/shared.md      rules that bind everywhere in your code
    .fieldnote/concerns/front-end.md   your UI rules
    .fieldnote/concerns/backend.md     your service and API rules
    .fieldnote/concerns/database.md    your schema and migration rules
    .fieldnote/concerns/qa.md          how you actually prove a change works
    .fieldnote/concerns/ci.md          what to do when a check goes red

Those six are **strongly advised, not fixed**. A command-line tool has no
front end. A mobile repository may want `ios.md`. A repository doing model
work may want `prompts.md`. Adding one is dropping in a file — there is no
list anywhere you have to update, and no check will reject the name.

Start from `templates/concerns/`: copy the folder, keep the files you need,
and replace the examples.

## What goes in a file

Short imperative rules, one per bullet. A rule may cite a longer document in
your repository when the detail does not fit in a sentence or two.

    # Front-end

    - No user-facing string is hardcoded. Text is read through this
      repository's translation system with an identifier key.
    - A string rendered by a shared feature component belongs to that
      component's own catalog; a string only one application renders belongs
      to that application's catalog.
    - Primitive component libraries stay text-free — text arrives as props.
      **See:** the front-end guidelines document named under `Docs` in the
      profile.

That citation is what lets a long rule live here as three lines without
losing anything.

Your files may be as framework-specific as your repository is. The starters
we ship cannot be — they have to read sensibly in any repository — but yours
is yours.

## Which file does this sentence belong in

| | Lives in | Example |
|---|---|---|
| A **fact** | `.fieldnote/profile.md` | which command runs the checks |
| A **bar** — when is this done | `.fieldnote/definition-of-done.md` | "every required check is green" |
| A **rule** — how this repository is built | `.fieldnote/concerns/<name>.md` | "SQL lives in migrations and repositories, nowhere else" |
| **Universal practice** | the skill itself | work in small slices; stop after three failed attempts |

A sentence that fits two rows is written wrong — split it.

## What a concern file cannot do

It can **add** constraints. It cannot **remove** steps. You can say "a
migration needs a second reviewer". You cannot switch off writing the test
first, or the stop after three failed attempts. A repository that needs a step
gone is asking for a change to the skill — the same rule the profile already
states about procedure.

## If you write nothing

Every skill degrades rather than stopping. It says so once, at the moment it
looked, and carries on with general practice:

> No `.fieldnote/concerns/shared.md` — using general practice.
> `fieldnote-setup-profile` can draft one.

That fallback is a guess about your repository, and it will be wrong in
exactly the places you care about. Three bullets per file is a cheaper fix
than finding out in review.

## Which skills read which files

A skill that reads concern files declares `variance: templated` and lists the
ones it always reads:

    variance: templated
    concerns: [shared, qa, ci]

`fieldnote-skills doctor` reads that list and tells you which files your
repository does not have.

`fieldnote-do-work` declares `[shared]` — the one it always reads. Which
others it reads depends on what the change touches, which is a judgement, not
something frontmatter can hold.

## The `Architecture` section of the profile

Superseded by `.fieldnote/concerns/shared.md`. It was a bare list with no room
for detail and no way to cite a longer document. Move its bullets into
`shared.md`; `fieldnote-setup-profile` will offer to do it for you.
```

- [ ] **Step 5: Run the tests and the guard**

Run:
```bash
cd cli && npx tsx --test src/concerns.test.ts && cd .. && npm run check:decoupling
```
Expected: tests PASS; decoupling reports no violations across the now-larger template set.

- [ ] **Step 6: Commit**

```bash
git add templates/concerns docs/concerns.md cli/src/concerns.test.ts
git commit -m "docs: add the concerns convention and its six starters"
```

---

### Task 5: `doctor` reports what this repository is missing

**Files:**
- Modify: `cli/src/concerns.ts` (add `classifyConcerns`)
- Modify: `cli/src/concerns.test.ts` (append tests)
- Modify: `cli/src/commands/doctor.ts` (render the section; extend the JSON payload)
- Modify: `cli/src/commands/doctor.test.ts` (append a test)

**Interfaces:**
- Consumes: `findConcerns`, `sortConcerns` (Task 1); `CatalogEntry.concerns` (Task 2).
- Produces: `ConcernRow { name: string; present: boolean; wantedBy: string[] }`; `classifyConcerns(input: { present: string[]; declaredBy: Map<string, string[]> }): ConcernRow[]`.

- [ ] **Step 1: Write the failing tests**

Append to `cli/src/concerns.test.ts` (add `classifyConcerns` to the import):

```ts
test("classifyConcerns pairs what skills want with what the repository has", () => {
  const rows = classifyConcerns({
    present: ["shared", "ci"],
    declaredBy: new Map([
      ["fieldnote-do-work", ["shared"]],
      ["fieldnote-pr-monitor", ["ci"]],
      ["fieldnote-fix-bug", ["shared", "qa"]],
    ]),
  });
  assert.deepEqual(rows, [
    { name: "shared", present: true, wantedBy: ["fieldnote-do-work", "fieldnote-fix-bug"] },
    { name: "qa", present: false, wantedBy: ["fieldnote-fix-bug"] },
    { name: "ci", present: true, wantedBy: ["fieldnote-pr-monitor"] },
  ]);
});

test("classifyConcerns reports a file no installed skill asked for", () => {
  const rows = classifyConcerns({ present: ["prompts"], declaredBy: new Map() });
  assert.deepEqual(rows, [{ name: "prompts", present: true, wantedBy: [] }]);
});

test("classifyConcerns on a repository with nothing returns nothing", () => {
  assert.deepEqual(classifyConcerns({ present: [], declaredBy: new Map() }), []);
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd cli && npx tsx --test src/concerns.test.ts`
Expected: FAIL — `classifyConcerns` is not exported.

- [ ] **Step 3: Add the classifier**

Append to `cli/src/concerns.ts`:

```ts
/** One concern: who reads it, and whether this repository wrote it. */
export interface ConcernRow {
  name: string;
  present: boolean;
  /** Installed skills that declared this concern, in name order. */
  wantedBy: string[];
}

/**
 * Pair what the installed skills declare against what the repository has.
 *
 * Pure: the command layer gathers the inputs and renders the output, the same
 * split `doctor-state.ts` uses, so every state is testable without a disk.
 * A file nobody asked for is still reported — it confirms the folder was seen,
 * and a name nothing reads is worth knowing about.
 */
export function classifyConcerns(input: {
  present: string[];
  declaredBy: Map<string, string[]>;
}): ConcernRow[] {
  const have = new Set(input.present);
  const wantedBy = new Map<string, string[]>();
  for (const [skill, concerns] of [...input.declaredBy].sort(([a], [b]) => (a < b ? -1 : 1))) {
    for (const name of concerns) {
      const list = wantedBy.get(name);
      if (list === undefined) wantedBy.set(name, [skill]);
      else list.push(skill);
    }
  }
  const names = sortConcerns([...new Set([...input.present, ...wantedBy.keys()])]);
  return names.map((name) => ({
    name,
    present: have.has(name),
    wantedBy: wantedBy.get(name) ?? [],
  }));
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd cli && npx tsx --test src/concerns.test.ts`
Expected: PASS.

- [ ] **Step 5: Render the section in `doctor`**

In `cli/src/commands/doctor.ts`, add the import and widen the existing type import:

```ts
import { classifyConcerns, concernPath, findConcerns, type ConcernRow } from "../concerns.js";
import type { Catalog, Env } from "../types.js";   // replaces `import type { Env }`
```

Add this function above `runDoctor`:

```ts
/**
 * The repository section. Only skills that are actually installed are asked
 * about: a file the reader has no skill to read is not a gap.
 */
function concernRows(env: Env, catalog: Catalog, installed: Set<string>): ConcernRow[] {
  if (env.repoRoot === null) return [];
  const declaredBy = new Map<string, string[]>();
  for (const skill of catalog.skills) {
    if (!installed.has(skill.name)) continue;
    if (skill.concerns !== undefined && skill.concerns.length > 0) declaredBy.set(skill.name, skill.concerns);
  }
  return classifyConcerns({ present: findConcerns(env.repoRoot), declaredBy });
}

function concernSection(rows: ConcernRow[], repoRoot: string): string[] {
  const lines = [`This repository  ${repoRoot}`];
  if (rows.length === 0) {
    lines.push("  no .fieldnote/concerns/ — skills fall back to general practice");
    lines.push("  `fieldnote-setup-profile` can draft them; see docs/concerns.md");
    return lines;
  }
  for (const row of rows) {
    const mark = row.present ? "✔" : "⚠";
    const who = row.wantedBy.length === 0 ? "read by nothing installed" : `read by ${row.wantedBy.join(", ")}`;
    const state = row.present ? who : `${who} — not present`;
    lines.push(`  ${mark} ${concernPath(row.name)}   ${state}`);
  }
  return lines;
}
```

Inside `runDoctor`, after `const tree = await scanInstalledSkills(env);` compute the rows:

```ts
  const concerns = concernRows(env, catalog, new Set(Object.keys(manifest.skills)));
```

Add to the JSON payload object, after `claudeAi`:

```ts
          repository: { root: env.repoRoot, concerns },
```

And in the human path, insert before the `claude.ai` block:

```ts
  if (env.repoRoot !== null) {
    env.logger.info("");
    for (const line of concernSection(concerns, env.repoRoot)) env.logger.info(line);
  }
```

Finally, a missing concern is not release drift, so it must not change the exit code: leave `drift` computed from `rows` alone.

- [ ] **Step 6: Write the command test**

Append to `cli/src/commands/doctor.test.ts`. It uses that file's existing
`makeHarness` / `writeLockFor` / `installEntries` idiom; `mkdir`, `writeFile`,
`join`, `toEntry` and `FixtureSkill` are already imported there.

```ts
test("names a concern file an installed skill reads and this repository lacks", async () => {
  const skill: FixtureSkill = {
    name: "fieldnote-do-work",
    stage: "build",
    surface: "code",
    variance: "templated",
    concerns: ["shared", "qa"],
  };
  const h = await makeHarness([skill]);
  try {
    await writeLockFor(h, "skills-v1.0.0", { skills: [skill] });
    await installEntries(h.env, [toEntry(skill)]);
    await mkdir(join(h.repoRoot, ".fieldnote", "concerns"), { recursive: true });
    await writeFile(join(h.repoRoot, ".fieldnote", "concerns", "shared.md"), "# Shared\n", "utf8");

    const code = await runDoctor(h.env, {});

    assert.equal(code, 0, "a missing concern file is not release drift");
    const out = h.logger.infos.join("\n");
    assert.match(out, /\.fieldnote\/concerns\/shared\.md/);
    assert.match(out, /\.fieldnote\/concerns\/qa\.md[^\n]*not present/);
  } finally {
    await h.cleanup();
  }
});
```

- [ ] **Step 7: Run everything and commit**

```bash
cd cli && npm test && npm run typecheck && cd ..
npm run validate && npm run check:decoupling
git add cli/src/concerns.ts cli/src/concerns.test.ts cli/src/commands/doctor.ts cli/src/commands/doctor.test.ts
git commit -m "feat(cli): report missing concern files from doctor"
```

---

### Task 6: Retire the profile's `Architecture` section

**Files:**
- Modify: `docs/profile.md` (the `### Architecture` section)
- Modify: `skills/fieldnote-testing/SKILL.md` (the sentence citing `Architecture` rules)
- Modify: `cli/src/profile.test.ts` (append the compatibility test)

**Interfaces:**
- Consumes: `docs/concerns.md` (Task 4).
- Produces: nothing new. `cli/src/profile.ts` is deliberately unchanged — an existing profile must keep parsing.

- [ ] **Step 1: Write the failing test**

Append to `cli/src/profile.test.ts`:

```ts
test("a retired Architecture section still parses, so an existing profile does not break", () => {
  const profile = parseProfile(
    "## Architecture\n\n- Persistence stays behind a repository interface.\n",
  );
  assert.deepEqual(profile.architecture, ["Persistence stays behind a repository interface."]);
});

test("docs/profile.md sends the reader from Architecture to the concerns folder", () => {
  const md = readFileSync(join(import.meta.dirname, "..", "..", "docs", "profile.md"), "utf8");
  assert.match(md, /### Architecture \(superseded\)/);
  assert.match(md, /\.fieldnote\/concerns\/shared\.md/);
});
```

Add `readFileSync` / `join` imports to that file if it does not already have them.

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd cli && npx tsx --test src/profile.test.ts`
Expected: the first test PASSES (the parser is unchanged, which is the point); the second FAILS.

- [ ] **Step 3: Mark the section superseded**

In `docs/profile.md`, replace the whole `### Architecture` section with:

```markdown
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
```

In the *If a key isn't being picked up* section, leave the list of nine section
names exactly as it is — the parser's behaviour has not changed — and append
one sentence to that bullet:

```markdown
  `Architecture` is still recognized, but superseded: write new rules in
  `.fieldnote/concerns/shared.md` instead (see [docs/concerns.md](concerns.md)).
```

- [ ] **Step 4: Repoint `fieldnote-testing`**

In `skills/fieldnote-testing/SKILL.md`, replace:

```markdown
A primitive the `Architecture` rules mark text-free stays text-free and needs no new tests.
```

with:

```markdown
A component the rules in `.fieldnote/concerns/front-end.md` mark text-free stays text-free and needs no new tests.
```

Add to that skill's `## References` list:

```markdown
- Repository rules: `.fieldnote/concerns/` — read the file for the area under test
```

- [ ] **Step 5: Run everything and commit**

```bash
cd cli && npm test && cd ..
npm run validate && npm run check:decoupling && npm run catalog
git add docs/profile.md skills/fieldnote-testing/SKILL.md cli/src/profile.test.ts catalog.json CATALOG.md skills.lock.json
git commit -m "docs: supersede the profile's Architecture section with concerns/shared.md"
```

`fieldnote-testing`'s frontmatter is unchanged, but its body changed, so
`skills.lock.json` gains a new content hash for it. Include whichever of the
three generated files actually changed; `git diff --exit-code -- catalog.json
CATALOG.md skills.lock.json` must be clean before you commit.

---

### Task 7: Ship `fieldnote-do-work`

**Files:**
- Create: `skills/fieldnote-do-work/SKILL.md`
- Modify: `README.md` (the not-yet-shipped paragraph)
- Modify: `docs/the-loop.md` (the Build and Fix entries, and the reference count)

**Interfaces:**
- Consumes: the validation rules (Task 3); `templates/concerns/` and `docs/concerns.md` (Task 4).
- Produces: a skill named `fieldnote-do-work`, `variance: templated`, `concerns: [shared]` — the target of the thirteen existing references in `fieldnote-deliver` and `fieldnote-parallel-wave`.

- [ ] **Step 1: Write the skill**

Create `skills/fieldnote-do-work/SKILL.md`:

```markdown
---
name: fieldnote-do-work
description: Implement one slice of work to standard — confirm the ask is clear, right-size any delegated agent, work in tracer bullets test-first, respect the rules this repository wrote down, and carry it to a green pull request or an honest stop. Use when implementing, doing work, building a change, picking up a ticket, or starting to code.
stage: build
variance: templated
concerns: [shared]
surface: code
version: 0.1.0
release: skills-v0.1.0
---

# Fieldnote Do Work

The main skill for implementation work. It carries what is true in every
repository. Everything specific to this one comes from three places:
`.fieldnote/profile.md` (facts), `.fieldnote/definition-of-done.md` (bars),
and `.fieldnote/concerns/` (rules).

## Confirm The Work Is Clear First

**Given a spec path:** read the spec in full, plus whatever its handoff
section names. The spec's scenarios are the definition of done, so the ask is
clear by construction. Work on the branch the handoff names — never directly
on the branch named under `Git → baseBranch`.

**Without a spec:** confirm the task states a clear, testable "done" before
writing any code. If the acceptance criteria are missing, ambiguous, or
contradictory — no definition of done, readable two materially different
ways, a key term undefined, a conflict with the parent issue — **stop and
return "needs clarification"**, naming what is unclear and the question that
would resolve it. Do not implement on a guess.

Dispatched as a wave subagent, return `fieldnote-parallel-wave`'s
`needs-clarification` result shape instead of opening a pull request. An
honest stop beats a confident wrong build.

## Right-Size The Model

Model choice is a cost lever. Do not run every subagent on the most capable
tier. Before delegating, gauge the task and pick the cheapest tier that can do
it well. When the task is unfamiliar, scope it first with a cheap read-only
exploration pass that maps the files and patterns involved, then launch the
implementation agent on the right tier.

Match work to a **capability tier**, not a model name:

- **Small / cheap** — mechanical work: renames, find-replace, codemod runs,
  scripted edits with no judgement in them.
- **Mid** — well-specified work following an established local pattern, with
  a clear work list. **The default for execution subagents.**
- **Top** — genuine judgement: architecture, adversarial review, hard
  debugging, or anything a cheaper tier has already struggled with. Keep the
  orchestrator here and push the work down.

State the chosen tier and a one-line reason when launching. Start cheap;
escalate only when the agent struggles.

Cap fan-out. Start with two or three subagents where parallelism actually
helps, and treat four active as the default ceiling. Use five only when the
work splits into genuinely independent lenses or modules. Treat six as a hard
ceiling without explicit human approval. Never run parallel implementation
agents that would edit the same files, and never spawn a subagent for work
the orchestrator can do cheaply in context.

## Start From Architecture

Identify the layer that owns the behaviour before editing anything.

Then read `.fieldnote/concerns/shared.md`, and the file for each concern this
change touches — `front-end.md` if it renders anything, `backend.md` if it
adds a service or an endpoint, `database.md` if it touches schema or a
migration. Those rules bind this change. If one contradicts what you were
about to do, **the rule wins**: say so rather than working around it.

When a rule cites a longer document, read that document if the rule you are
relying on is the one pointing there.

If `.fieldnote/concerns/` does not exist, say so once — "no concern files;
using general practice, and `fieldnote-setup-profile` can draft them" — and
carry on. A missing file never stops the work.

## How To Move

- Work in **tracer bullets**, not layer piles. Prove the smallest vertical
  path end to end, then widen it.
- Prefer **red-green-refactor** when the behaviour is clear: one failing test
  that states the next behaviour, the minimum code to pass it, then refactor
  as a separate step with the tests green. One test at a time.
- Add **characterization tests** before a risky refactor of behaviour that
  already exists.
- Let abstractions earn their keep. Follow the local pattern first; extract
  only when the duplication or the complexity is real.
- Keep seams **narrow and behavioural**. Do not pass broad framework or
  provider objects across them.
- Keep commits and pull requests reviewable: one coherent change at a time,
  no unrelated formatting.

## SOLID

- **Single Responsibility** — each module has one reason to change.
- **Open/Closed** — extend behaviour by adding code, not by editing what
  already works.
- **Liskov Substitution** — an implementation behind a seam honours that
  seam's contract.
- **Interface Segregation** — depend on small, focused ports, not broad
  clients.
- **Dependency Inversion** — depend on abstractions, not on concrete
  implementations.

## Ship

The work is not done at "tests pass locally". It is done at a green pull
request, or at a comment that says exactly what is stuck. The bar for this
stage is the **Do work** section of the document named under
`Docs → definitionOfDone`.

1. **Preflight.** Run the command under `Commands → preflight`. Fix until
   green. If that key is absent or reads `TODO`, ask for it once rather than
   guessing a command.
2. **Run your own scenarios, before the push.** CI is not a test loop: a run
   that takes half an hour to tell you what a local run tells you in two is
   not where you discover a broken scenario. Read `.fieldnote/concerns/qa.md`
   for how this repository proves a change works, and follow it against a
   real target rather than a mock. Read any secret off the environment you
   are driving; never commit one and never print one.
3. **Open the pull request** with `fieldnote-pull-request`, branching off the
   remote and branch named under `Git`, with a Conventional Commit title.
4. **Watch.** Wait for the run to finish. Do not push meanwhile.
5. **On red**, read the failing job's log first. Then read
   `.fieldnote/concerns/ci.md` and the document under `Docs → ciTriage`. A
   re-run is allowed only when the failure matches a signature one of those
   names, and it counts as an attempt. Otherwise fix the cause, preflight,
   push, and return to step 4.
6. **Stop after three attempts.** Mark the pull request as a draft and
   comment, then report the link and "stuck" in one line:

   ```markdown
   ## Stuck after 3 attempts

   **Red check:** <job name> — <one-line failure>
   **Tried:** 1. … 2. … 3. …
   **I believe:** <what is wrong, one paragraph>
   **A human should look at:** <file or job>, because <reason>
   ```

Every hand-off line, green or stuck, names the checks that ran and the checks
that did not.

**When dispatched by `fieldnote-parallel-wave`:** stop after step 3 and
return the wave's result shape. The orchestrator owns the watch; never watch
CI from inside a wave.

## Pair With

- `fieldnote-testing` — choosing and adding tests.
- `fieldnote-pull-request` — preparing the pull request body.
- `fieldnote-setup-profile` — when the profile, the definition of done, or
  `.fieldnote/concerns/` is missing or still full of TODO.
```

- [ ] **Step 2: Validate, regenerate the catalog, run the guard**

```bash
npm run validate && npm run check:decoupling && npm run catalog
```
Expected: validate reports 9 skills valid; decoupling reports no violations; `catalog.json`, `CATALOG.md` and `skills.lock.json` gain the new entry.

- [ ] **Step 3: Update the two documents that say it does not ship**

In `README.md`, under `## Status`, replace the first two paragraphs with:

```markdown
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
```

Leave the `fieldnote-pr-monitor` paragraph that follows untouched.

In `docs/the-loop.md`, in the **Build** entry change:

```markdown
`fieldnote-do-work` *(not yet shipped)* — the repository's own implementation
```

to:

```markdown
`fieldnote-do-work` *(shipped)* — the repository's own implementation
```

Leave the *(not yet shipped)* marker on the **Fix** and **Review** entries.
Then replace the body of `## Where the gap bites today` with:

```markdown
The shipped skills still assume one missing skill exists.
`fieldnote-pull-request` recognizes a PR opened by `fieldnote-fix-bug` — 1
reference. `fieldnote-do-work`, which `fieldnote-parallel-wave` and
`fieldnote-deliver` hand implementation to across 13 references, now ships
and reads this repository's rules from `.fieldnote/concerns/`. Until a later
phase ships the remaining four, bring your own step where they're named.
```

- [ ] **Step 4: Re-run the guard and commit**

```bash
npm run validate && npm run check:decoupling
git add skills/fieldnote-do-work README.md docs/the-loop.md catalog.json CATALOG.md skills.lock.json
git commit -m "feat(skills): ship fieldnote-do-work"
```

---

### Task 8: `fieldnote-setup-profile` drafts the concern files

**Files:**
- Modify: `skills/fieldnote-setup-profile/SKILL.md`

**Interfaces:**
- Consumes: `templates/concerns/` and `docs/concerns.md` (Task 4); the superseded `Architecture` section (Task 6).
- Produces: nothing other skills read. This is the on-ramp.

- [ ] **Step 1: Add the drafting step**

In `skills/fieldnote-setup-profile/SKILL.md`, insert a new section immediately
after `### 3. Resolve the definition of done`, renumbering the sections that
follow (4 → 5, 5 → 6, 6 → 7):

```markdown
### 4. Draft the concern files

`.fieldnote/concerns/` is where this repository writes its own rules — the
ones a skill reads before it touches a UI file, before it says a change
works, or when a check goes red. Advised files: `shared.md`, `front-end.md`,
`backend.md`, `database.md`, `qa.md`, `ci.md`. A repository may name its own.

Draft only what the repository actually shows you:

- **A profile with an `Architecture` section** — that section is superseded.
  Move its bullets into `shared.md` verbatim and say you moved them.
- **Written rules already in the repository** — a contributing guide, a
  coding-standards document, a rules file an agent already reads. Lift the
  rules that bind, and cite the source document rather than copying it whole.
- **Nothing to read** — write the file from `templates/concerns/` with its
  examples intact, and say plainly that it is a starter nobody has filled in.

Do not invent a rule. A rule nobody wrote down is not a rule, and an invented
one is worse than an absent one because every skill downstream will obey it.

Only draft a file for a concern this repository has: no `front-end.md` for a
command-line tool, no `database.md` for a repository with no database.
```

- [ ] **Step 2: Extend the write step**

In what is now `### 7. Write, then stop`, replace the first sentence with:

```markdown
On approval, write `.fieldnote/profile.md`, plus
`.fieldnote/definition-of-done.md` and any `.fieldnote/concerns/*.md` that
were drafted.
```

- [ ] **Step 3: Add an edge case**

Append to `## Notes / edge cases`:

```markdown
- **A concern file already exists** — leave it alone. Report that it is
  there and was not touched. These are hand-written rules; overwriting them
  is the one unrecoverable thing this skill could do.
```

- [ ] **Step 4: Add the references**

Append to `## References`:

```markdown
- https://github.com/dervalp/fieldnote-skills/blob/main/docs/concerns.md
  for the concerns convention and what belongs in each file.
- https://github.com/dervalp/fieldnote-skills/blob/main/templates/concerns/
  for the six starters.
```

- [ ] **Step 5: Bump the version and regenerate**

Raise `version` in that skill's frontmatter by a minor step (`0.1.0` →
`0.2.0`), then:

```bash
npm run validate && npm run check:decoupling && npm run catalog
```

- [ ] **Step 6: Run everything and commit**

```bash
cd cli && npm test && npm run typecheck && cd ..
git add skills/fieldnote-setup-profile catalog.json CATALOG.md skills.lock.json
git commit -m "feat(skills): draft .fieldnote/concerns from setup-profile"
```

---

## Out of scope

`fieldnote-fix-bug`, `fieldnote-brainstorming`, `fieldnote-react-review` and
`fieldnote-react-sweep` are not part of this plan. They use the same seam and
need no new mechanism; each is its own piece of work once `fieldnote-do-work`
has proved the seam in a real repository. The spec's open question — whether
the two React skills keep framework names once their repository-specific half
moves out — is answered then, not now.

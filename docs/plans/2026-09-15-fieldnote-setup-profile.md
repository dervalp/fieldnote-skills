# `/fieldnote-setup-profile` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Claude skill that reads a repository and fills in
`.fieldnote/profile.md` — plus the four smaller changes it stands on.

**Architecture:** Four independent enabling changes land first (a
definition-of-done convention, a `(none)` marker in the profile parser, a
`Setup` stage in the installer, and an `init --print` mode), then the skill
itself, which composes them. The CLI keeps doing what a regex can prove; the
skill does what needs judgment from evidence.

**Tech Stack:** TypeScript (ESM, `node:test` + `node:assert/strict`, no test
framework), Node >= 21, `@inquirer/prompts`, `chalk`. Tests run with
`node --import tsx --test`.

**Spec:** `docs/specs/2026-09-15-fieldnote-setup-profile-design.md`

## Global Constraints

- **Every file you add under `docs/` or `templates/` is scanned by
  `npm run check:decoupling`**, via `git ls-files docs/*.md docs/**/*.md
  templates/**`. It rejects a private brand name, a decision-record citation, a
  monorepo-layout path, and an agent-docs path. The exact patterns are in
  `cli/src/decoupling.ts` — **read them there, and never restate them in
  prose**, because the guard scans your documentation too and will flag your
  own example. (This plan tripped that trap while being written.) Describe the
  class instead: "a private-brand reference". Check any file before committing:

  ```bash
  node --import tsx -e 'import { findCouplingViolations } from "./cli/src/decoupling.js";
  import { readFileSync } from "node:fs";
  const p = process.argv[1];
  console.log(findCouplingViolations(p, readFileSync(p, "utf8")).join("\n") || "clean");
  ' <path-to-file>
  ```
- **Every file under `skills/` is scanned by the same guard**, always, tracked
  or not.
- Run from the repo root: `npm run validate`, `npm run catalog`,
  `npm run check:decoupling`. Run from `cli/`: `npm test`, `npm run typecheck`.
- `npm run catalog` writes `CATALOG.md`, `catalog.json`, and
  `skills.lock.json`. **Commit what it writes; never hand-edit those three.**
- Conventional Commit titles. End every commit message with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- Branch off `origin/main`. Do not merge; stop at the human gate.
- Existing tests use `node:test` with top-level `test(...)` calls and
  `assert` from `node:assert/strict`. Match that. No `describe`/`it`.

---

### Task 1: The definition-of-done convention

Establishes the five fixed headings a skill can locate its own section by,
documents them, and ships a starter template. The headings become a machine-
checked constant so the doc, the template, and later the skill cannot drift
apart.

**Files:**
- Create: `cli/src/dod.ts`
- Create: `cli/src/dod.test.ts`
- Create: `docs/definition-of-done.md`
- Create: `templates/definition-of-done.md`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `DOD_SECTIONS: readonly ["Always", "PRD", "Do work", "Pull request", "Deployment"]`
  - `DOD_CONVENTION_PATH = ".fieldnote/definition-of-done.md"`
  - `DOD_FILENAME = "definition-of-done.md"`
  - `findDodSections(markdown: string): string[]` — the `##` headings present,
    in document order, filtered to known section names.
  - `missingDodSections(markdown: string): string[]` — the members of
    `DOD_SECTIONS` absent from the markdown, in `DOD_SECTIONS` order.

- [ ] **Step 1: Write the failing test**

Create `cli/src/dod.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DOD_SECTIONS,
  DOD_CONVENTION_PATH,
  DOD_FILENAME,
  findDodSections,
  missingDodSections,
} from "./dod.js";

const repoRoot = join(import.meta.dirname, "..", "..");

test("the convention names five sections in the order work passes through them", () => {
  assert.deepEqual(
    [...DOD_SECTIONS],
    ["Always", "PRD", "Do work", "Pull request", "Deployment"],
  );
});

test("the convention path sits next to the profile", () => {
  assert.equal(DOD_CONVENTION_PATH, ".fieldnote/definition-of-done.md");
  assert.equal(DOD_FILENAME, "definition-of-done.md");
});

test("findDodSections returns known headings in document order", () => {
  const md = "# Definition of done\n\n## PRD\n\n- a\n\n## Deployment\n\n- b\n";
  assert.deepEqual(findDodSections(md), ["PRD", "Deployment"]);
});

test("findDodSections ignores headings that are not part of the convention", () => {
  const md = "## Always\n\n## Release notes\n\n## PRD\n";
  assert.deepEqual(findDodSections(md), ["Always", "PRD"]);
});

test("findDodSections ignores a heading that is not exactly two hashes plus a space", () => {
  const md = "### PRD\n##PRD\n# PRD\n## Always\n";
  assert.deepEqual(findDodSections(md), ["Always"]);
});

test("missingDodSections names what a document still needs, in convention order", () => {
  const md = "## Deployment\n\n## PRD\n";
  assert.deepEqual(missingDodSections(md), ["Always", "Do work", "Pull request"]);
});

test("a complete document is missing nothing", () => {
  const md = DOD_SECTIONS.map((s) => `## ${s}\n`).join("\n");
  assert.deepEqual(missingDodSections(md), []);
});

test("the shipped template carries every section of the convention", () => {
  const md = readFileSync(join(repoRoot, "templates", "definition-of-done.md"), "utf8");
  assert.deepEqual(missingDodSections(md), []);
});

test("the convention document shows every section, so the doc cannot drift from the code", () => {
  const md = readFileSync(join(repoRoot, "docs", "definition-of-done.md"), "utf8");
  for (const section of DOD_SECTIONS) {
    assert.ok(md.includes(`## ${section}`), `docs/definition-of-done.md must show "## ${section}"`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd cli && node --import tsx --test src/dod.test.ts`
Expected: FAIL — `Cannot find module './dod.js'`.

- [ ] **Step 3: Write the module**

Create `cli/src/dod.ts`:

```ts
/**
 * The definition-of-done convention.
 *
 * A repository's definition of done is one document with five FIXED headings,
 * so a skill can locate its own section instead of reading the whole document
 * and hoping. The headings are the stages work passes through, in order, which
 * is what makes the document writable: "when is a slice done?" is unanswerable
 * until you have named the stages.
 *
 * The names live here, in code, because the documentation, the template, and
 * (later) the skill all have to agree on them. A test pins each of those
 * against this list.
 */
export const DOD_SECTIONS = [
  "Always",
  "PRD",
  "Do work",
  "Pull request",
  "Deployment",
] as const;

export type DodSection = (typeof DOD_SECTIONS)[number];

/** Where the convention puts the document: beside `.fieldnote/profile.md`. */
export const DOD_CONVENTION_PATH = ".fieldnote/definition-of-done.md";

/**
 * The basename to look for anywhere else in the repository, for a repository
 * that already had a definition of done before it met this convention.
 */
export const DOD_FILENAME = "definition-of-done.md";

/** `## <heading>` — exactly two hashes and a space, matching the profile's own rule. */
const HEADING_RE = /^##[ \t]+(.+?)[ \t]*$/;

const KNOWN = new Set<string>(DOD_SECTIONS);

/** The convention's sections present in `markdown`, in document order. */
export function findDodSections(markdown: string): string[] {
  const found: string[] = [];
  for (const raw of markdown.split("\n")) {
    const match = HEADING_RE.exec(raw.trim());
    if (!match) continue;
    const heading = match[1]!;
    if (KNOWN.has(heading) && !found.includes(heading)) found.push(heading);
  }
  return found;
}

/** The convention's sections absent from `markdown`, in convention order. */
export function missingDodSections(markdown: string): string[] {
  const present = new Set(findDodSections(markdown));
  return DOD_SECTIONS.filter((section) => !present.has(section));
}
```

- [ ] **Step 4: Write the starter template**

Create `templates/definition-of-done.md`:

```markdown
# Definition of done

Copy this to `.fieldnote/definition-of-done.md` and replace each bullet with
what is actually true here. Keep the five headings exactly as they are — a
skill looks for its own section by name.

Delete a bullet that does not apply. An empty section is honest; a section
full of aspirations you do not enforce is worse than nothing.

## Always

Rules that hold at every stage.

- <e.g. commit titles follow a stated convention>
- <e.g. no secret, token, or credential is ever committed>

## PRD

Done when the Product Requirement Description is ready to be built from.

- <the problem is stated before the solution>
- <sliced into vertical slices, each one shippable on its own>
- <dependencies between slices are recorded, so "takeable now" is computable>

## Do work

Done when one slice is implemented.

- <the promised behaviour works, and a test proves it>
- <the command that runs this repository's checks passes>
- <generated files were regenerated, not hand-edited>

## Pull request

Done when it is ready for someone else to merge.

- <the description carries real evidence, not placeholders>
- <every required check is green>
- <it is not merged by its own author>

## Deployment

Done when the change is actually live.

- <the release or deploy step ran and succeeded>
- <someone can use the change through the real product surface>
- <the documentation describes what now ships>

A slice is not done because it works on your machine. It is done at a green
pull request. A PRD is not done because the last pull request merged. It is
done when someone else can use the thing.
```

- [ ] **Step 5: Write the convention document**

Create `docs/definition-of-done.md`:

```markdown
# The definition of done

Every skill in this repository has to answer one question at some point: is
this done? Without a written answer, each one invents its own, they do not
agree with each other, and none of them agree with you.

This document defines where that answer lives and what shape it takes.

## Where it lives

Resolved in this order:

1. `.fieldnote/definition-of-done.md` — the convention, beside `profile.md`
2. any `definition-of-done.md` among the repository's git-tracked files
3. nothing found

Whatever is found is recorded under `Docs → definitionOfDone` in
`.fieldnote/profile.md`. The convention is a default, not a rule: a repository
whose document already lives somewhere else just points at it, and step 2
finds it without being told.

Restricting the search to git-tracked files is deliberate — it keeps the
search out of `node_modules` and any other vendored tree.

## The five sections

The headings are fixed, so a skill can find its own section rather than
reading the whole document and guessing which part applies to it.

## Always

Rules that hold at every stage.

## PRD

Done when the Product Requirement Description — what a brainstorm produces —
is ready to be built from.

## Do work

Done when one slice is implemented.

## Pull request

Done when it is ready for someone else to merge.

## Deployment

Done when the change is actually live.

The order is the order the work passes through: brainstorm → PRD → do work →
pull request → deployment.

Naming the stages is what makes the document writable. "When is a slice done?"
cannot be answered until a slice has been defined; "when is a pull request
ready to merge?" answers itself.

## Two bars, not one

The most common mistake is writing a single bar and applying it everywhere.
There are at least two:

- **A slice** is not done because it works on your machine. It is done at a
  green pull request.
- **A PRD** is not done because the last pull request merged. It is done when
  someone else can install or use the thing.

"Deployed" means different things in different repositories: a published
release someone installs, a URL responding, a package on a registry. Say which
one yours is — that section will vary more than the other four.

## Starting one

`templates/definition-of-done.md` is a starter with the five headings and
prompts under each. Copy it to `.fieldnote/definition-of-done.md` and replace
the prompts.

Delete a bullet that does not apply. An empty section is honest; a section
full of aspirations nobody enforces is worse than nothing.

## If you have none

Skills degrade rather than stop: each falls back to its own built-in bar and
says so. But that fallback is a guess about your repository, and it will be
wrong in the ways that matter most — what "tested enough" means, whether a
deploy is part of the job, who is allowed to merge. Writing four bullets under
each heading is a cheaper fix than discovering the mismatch in review.
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd cli && node --import tsx --test src/dod.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 7: Run the full suite, typecheck, and the guards**

Run:
```bash
cd cli && npm test && npm run typecheck
cd .. && npm run validate && npm run check:decoupling
```
Expected: all pass. `check:decoupling` now reports 8 doc/template file(s).

If `check:decoupling` flags either new file, you have named a forbidden token
in prose — reword it as a description rather than deleting the sentence.

- [ ] **Step 8: Commit**

```bash
git add cli/src/dod.ts cli/src/dod.test.ts docs/definition-of-done.md templates/definition-of-done.md
git commit -m "$(cat <<'EOF'
feat: define the definition-of-done convention

Every skill has to decide "is this done?" and today nothing says so, which
means each one invents its own bar. Five fixed headings — Always, PRD, Do
work, Pull request, Deployment — let a skill find its own section instead of
reading the whole document and guessing.

The names live in cli/src/dod.ts so the documentation, the template, and
later the skill cannot drift apart; tests pin the two documents against
that list.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The `(none)` marker

Today a key that will never apply here and a key nobody has filled in both
read `TODO`. They are different facts. `(none)` means *decided: this
repository has none*.

**Files:**
- Modify: `cli/src/profile.ts:12-22` (the `Profile` interface), `cli/src/profile.ts:36-77` (`parseProfile`)
- Modify: `cli/src/profile.test.ts` (append)
- Modify: `docs/profile.md` (append a section before "If a key isn't being picked up")

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `NONE_MARKER = "(none)"`
  - `Profile.declaredAbsent: Set<string>` — dotted keys, e.g. `commands.mutation`.
    A section-level marker records the bare section name, e.g. `localization`.
  - `isDeclaredAbsent(profile: Profile, dottedKey: string): boolean`

- [ ] **Step 1: Write the failing test**

Append to `cli/src/profile.test.ts`:

```ts
test("a (none) value is omitted from the record, so nothing can run it as a command", () => {
  const p = parseProfile("## Commands\n\n- **check** — pnpm check\n- **mutation** — (none)\n");
  assert.equal(p.commands.check, "pnpm check");
  assert.equal(p.commands.mutation, undefined);
});

test("a (none) value is recorded as declared-absent, distinct from never answered", () => {
  const p = parseProfile("## Commands\n\n- **mutation** — (none)\n- **preflight** — TODO\n");
  assert.ok(p.declaredAbsent.has("commands.mutation"));
  assert.ok(!p.declaredAbsent.has("commands.preflight"));
  assert.equal(p.commands.preflight, "TODO", "TODO still parses verbatim");
});

test("isDeclaredAbsent answers for a key that was never mentioned at all", () => {
  const p = parseProfile("## Commands\n\n- **mutation** — (none)\n");
  assert.equal(isDeclaredAbsent(p, "commands.mutation"), true);
  assert.equal(isDeclaredAbsent(p, "commands.check"), false);
});

test("a whole section can be declared absent with a bare (none) bullet", () => {
  const p = parseProfile("## Localization\n\n- (none)\n");
  assert.ok(p.declaredAbsent.has("localization"));
  assert.deepEqual(p.localization, {});
});

test("the marker is matched case-insensitively and ignores surrounding space", () => {
  const p = parseProfile("## Commands\n\n- **mutation** —   (None)  \n");
  assert.ok(p.declaredAbsent.has("commands.mutation"));
  assert.equal(p.commands.mutation, undefined);
});

test("a (none) bullet in Architecture declares the section absent, not a rule named (none)", () => {
  const p = parseProfile("## Architecture\n\n- (none)\n");
  assert.deepEqual(p.architecture, []);
  assert.ok(p.declaredAbsent.has("architecture"));
});

test("declaredAbsent is an empty set, never undefined, for a profile that uses no markers", () => {
  const p = parseProfile("# empty\n");
  assert.equal(p.declaredAbsent.size, 0);
});
```

Add `isDeclaredAbsent` to the import at the top of the file:

```ts
import { parseProfile, isDeclaredAbsent } from "./profile.js";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd cli && node --import tsx --test src/profile.test.ts`
Expected: FAIL — no export named `isDeclaredAbsent`.

- [ ] **Step 3: Extend the Profile interface**

In `cli/src/profile.ts`, add to the `Profile` interface after `git`:

```ts
  /**
   * Dotted keys whose value was the `(none)` marker — `commands.mutation` for
   * a key, a bare section name like `localization` for a whole section.
   *
   * The value itself is deliberately NOT kept in the records above: a skill
   * reading `profile.commands.mutation` gets `undefined` and cannot run the
   * literal string "(none)" as a command. This set is how a skill that wants
   * the distinction gets it back.
   */
  declaredAbsent: Set<string>;
```

- [ ] **Step 4: Implement the marker**

In `cli/src/profile.ts`, add near the other constants:

```ts
/** Marks a key or section the repository has decided it does not have. */
export const NONE_MARKER = "(none)";

function isNone(value: string): boolean {
  return value.trim().toLowerCase() === NONE_MARKER;
}
```

Initialise the set in `parseProfile`'s `profile` literal:

```ts
    git: {},
    declaredAbsent: new Set<string>(),
```

Replace the architecture branch so a bare `(none)` declares the section absent
instead of becoming a rule:

```ts
    if (current === "architecture") {
      const item = ITEM_RE.exec(line);
      if (!item) continue;
      const value = item[1]!.trim();
      if (isNone(value)) {
        profile.declaredAbsent.add("architecture");
        continue;
      }
      profile.architecture.push(value);
      continue;
    }
```

Replace the key/value branch so `(none)` is recorded rather than stored, and
so a bare `- (none)` bullet declares the whole section absent:

```ts
    const pair = PAIR_RE.exec(line);
    if (!pair) {
      // A bare `- (none)` under a key/value section declares the whole
      // section absent (e.g. a repository with no localization at all).
      const item = ITEM_RE.exec(line);
      if (item && isNone(item[1]!) && current) profile.declaredAbsent.add(current);
      continue;
    }
    const bucket = (profile as unknown as Record<string, Record<string, string>>)[current];
    if (bucket && typeof bucket === "object" && !Array.isArray(bucket)) {
      const key = pair[1]!.trim();
      const value = pair[2]!.trim();
      if (isNone(value)) {
        profile.declaredAbsent.add(`${current}.${key}`);
        continue;
      }
      bucket[key] = value;
    }
```

Add the accessor at the end of the file:

```ts
/** True when the profile explicitly declared this key or section absent. */
export function isDeclaredAbsent(profile: Profile, dottedKey: string): boolean {
  return profile.declaredAbsent.has(dottedKey);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd cli && node --import tsx --test src/profile.test.ts`
Expected: PASS, including every pre-existing test in the file.

Note: `declaredAbsent` is a `Set`, and one existing test asserts on whole
records with `assert.deepEqual`. If a test that compares a whole `Profile`
object now fails, assert on the individual records rather than the object.

- [ ] **Step 6: Document the marker**

In `docs/profile.md`, insert immediately before the `## If a key isn't being
picked up` heading:

````markdown
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
````

- [ ] **Step 7: Run the full suite and the guards**

Run:
```bash
cd cli && npm test && npm run typecheck
cd .. && npm run validate && npm run check:decoupling
```
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add cli/src/profile.ts cli/src/profile.test.ts docs/profile.md
git commit -m "$(cat <<'EOF'
feat: let a profile say "(none)" instead of leaving TODO

"Nobody filled this in" and "this repository does not have one" were both
spelled TODO, so a skill could not tell a gap from a decision and asked
about the decision every time.

(none) is dropped from the parsed record — a skill reading Commands →
mutation sees undefined and can never run the literal string as a command —
and recorded in declaredAbsent for the skills that want the distinction.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The `Setup` stage

`/fieldnote-setup-profile` runs before plan, build, or review. Filing it under
`plan` would be a small lie a browsing engineer trips over. This task also
fixes the picker's stage ordering, which is alphabetical today and therefore
shows **Build, Plan, Review**.

**Files:**
- Modify: `cli/src/skill-model.ts:12-19` (`VALID_STAGES`, `STAGE_LABELS`)
- Modify: `cli/src/types.ts:5` (`SkillStage`)
- Modify: `cli/src/catalog-build.ts:20` (`STAGE_ORDER`)
- Modify: `cli/src/commands/list.ts` (`buildChoices` ordering)
- Modify: `cli/src/commands/list.test.ts` (append)
- Modify: `cli/src/catalog-build.test.ts` (append)
- Modify: `CONTRIBUTING.md:41`
- Modify: `docs/authoring.md:10-11`

**Interfaces:**
- Consumes: nothing.
- Produces: `VALID_STAGES` is now
  `["setup", "plan", "build", "review"]`; `SkillStage` gains `"setup"`;
  `STAGE_LABELS.setup === "Setup"`.

- [ ] **Step 1: Write the failing tests**

Append to `cli/src/commands/list.test.ts`:

```ts
test("the picker orders stage groups by the loop, not by the alphabet", async () => {
  const h = await makeHarness([
    { name: "fieldnote-run-review", stage: "review" },
    { name: "fieldnote-do-work", stage: "build" },
    { name: "fieldnote-plan-roadmap", stage: "plan" },
    { name: "fieldnote-setup-profile", stage: "setup" },
  ]);
  try {
    const rows = await computeRows(h.env);
    const headers = buildChoices(rows)
      .filter((c) => c.disabled)
      .map((c) => c.name);
    assert.deepEqual(headers, [
      "── Setup ──",
      "── Plan ──",
      "── Build ──",
      "── Review ──",
    ]);
  } finally {
    await h.cleanup();
  }
});

test("setup is a valid stage filter", async () => {
  const h = await makeHarness([
    { name: "fieldnote-setup-profile", stage: "setup" },
    { name: "fieldnote-do-work", stage: "build" },
  ]);
  try {
    h.prompter.checkboxAnswers = [[]];
    await runList(h.env, { stage: "setup" });

    const values = h.prompter.lastCheckboxChoices.map((c) => c.value);
    assert.ok(values.includes("fieldnote-setup-profile"));
    assert.equal(values.includes("fieldnote-do-work"), false);
  } finally {
    await h.cleanup();
  }
});

test("the stage prompt lists setup first", async () => {
  const h = await makeHarness([
    { name: "fieldnote-do-work", stage: "build" },
    { name: "fieldnote-setup-profile", stage: "setup" },
  ]);
  try {
    h.prompter.selectAnswers = ["choose", "setup"];
    h.prompter.checkboxAnswers = [[]];
    await runList(h.env);

    assert.deepEqual(
      h.prompter.lastSelectChoices.map((c) => c.value),
      ["all", "setup", "build"],
    );
  } finally {
    await h.cleanup();
  }
});
```

Append to `cli/src/catalog-build.test.ts`:

```ts
test("CATALOG.md renders the setup stage first", () => {
  const md = renderMarkdown([
    {
      name: "fieldnote-do-work",
      stage: "build",
      surface: "code",
      version: "1.0.0",
      description: "Use when you need to implement something to this repository's standard, end to end.",
      variance: "configured",
      mcp: [],
    },
    {
      name: "fieldnote-setup-profile",
      stage: "setup",
      surface: "code",
      version: "1.0.0",
      description: "Use when a repository needs its fieldnote profile written from what the repository itself says.",
      variance: "universal",
      mcp: [],
    },
  ] as never);
  assert.ok(md.indexOf("## Setup") < md.indexOf("## Build"), "Setup precedes Build");
  assert.ok(md.includes("fieldnote-setup-profile"));
});
```

If `catalog-build.test.ts` builds its fixtures with a local helper rather than
object literals, use that helper instead and keep the two assertions.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd cli && node --import tsx --test "src/**/*.test.ts"`
Expected: FAIL — `Unknown stage "setup"`, and the header-order assertion fails
with `["── Build ──", "── Plan ──", "── Review ──"]`.

- [ ] **Step 3: Add the stage**

In `cli/src/skill-model.ts`:

```ts
/**
 * Position in the delivery loop, in the order work passes through it. Read
 * from frontmatter — the skills tree is flat. `setup` comes first: it is what
 * you do to a repository before any of the other three can run well.
 */
export const VALID_STAGES = ["setup", "plan", "build", "review"] as const;

export const STAGE_LABELS: Record<(typeof VALID_STAGES)[number], string> = {
  setup: "Setup",
  plan: "Plan",
  build: "Build",
  review: "Review",
};
```

In `cli/src/types.ts:5`:

```ts
export type SkillStage = "setup" | "plan" | "build" | "review";
```

In `cli/src/catalog-build.ts:20`:

```ts
const STAGE_ORDER: readonly string[] = ["setup", "plan", "build", "review"];
```

- [ ] **Step 4: Order the picker by the loop**

In `cli/src/commands/list.ts`, add the import:

```ts
import { STAGE_LABELS, VALID_STAGES } from "../skill-rules.js";
```

(That import already exists — leave it as is.) Then replace the loop head in
`buildChoices`:

```ts
  // Ordered by the loop, not by the alphabet: a plain .sort() put Build
  // before Plan, which is not the order anyone works in.
  const stageRank = (stage: string): number => {
    const i = (VALID_STAGES as readonly string[]).indexOf(stage);
    return i === -1 ? VALID_STAGES.length : i;
  };
  const ordered = [...byStage.entries()].sort(
    ([a], [b]) => stageRank(a) - stageRank(b) || (a < b ? -1 : a > b ? 1 : 0),
  );

  const choices: { name: string; value: string; checked?: boolean; disabled?: boolean }[] = [];
  for (const [stage, stageRows] of ordered) {
```

Leave the rest of the loop body unchanged.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd cli && node --import tsx --test "src/**/*.test.ts"`
Expected: PASS.

- [ ] **Step 6: Update the authoring documentation**

In `CONTRIBUTING.md:41`, replace the line with:

```markdown
- **`stage`** — required; one of `setup`, `plan`, `build`, `review`. `setup` is
  for a skill that prepares a repository before the loop runs in it.
```

In `docs/authoring.md`, replace `(`plan` / `build` / `review`)` with
``(`setup` / `plan` / `build` / `review`)``.

- [ ] **Step 7: Regenerate the catalog and run every guard**

Run:
```bash
cd cli && npm test && npm run typecheck
cd .. && npm run validate && npm run catalog && npm run check:decoupling
git diff --stat CATALOG.md catalog.json skills.lock.json
```
Expected: tests and guards pass. The catalog diff is likely empty (no skill
uses `setup` yet) — that is fine. Commit whatever it writes; never hand-edit.

- [ ] **Step 8: Commit**

```bash
git add cli/src/skill-model.ts cli/src/types.ts cli/src/catalog-build.ts \
  cli/src/commands/list.ts cli/src/commands/list.test.ts \
  cli/src/catalog-build.test.ts CONTRIBUTING.md docs/authoring.md \
  CATALOG.md catalog.json skills.lock.json
git commit -m "$(cat <<'EOF'
feat: add a setup stage, and order stage groups by the loop

A skill that prepares a repository runs before plan, build, or review, and
filing it under plan is a small lie a browsing engineer trips over.

The picker sorted its stage groups alphabetically, so it showed Build,
Plan, Review — not the order anyone works in. It now sorts by position in
VALID_STAGES, giving Setup, Plan, Build, Review.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `init --print`

`runInit` hardcodes its destination and refuses to overwrite without
`--force`, so there is no way to probe a repository that already has a profile
without risking the engineer's file. `--print` renders the probed profile to
stdout and writes nothing.

**Files:**
- Modify: `cli/src/commands/init.ts` (`InitFlags`, `runInit`)
- Modify: `cli/src/commands/init.test.ts` (append)
- Modify: `cli/src/index.ts` (the `init` case and `HELP`)

**Interfaces:**
- Consumes: nothing.
- Produces: `runInit(env, opts: { force?: boolean; print?: boolean })`. With
  `print: true` it calls `env.logger.output(markdown)` exactly once, writes no
  file, creates no `.fieldnote/` directory, and returns `0`.

- [ ] **Step 1: Write the failing test**

Append to `cli/src/commands/init.test.ts`:

```ts
test("--print writes the profile to stdout and creates nothing on disk", async () => {
  const repo = mkdtempSync(join(tmpdir(), "fieldnote-init-print-"));
  mkdirSync(join(repo, ".git"), { recursive: true });
  const prevCwd = process.cwd();
  process.chdir(repo);
  try {
    const logger = new FakeLogger();
    const env: Env = {
      claudeDir: "/unused",
      catalogPath: "/unused/catalog.json",
      skillsSourceDir: "/unused/skills",
      repoRoot: null,
      prompter: new FakePrompter(),
      logger,
    };

    const code = await runInit(env, { print: true });

    assert.equal(code, 0);
    assert.equal(existsSync(join(repo, ".fieldnote")), false, "no directory is created");
    assert.equal(logger.outputs.length, 1, "the profile goes to stdout exactly once");
    assert.match(logger.outputs[0]!, /^# fieldnote profile/);
    assert.equal(parseProfile(logger.outputs[0]!).tracker.epicLink, "TODO");
  } finally {
    process.chdir(prevCwd);
    rmSync(repo, { recursive: true, force: true });
  }
});

test("--print does not refuse when a profile already exists, and leaves it untouched", async () => {
  const repo = mkdtempSync(join(tmpdir(), "fieldnote-init-print-existing-"));
  mkdirSync(join(repo, ".git"), { recursive: true });
  mkdirSync(join(repo, ".fieldnote"), { recursive: true });
  const existing = join(repo, ".fieldnote", "profile.md");
  writeFileSync(existing, "# hand written, do not touch\n", "utf8");
  const prevCwd = process.cwd();
  process.chdir(repo);
  try {
    const logger = new FakeLogger();
    const env: Env = {
      claudeDir: "/unused",
      catalogPath: "/unused/catalog.json",
      skillsSourceDir: "/unused/skills",
      repoRoot: null,
      prompter: new FakePrompter(),
      logger,
    };

    const code = await runInit(env, { print: true });

    assert.equal(code, 0);
    assert.equal(readFileSync(existing, "utf8"), "# hand written, do not touch\n");
    assert.match(logger.outputs[0]!, /^# fieldnote profile/);
  } finally {
    process.chdir(prevCwd);
    rmSync(repo, { recursive: true, force: true });
  }
});

test("--print reports no TODO warning, because it is not scaffolding anything", async () => {
  const repo = mkdtempSync(join(tmpdir(), "fieldnote-init-print-quiet-"));
  mkdirSync(join(repo, ".git"), { recursive: true });
  const prevCwd = process.cwd();
  process.chdir(repo);
  try {
    const logger = new FakeLogger();
    const env: Env = {
      claudeDir: "/unused",
      catalogPath: "/unused/catalog.json",
      skillsSourceDir: "/unused/skills",
      repoRoot: null,
      prompter: new FakePrompter(),
      logger,
    };

    await runInit(env, { print: true });

    assert.deepEqual(logger.warns, [], "stdout stays the only channel");
    assert.deepEqual(logger.infos, []);
  } finally {
    process.chdir(prevCwd);
    rmSync(repo, { recursive: true, force: true });
  }
});
```

Extend the `node:fs` import at the top of the file to include the two
functions these tests use:

```ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd cli && node --import tsx --test src/commands/init.test.ts`
Expected: FAIL — `print` is not a known option, and the assertions on
`logger.outputs` fail because `runInit` writes a file instead.

- [ ] **Step 3: Implement `--print`**

In `cli/src/commands/init.ts`, replace the `runInit` signature and add the
branch immediately after the repo root is resolved, **before** the
`existsSync(target)` refusal:

```ts
export async function runInit(
  env: Env,
  opts: { force?: boolean; print?: boolean } = {},
): Promise<number> {
  const cwd = process.cwd();
  const root = env.repoRoot ?? findGitRoot(cwd);
  if (root === null) {
    throw new UserError(
      `Could not find a git repository at or above ${cwd}. Run \`fieldnote-skills init\` from inside ` +
        "the repository you want to profile (or one of its subdirectories).",
    );
  }

  // `--print` probes and renders, and touches nothing. It exists so a caller
  // can read this repository's mechanical facts WITHOUT risking a profile the
  // engineer has already hand-edited — the refusal below would otherwise make
  // that impossible, and `--force` would make it dangerous.
  if (opts.print) {
    env.logger.output(renderProfile(probeRepo(root)));
    return 0;
  }

  const dir = join(root, ".fieldnote");
  const target = join(dir, "profile.md");
  ...
```

Leave the rest of the function exactly as it is.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd cli && node --import tsx --test src/commands/init.test.ts`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 5: Wire the flag into the CLI**

In `cli/src/index.ts`, change the `init` case:

```ts
    case "init":
      return await runInit(env, { force: Boolean(flags.force), print: Boolean(flags.print) });
```

In `HELP`, replace the `init` usage line and add the flag:

```
  fieldnote-skills init              Scaffold .fieldnote/profile.md from this repo
                  [--force] [--print]
```

```
  --print       Print the probed profile to stdout; write nothing
```

No change to `cli/src/args.ts` is needed — `--print` is a boolean flag and
`parseArgs` already handles unknown boolean flags by setting them to `true`.

- [ ] **Step 6: Smoke-test it against this repository**

Run:
```bash
cd /path/to/this/repo
node --import tsx cli/src/index.ts init --print | head -12
git status --short .fieldnote
```
Expected: a `# fieldnote profile` document on stdout, and `git status` showing
`.fieldnote/profile.md` **unmodified**.

- [ ] **Step 7: Run the full suite and the guards**

Run:
```bash
cd cli && npm test && npm run typecheck
cd .. && npm run validate && npm run check:decoupling
```
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add cli/src/commands/init.ts cli/src/commands/init.test.ts cli/src/index.ts
git commit -m "$(cat <<'EOF'
feat: add init --print, which probes without writing

init hardcodes its destination and refuses to overwrite without --force, so
there was no way to read a repository's mechanical facts when it already had
a profile: refusing gave nothing, and --force risked hand-written lines.

--print renders the probed profile to stdout and touches nothing, which is
what lets a caller merge the probe into an existing profile instead of
replacing it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The `/fieldnote-setup-profile` skill

The skill itself. It is a Markdown document, so its "test" is the repository's
own validators plus a manual run against a real repository.

**Files:**
- Create: `skills/fieldnote-setup-profile/SKILL.md`
- Modify: `CATALOG.md`, `catalog.json`, `skills.lock.json` (generated — via `npm run catalog`)
- Modify: `README.md` (the skill table and the Tailoring section)
- Modify: `docs/the-loop.md` (name the new stage)

**Interfaces:**
- Consumes: `init --print` (Task 4), the `(none)` marker (Task 2), the `setup`
  stage (Task 3), the DoD convention and `templates/definition-of-done.md`
  (Task 1).
- Produces: nothing other skills import.

- [ ] **Step 1: Write the skill**

Create `skills/fieldnote-setup-profile/SKILL.md`. Note the frontmatter rules:
`description` must be >= 15 words and contain a `use when` clause; `name` must
equal the folder name; `release` must match `release.json`.

````markdown
---
name: fieldnote-setup-profile
description: Write this repository's .fieldnote/profile.md by reading the repository itself — its CI workflow, its written rules, its deploy configuration — and asking only about what the repository cannot answer. Use when a repository has no profile, when its profile is still full of TODO, or when someone says "set up the profile", "fill in the profile", "onboard this repo", or asks why a fieldnote skill keeps asking the same question.
stage: setup
variance: universal
surface: code
version: 0.1.0
release: skills-v0.1.0
---

# Fieldnote Setup Profile

Fill in `.fieldnote/profile.md` — the file every other skill reads to learn
what is true about this repository.

The CLI's `init` already scaffolds that file, but it can only observe what a
regex reaches, so most of it comes out as `TODO`. A `TODO` is not free: a
skill that meets one stops and asks, and the cost lands on a person every
time. This skill closes that gap by reading the repository the way a new
engineer would.

Single responsibility: this skill **writes the profile**. It does not
implement, plan, commit, or merge.

## Absolute rules

- **Never overwrite a line someone wrote by hand.** Only a `TODO` value, or a
  key that is absent, may be filled. This is what makes the skill safe to
  re-run, which is the only reason it is worth running.
- **Never run a repository's check command to verify it.** A suite can take
  twenty minutes or touch a database. Read what CI runs instead.
- **Never write provenance into the file.** Everything after the dash on a
  bullet is the value, so `- **check** — npm run ci (from ci.yml)` makes the
  check command that whole string. Provenance belongs in the conversation.
- **Stop at the human gate.** Write the files, report, stop. No commit, no
  branch, no pull request.

## What you do

### 1. Get the mechanical facts

```bash
npx github:dervalp/fieldnote-skills init --print
```

This probes the repository and prints a profile to stdout without touching
anything. Keep it in memory as the baseline. If the command is unavailable,
carry on without it — everything below works from the repository directly, it
is just slower.

Read the existing `.fieldnote/profile.md` too, if there is one. Every value in
it that is not `TODO` is settled and is never revisited.

### 2. Work out the rest from evidence

For each key still unfilled, look for evidence before considering a question.

- **Commands** — read the CI workflow. Whatever CI actually runs is the
  truth; a script name in a manifest is a weaker claim about the same thing.
  Take `Commands.check` from the job that gates a pull request, and
  `Commands.preflight` from whatever the contributing guide tells a human to
  run before pushing.
- **Architecture** — read the repository's own written rules: the agent
  instruction files at the root, the contributing guide, and any directory of
  decision records. A written-down rule is a decided rule. **Do not infer
  rules from source code** — that promotes an accident of today's
  implementation into a constraint nobody agreed to.
- **Deployment evidence** — look for whatever says how this repository ships:
  a deploy or release job in CI, a hosting provider's configuration file at
  the root, a container definition, a publish step. Repositories differ here
  more than anywhere else, so show what you found and confirm it rather than
  assuming.
- **Tracker, Labels, Merge policy** — take the probe's values, then sanity
  check them against what the repository shows. If the probe found no
  ready-for-agent label, look at the labels that exist before asking.
- **Localization** — if there is no sign of more than one locale, this section
  is absent, not unknown.

Record anything the repository has genuinely decided it does not have as
`(none)` rather than `TODO`, so nobody is asked about it twice.

### 3. Resolve the definition of done

Look for it in this order:

1. `.fieldnote/definition-of-done.md`
2. any `definition-of-done.md` among the repository's git-tracked files
   (`git ls-files`, so the search cannot wander into a vendored tree)
3. nothing

Record whatever you find under `Docs → definitionOfDone`.

**If there is none, say so plainly and do not soften it.** Every skill has to
decide "is this done?" at some point. With nothing written down each one falls
back to its own bar, they do not agree with each other, and none of them agree
with the person who asked for the work. That mismatch surfaces in review,
which is the most expensive place to find it.

Then offer to draft one. By this point you have read the CI gates, the check
commands, the contributing guide, and the deploy configuration — you have the
material for a definition of done that describes *this* repository rather than
a generic template. Use the five fixed headings of the convention, in order:
**Always**, **PRD**, **Do work**, **Pull request**, **Deployment**. Draft
concrete bullets from the evidence, never prompts to fill in later. If the
offer is declined, record `(none)` and move on without repeating the warning.

This offer is for the definition of done only. Other missing documents get one
summary line naming them; generating them is a different job.

### 4. Show the whole file, with provenance

Present every value together with where it came from:

```
check     — npm run ci          (CI workflow, the job that gates a PR)
ready     — ready-for-agent     (an existing label in the tracker)
waveSize  — ?                   (nothing in the repository says)
```

Show the whole file, not only the parts that changed. A wrong fact here
silently poisons every skill downstream, so it has to be catchable at a
glance.

### 5. Ask once

Whatever the repository genuinely cannot answer, ask as one numbered list in a
single message. These are independent facts — a label name, a concurrency
number — not a decision tree, so nothing is gained by asking them one at a
time.

### 6. Write, then stop

On approval, write `.fieldnote/profile.md` (and
`.fieldnote/definition-of-done.md` if one was drafted). Report the path of
each file written, how many values were filled, and anything left as `TODO`
with the reason.

Then stop. Do not commit, branch, push, or open a pull request.

## Notes / edge cases

- **No git repository** — stop and say so. The profile belongs at a
  repository root and there is nothing to read without one.
- **A profile with no `TODO` left** — report that there is nothing to fill and
  stop. Do not re-verify settled values; not touching them is the point.
- **The probe and a hand-written value disagree** — the hand-written value
  wins, silently. Mention the disagreement in the summary and leave the file
  alone.
- **A private or unfamiliar CI system** — if you cannot tell which job gates a
  pull request, ask rather than guessing. A wrong `Commands.check` is worse
  than an empty one, because it will be reported as passing.

## References

- `docs/profile.md` in this skill's own repository for every section the
  profile defines and what each key means.
- `docs/definition-of-done.md` for the five-section convention.
- `templates/definition-of-done.md` for a starter with the headings in place.
````

- [ ] **Step 2: Validate the skill**

Run: `npm run validate`
Expected: `✅ 8 skill(s) valid.`

If it reports a description under 15 words or a missing `use when`, fix the
frontmatter — do not weaken the validator.

- [ ] **Step 3: Check it is portable**

Run: `npm run check:decoupling`
Expected: no violations, now across 8 skills.

This is the step most likely to fail. The skill must not name a private brand,
a decision-record number, or a monorepo layout path. If it flags a line,
rewrite that line to describe the thing generically — the skill runs in
repositories that have none of those.

- [ ] **Step 4: Regenerate the catalog**

Run: `npm run catalog`
Expected: `CATALOG.md`, `catalog.json` and `skills.lock.json` all change, with
`fieldnote-setup-profile` under a new `## Setup` heading, first.

Verify: `git diff CATALOG.md | head -20`

- [ ] **Step 5: Verify it installs**

Run:
```bash
rm -rf /tmp/fieldnote-smoke
FIELDNOTE_CLAUDE_DIR=/tmp/fieldnote-smoke node --import tsx cli/src/index.ts --all
ls /tmp/fieldnote-smoke/skills
```
Expected: eight directories, including `fieldnote-setup-profile`.

- [ ] **Step 6: Update the README and the loop document**

In `README.md`, add a row at the top of the skill table:

```markdown
| `fieldnote-setup-profile` | setup | Writes `.fieldnote/profile.md` by reading the repository, and asks only about what it cannot. |
```

In the **Tailoring** section, after the `init` code block, add:

```markdown
`init` fills what a regex can prove and marks the rest `TODO`. To fill the
rest, run `/fieldnote-setup-profile` in Claude Code: it reads the repository —
the CI workflow, the written rules, the deploy configuration — and asks only
about what the repository genuinely cannot answer. See
[docs/definition-of-done.md](docs/definition-of-done.md) for the one document
it will push you to write.
```

In `docs/the-loop.md`, add a stage paragraph before **Brainstorm**:

```markdown
**Setup** — `fieldnote-setup-profile` *(shipped)*. Runs once per repository,
before anything else: writes `.fieldnote/profile.md` from what the repository
itself says, and pushes for a written definition of done, which is what every
later stage reads to decide whether it is finished.
```

Also update the document's opening count — it says twelve skills with seven
shipped; it is now thirteen with eight shipped. Check the `README § Status`
paragraph for the same counts and update both.

- [ ] **Step 7: Run every guard one last time**

Run:
```bash
cd cli && npm test && npm run typecheck
cd .. && npm run validate && npm run catalog && npm run check:decoupling
git status --short
```
Expected: all pass, and `npm run catalog` produces no further diff (it was
already run in Step 4).

- [ ] **Step 8: Commit**

```bash
git add skills/fieldnote-setup-profile/SKILL.md CATALOG.md catalog.json \
  skills.lock.json README.md docs/the-loop.md
git commit -m "$(cat <<'EOF'
feat: add fieldnote-setup-profile

init fills 4 of this repository's 24 profile entries and marks 20 TODO,
and a skill that meets a TODO stops and asks — so the cost of the gap lands
on a person every single time.

This skill closes it by reading the repository the way a new engineer would:
CI for the commands, the written rules for the architecture, the deploy
configuration for what "live" means. It shows every value with where it came
from, asks once about the rest, writes, and stops.

It also refuses to be quiet about a missing definition of done, and offers to
draft one from the evidence it has already read.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verifying the whole thing

After Task 5, run the skill against a repository that is not this one — ideally
one with no `.fieldnote/` at all. Check:

- it never wrote to a file before asking
- every value it proposed traces to something you can point at
- the definition-of-done warning appeared, and the draft it offered described
  that repository rather than a generic template
- re-running it a second time reports nothing left to fill, and leaves the
  file byte-identical

That last one is the property everything else rests on.

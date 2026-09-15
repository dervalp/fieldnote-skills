import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProfile, isDeclaredAbsent } from "./profile.js";

const SAMPLE = `# fieldnote profile

## Labels

- **ready** — ready-for-agent
- **needsPrd** — to-prd

## Commands

- **check** — pnpm check
- **mutation** — pnpm mutation:changed

## Docs

- **definitionOfDone** — docs/definition-of-done.md

## Architecture

- Validate every boundary with a schema before it reaches a service.
- Persistence stays behind a repository interface.

## Merge policy

- **strictStatusChecks** — true
`;

test("parses key/value sections into records", () => {
  const p = parseProfile(SAMPLE);
  assert.equal(p.labels.ready, "ready-for-agent");
  assert.equal(p.commands.check, "pnpm check");
  assert.equal(p.docs.definitionOfDone, "docs/definition-of-done.md");
  assert.equal(p.mergePolicy.strictStatusChecks, "true");
});

test("parses architecture as an ordered list of rules", () => {
  const p = parseProfile(SAMPLE);
  assert.equal(p.architecture.length, 2);
  assert.match(p.architecture[0], /Validate every boundary/);
});

test("absent sections are empty, never undefined", () => {
  const p = parseProfile("# empty\n");
  assert.deepEqual(p.labels, {});
  assert.deepEqual(p.architecture, []);
});

test("a TODO value is preserved verbatim so init's gaps stay visible", () => {
  const p = parseProfile("## Commands\n\n- **mutation** — TODO\n");
  assert.equal(p.commands.mutation, "TODO");
});

test("an architecture rule that starts with a bold word is not silently dropped", () => {
  const p = parseProfile("## Architecture\n\n- **Never** log secrets to stdout.\n");
  assert.equal(p.architecture.length, 1);
  assert.match(p.architecture[0], /\*\*Never\*\* log secrets to stdout\./);
});

test("bullets under an unrecognised heading are dropped, known sections around them still parse", () => {
  const p = parseProfile(
    [
      "## Labels",
      "",
      "- **ready** — ready-for-agent",
      "",
      "## Colors",
      "",
      "- **primary** — blue",
      "",
      "## Commands",
      "",
      "- **check** — pnpm check",
      "",
    ].join("\n"),
  );
  assert.equal(p.labels.ready, "ready-for-agent");
  assert.equal(p.commands.check, "pnpm check");
  assert.equal((p as unknown as Record<string, unknown>).colors, undefined);
});

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

test("a bare (none) under an unrecognised heading is dropped, like every other bullet there", () => {
  const p = parseProfile("## Colors\n\n- (none)\n\n## Commands\n\n- **check** — pnpm check\n");
  assert.equal(p.declaredAbsent.has("colors"), false);
  assert.equal(p.commands.check, "pnpm check", "a known section after it still parses");
});

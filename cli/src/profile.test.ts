import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProfile } from "./profile.js";

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

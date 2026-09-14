import { test } from "node:test";
import assert from "node:assert/strict";
import { findCouplingViolations } from "./decoupling.js";

test("flags a surviving vertuo reference", () => {
  const v = findCouplingViolations("fieldnote-do-work", "Run it in vertuo-ai-domain.");
  assert.equal(v.length, 1);
  assert.match(v[0], /vertuo/);
});

test("flags an ADR citation", () => {
  const v = findCouplingViolations("fieldnote-testing", "See ADR 0037 for the rule.");
  assert.ok(v.some((m) => m.includes("ADR 0037")));
});

test("flags every common ADR spelling", () => {
  const variants = ["ADR 0037", "ADR-0037", "adr 0037", "ADR 37", "Adr-0037"];
  for (const variant of variants) {
    const v = findCouplingViolations("fieldnote-testing", `See ${variant} for the rule.`);
    assert.ok(
      v.some((m) => m.includes(variant)),
      `expected "${variant}" to be flagged, got: ${JSON.stringify(v)}`,
    );
  }
});

test("flags a private monorepo path", () => {
  const v = findCouplingViolations("fieldnote-react-review", "Audit libs/agent-ui/src/shared.");
  assert.ok(v.some((m) => m.includes("libs/")));
});

test("flags a generic packages/ example — a known false positive, see CONTRIBUTING", () => {
  const v = findCouplingViolations("fieldnote-testing", "e.g. packages/utils/index.ts exports a helper.");
  assert.ok(v.some((m) => m.includes("packages/utils/index.ts")));
});

test("flags a generic apps/ route — a known false positive, see CONTRIBUTING", () => {
  const v = findCouplingViolations("fieldnote-testing", "Navigate to /apps/settings to change this.");
  assert.ok(v.some((m) => m.includes("apps/settings")));
});

test("flags a docs/agents path", () => {
  const v = findCouplingViolations("fieldnote-fix-bug", "Read docs/agents/bug-fixing.md.");
  assert.ok(v.some((m) => m.includes("docs/agents/")));
});

test("allows a profile citation", () => {
  const body = "Read the document named under `Docs → definitionOfDone` in `.fieldnote/profile.md`.";
  assert.deepEqual(findCouplingViolations("fieldnote-pull-request", body), []);
});

test("allows the word apps outside a path", () => {
  assert.deepEqual(findCouplingViolations("fieldnote-deliver", "Ship apps that work."), []);
});

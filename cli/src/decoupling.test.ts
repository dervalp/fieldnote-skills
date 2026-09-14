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

test("flags a private monorepo path", () => {
  const v = findCouplingViolations("fieldnote-react-review", "Audit libs/agent-ui/src/shared.");
  assert.ok(v.some((m) => m.includes("libs/")));
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

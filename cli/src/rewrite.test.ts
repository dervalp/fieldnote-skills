import { strict as assert } from "node:assert";
import { test } from "node:test";
import { rewriteReferences } from "./rewrite.js";

const ALL = new Set(["tdd", "code-review", "codebase-design", "implement", "wizard"]);
const VENDORED = new Set(["tdd", "code-review", "implement"]);
const MATT = "fieldnote-matt-";
const SLASH = { kind: "slash" } as const;

// The second upstream: obra/superpowers names siblings `superpowers:<name>`.
const SP_ALL = new Set(["brainstorming", "writing-plans", "subagent-driven-development"]);
const SP_VENDORED = new Set(["brainstorming", "writing-plans"]);
const SP = "fieldnote-superpowers-";
const NS = { kind: "namespace", namespace: "superpowers" } as const;

test("rewrites references to vendored skills only", () => {
  const out = rewriteReferences("Run /tdd then hand off to /code-review.", VENDORED, ALL, MATT, SLASH);
  assert.equal(out.text, "Run /fieldnote-matt-tdd then hand off to /fieldnote-matt-code-review.");
  assert.deepEqual(out.unresolved, []);
});

test("reports an upstream skill we did not vendor and leaves it alone", () => {
  const out = rewriteReferences("See /codebase-design for interfaces.", VENDORED, ALL, MATT, SLASH);
  assert.equal(out.text, "See /codebase-design for interfaces.");
  assert.deepEqual(out.unresolved, ["codebase-design"]);
});

test("leaves non-skill slash tokens untouched", () => {
  const text = "Write to /tmp/out.md, read docs/agents/domain.md, avoid /wizardry.";
  const out = rewriteReferences(text, VENDORED, ALL, MATT, SLASH);
  assert.equal(out.text, text);
  assert.deepEqual(out.unresolved, []);
});

test("rewriting is idempotent — a second pass changes nothing", () => {
  const once = rewriteReferences("Run /tdd then /code-review.", VENDORED, ALL, MATT, SLASH);
  const twice = rewriteReferences(once.text, VENDORED, ALL, MATT, SLASH);
  assert.equal(twice.text, once.text);
  assert.equal(once.text, "Run /fieldnote-matt-tdd then /fieldnote-matt-code-review.");
  assert.deepEqual(twice.unresolved, []);
});

test("dedupes and sorts unresolved names", () => {
  const out = rewriteReferences("/wizard then /codebase-design then /wizard", VENDORED, ALL, MATT, SLASH);
  assert.deepEqual(out.unresolved, ["codebase-design", "wizard"]);
});

test("does not rewrite a vendored name that is a path's final segment", () => {
  const text = "See docs/tdd.md and ../skills/code-review for detail.";
  const out = rewriteReferences(text, VENDORED, ALL, MATT, SLASH);
  assert.equal(out.text, text);
  assert.deepEqual(out.unresolved, []);
});

test("does not rewrite a vendored name at the end of a URL", () => {
  const text = "Upstream: https://github.com/mattpocock/skills/tdd";
  const out = rewriteReferences(text, VENDORED, ALL, MATT, SLASH);
  assert.equal(out.text, text);
  assert.deepEqual(out.unresolved, []);
});

test("still rewrites a reference in brackets or after an opening paren", () => {
  const out = rewriteReferences("Run (/tdd) or use /implement, then stop.", VENDORED, ALL, MATT, SLASH);
  assert.equal(out.text, "Run (/fieldnote-matt-tdd) or use /fieldnote-matt-implement, then stop.");
  assert.deepEqual(out.unresolved, []);
});

test("the prefix guard prevents double-prefixing when a prefixed name is in the set", () => {
  // The only shape where the guard is load-bearing: a caller passes an
  // already-prefixed name, so the set lookup WOULD match without it.
  const vendored = new Set(["fieldnote-matt-tdd"]);
  const all = new Set(["fieldnote-matt-tdd"]);
  const out = rewriteReferences("Run /fieldnote-matt-tdd.", vendored, all, MATT, SLASH);
  assert.equal(out.text, "Run /fieldnote-matt-tdd.");
  assert.deepEqual(out.unresolved, []);
});

// --- namespace style (obra/superpowers) ------------------------------------

test("rewrites a namespaced reference to the bare vendored name", () => {
  const out = rewriteReferences(
    "REQUIRED SUB-SKILL: Use superpowers:writing-plans first.",
    SP_VENDORED,
    SP_ALL,
    SP,
    NS,
  );
  assert.equal(out.text, "REQUIRED SUB-SKILL: Use fieldnote-superpowers-writing-plans first.");
  assert.deepEqual(out.unresolved, []);
});

test("reports a namespaced sibling we did not vendor and leaves it alone", () => {
  const text = "Use superpowers:subagent-driven-development instead of this skill.";
  const out = rewriteReferences(text, SP_VENDORED, SP_ALL, SP, NS);
  assert.equal(out.text, text);
  assert.deepEqual(out.unresolved, ["subagent-driven-development"]);
});

test("leaves the upstream's own name in prose alone", () => {
  // "Superpowers works better with subagents" is prose, not a reference: only
  // the `namespace:name` form is a pointer at a sibling skill.
  const text = "Tell your partner that Superpowers works much better with subagents.";
  const out = rewriteReferences(text, SP_VENDORED, SP_ALL, SP, NS);
  assert.equal(out.text, text);
  assert.deepEqual(out.unresolved, []);
});

test("points a bundled-file path at the installed skill folder", () => {
  const out = rewriteReferences("Read `skills/brainstorming/visual-companion.md`", SP_VENDORED, SP_ALL, SP, NS);
  assert.equal(out.text, "Read `../fieldnote-superpowers-brainstorming/visual-companion.md`");
  assert.deepEqual(out.unresolved, []);
});

test("leaves a bundled-file path of a skill we did not vendor alone", () => {
  const text = "See skills/subagent-driven-development/notes.md for detail.";
  const out = rewriteReferences(text, SP_VENDORED, SP_ALL, SP, NS);
  assert.equal(out.text, text);
  assert.deepEqual(out.unresolved, ["subagent-driven-development"]);
});

test("namespace rewriting is idempotent — a second pass changes nothing", () => {
  const once = rewriteReferences(
    "Use superpowers:writing-plans, then read skills/brainstorming/visual-companion.md.",
    SP_VENDORED,
    SP_ALL,
    SP,
    NS,
  );
  const twice = rewriteReferences(once.text, SP_VENDORED, SP_ALL, SP, NS);
  assert.equal(twice.text, once.text);
  assert.equal(
    once.text,
    "Use fieldnote-superpowers-writing-plans, then read ../fieldnote-superpowers-brainstorming/visual-companion.md.",
  );
});

test("each style ignores the other upstream's syntax", () => {
  const slashOnly = rewriteReferences("Use superpowers:writing-plans.", SP_VENDORED, SP_ALL, SP, SLASH);
  assert.equal(slashOnly.text, "Use superpowers:writing-plans.");
  const nsOnly = rewriteReferences("Run /tdd now.", VENDORED, ALL, MATT, NS);
  assert.equal(nsOnly.text, "Run /tdd now.");
});


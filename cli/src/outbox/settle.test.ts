import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fenceFor, settleItem } from "./settle.js";
import { item, repo } from "./fixtures.js";

test("fenceFor outruns every backtick run in the text", () => {
  assert.equal(fenceFor("plain"), "```");
  assert.equal(fenceFor("has ``` inside"), "````");
  assert.equal(fenceFor("has ````` inside"), "``````");
});

function setup() {
  return repo({ "docs/outbox/7/s1-01-a.md": item("s1-01-a", "medium") });
}

test("settle appends an entry, creates settled.md with its header, and removes the item", () => {
  const root = setup();
  const r = settleItem({
    root,
    outboxDir: "docs/outbox",
    file: "docs/outbox/7/s1-01-a.md",
    verdict: "agreed",
    answer: "Yes, keep the tenant's country.",
    date: "2026-09-23",
  });
  assert.equal(r.settled, "docs/outbox/7/settled.md");
  assert.equal(existsSync(join(root, "docs/outbox/7/s1-01-a.md")), false);
  const text = readFileSync(join(root, r.settled), "utf8");
  assert.match(text, /^# Settled outbox items — 7\n/);
  assert.match(text, /<!-- fieldnote-outbox-settled: s1-01-a -->/);
  assert.match(text, /- Verdict: agreed\n- Settled: 2026-09-23\n- Closed: yes/);
  assert.match(text, /Yes, keep the tenant's country\./);
  assert.match(text, /rank: medium/);
  assert.match(text, /<!-- \/fieldnote-outbox-settled: s1-01-a -->/);
});

test("a drifted verdict stays Closed: no", () => {
  const root = setup();
  const r = settleItem({
    root, outboxDir: "docs/outbox", file: "docs/outbox/7/s1-01-a.md",
    verdict: "drifted", answer: "No — leave it blank.", date: "2026-09-23",
  });
  assert.match(readFileSync(join(root, r.settled), "utf8"), /- Closed: no/);
});

test("a second settle appends below the first and keeps one header", () => {
  const root = repo({
    "docs/outbox/7/s1-01-a.md": item("s1-01-a", "medium"),
    "docs/outbox/7/s2-01-b.md": item("s2-01-b", "medium"),
  });
  const base = { root, outboxDir: "docs/outbox", verdict: "agreed" as const, answer: "ok", date: "2026-09-23" };
  settleItem({ ...base, file: "docs/outbox/7/s1-01-a.md" });
  settleItem({ ...base, file: "docs/outbox/7/s2-01-b.md" });
  const text = readFileSync(join(root, "docs/outbox/7/settled.md"), "utf8");
  assert.equal(text.match(/^# Settled/gm)!.length, 1);
  assert.ok(text.indexOf("s1-01-a -->") < text.indexOf("s2-01-b -->"));
});

test("an answer containing a code fence cannot break the entry", () => {
  const root = setup();
  const answer = "Use this:\n```\nconst x = 1;\n```\n";
  const r = settleItem({
    root, outboxDir: "docs/outbox", file: "docs/outbox/7/s1-01-a.md",
    verdict: "agreed", answer, date: "2026-09-23",
  });
  const text = readFileSync(join(root, r.settled), "utf8");
  assert.match(text, /````text\nUse this:\n```\nconst x = 1;\n```\n````/);
});

test("refuses settled.md itself", () => {
  const root = repo({ "docs/outbox/7/settled.md": "# x\n" });
  assert.throws(
    () => settleItem({ root, outboxDir: "docs/outbox", file: "docs/outbox/7/settled.md", verdict: "agreed", answer: "a", date: "2026-09-23" }),
    /settled\.md is the record, not an item/,
  );
});

test("refuses a file outside the outbox folder", () => {
  const root = repo({ "elsewhere/s1-01-a.md": item("s1-01-a", "medium") });
  assert.throws(
    () => settleItem({ root, outboxDir: "docs/outbox", file: "elsewhere/s1-01-a.md", verdict: "agreed", answer: "a", date: "2026-09-23" }),
    /not inside docs\/outbox/,
  );
  assert.ok(existsSync(join(root, "elsewhere/s1-01-a.md")));
});

test("refuses an unparseable item and touches nothing", () => {
  const root = repo({ "docs/outbox/7/s1-01-a.md": "garbage" });
  assert.throws(
    () => settleItem({ root, outboxDir: "docs/outbox", file: "docs/outbox/7/s1-01-a.md", verdict: "agreed", answer: "a", date: "2026-09-23" }),
    /cannot be settled/,
  );
  assert.ok(existsSync(join(root, "docs/outbox/7/s1-01-a.md")));
  assert.equal(existsSync(join(root, "docs/outbox/7/settled.md")), false);
});

test("refuses an empty answer", () => {
  const root = setup();
  assert.throws(
    () => settleItem({ root, outboxDir: "docs/outbox", file: "docs/outbox/7/s1-01-a.md", verdict: "agreed", answer: "  \n", date: "2026-09-23" }),
    /answer is empty/,
  );
});

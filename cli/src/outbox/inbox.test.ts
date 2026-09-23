import { test } from "node:test";
import assert from "node:assert/strict";
import { checkInboxSet, parseInbox, type InboxFile } from "./inbox.js";

const GOOD = `---
id: 1015
title: Inbox and planner
blocked-by: none
plan: plans/2026-09-23-inbox.md
tracker: github
---

## Problem
`;
const FILE = "docs/inbox/1015-inbox-and-planner.md";

test("parses a well-formed inbox file", () => {
  const r = parseInbox(GOOD, FILE);
  assert.ok(r.ok);
  assert.deepEqual(r.value.blockedBy, []);
  assert.equal(r.value.plan, "plans/2026-09-23-inbox.md");
  assert.equal(r.value.tracker, "github");
});

test("parses CRLF the same", () => {
  assert.ok(parseInbox(GOOD.replace(/\n/g, "\r\n"), FILE).ok);
});

test("reads a blocked-by list and plan: none", () => {
  const r = parseInbox(
    GOOD.replace("blocked-by: none", "blocked-by: [966, 970]").replace(
      "plan: plans/2026-09-23-inbox.md",
      "plan: none",
    ),
    FILE,
  );
  assert.ok(r.ok);
  assert.deepEqual(r.value.blockedBy, ["966", "970"]);
  assert.equal(r.value.plan, null);
});

for (const field of ["status", "branch", "priority", "value"]) {
  test(`refuses the forbidden field "${field}" by name`, () => {
    const r = parseInbox(GOOD.replace("tracker: github", `tracker: github\n${field}: x`), FILE);
    assert.ok(!r.ok);
    assert.match(r.errors.join("\n"), new RegExp(`"${field}" is not allowed`));
  });
}

test("refuses a missing field", () => {
  const r = parseInbox(GOOD.replace("title: Inbox and planner\n", ""), FILE);
  assert.ok(!r.ok);
  assert.match(r.errors.join("\n"), /"title"/);
});

test("refuses a malformed blocked-by", () => {
  const r = parseInbox(GOOD.replace("blocked-by: none", "blocked-by: 966"), FILE);
  assert.ok(!r.ok);
});

test("refuses an unknown tracker", () => {
  const r = parseInbox(GOOD.replace("tracker: github", "tracker: jira"), FILE);
  assert.ok(!r.ok);
});

test("refuses a file name that does not start with the id", () => {
  const r = parseInbox(GOOD, "docs/inbox/99-inbox.md");
  assert.ok(!r.ok);
  assert.match(r.errors.join("\n"), /file name/);
});

const entry = (over: Partial<InboxFile>): InboxFile => ({
  id: "1",
  title: "t",
  blockedBy: [],
  plan: null,
  tracker: "file",
  file: "docs/inbox/1-t.md",
  ...over,
});

test("checkInboxSet: a blocked-by naming no inbox file is an error", () => {
  const errors = checkInboxSet([entry({ blockedBy: ["2"] })], () => true);
  assert.equal(errors.length, 1);
  assert.match(errors[0]!, /blocked-by 2 names no inbox file/);
});

test("checkInboxSet: a plan path that does not exist is an error", () => {
  const errors = checkInboxSet([entry({ plan: "plans/x.md" })], () => false);
  assert.match(errors[0]!, /plan "plans\/x.md" does not exist/);
});

test("checkInboxSet: two files with one id is an error", () => {
  const errors = checkInboxSet(
    [entry({}), entry({ file: "docs/inbox/1-other.md" })],
    () => true,
  );
  assert.match(errors.join("\n"), /id 1 is used by more than one inbox file/);
});

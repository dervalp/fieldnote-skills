import { test } from "node:test";
import assert from "node:assert/strict";
import { inboxFilePaths, itemFilePaths, openItems } from "./store.js";
import { item, repo } from "./fixtures.js";

test("inboxFilePaths skips README and survives a missing folder", () => {
  const root = repo({ "docs/inbox/README.md": "x", "docs/inbox/2-b.md": "x", "docs/inbox/1-a.md": "x" });
  assert.deepEqual(inboxFilePaths(root, "docs/inbox"), ["docs/inbox/1-a.md", "docs/inbox/2-b.md"]);
  assert.deepEqual(inboxFilePaths(root, "nowhere"), []);
});

test("itemFilePaths skips settled.md and filters by id", () => {
  const root = repo({
    "docs/outbox/7/s1-01-a.md": "x",
    "docs/outbox/7/settled.md": "x",
    "docs/outbox/8/s1-01-b.md": "x",
  });
  assert.deepEqual(itemFilePaths(root, "docs/outbox", "7"), ["docs/outbox/7/s1-01-a.md"]);
  assert.equal(itemFilePaths(root, "docs/outbox").length, 2);
});

test("openItems sorts by rank and counts an unparseable file as open, first", () => {
  const root = repo({
    "docs/outbox/7/s1-01-a.md": item("s1-01-a", "medium"),
    "docs/outbox/7/s2-01-b.md": item("s2-01-b", "human-action"),
    "docs/outbox/7/s3-01-c.md": item("s3-01-c", "high", "shared.md#money"),
    "docs/outbox/7/s4-01-broken.md": "not an item",
  });
  const items = openItems(root, "docs/outbox", "7");
  assert.deepEqual(
    items.map((i) => i.rank),
    ["unparseable", "human-action", "high", "medium"],
  );
  assert.equal(items[3]!.decision, "Decision s1-01-a.");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync as write } from "node:fs";
import { join } from "node:path";
import { runOutbox, type OutboxDeps } from "./outbox.js";
import { FakeLogger } from "../testkit.js";
import { item, repo } from "../outbox/fixtures.js";

const PROFILE = `## Docs
- **inbox** — docs/inbox
- **outbox** — docs/outbox
`;

const INBOX = `---
id: 7
title: Seven
blocked-by: none
plan: none
tracker: file
---
`;

export function deps(root: string, over: Partial<OutboxDeps> = {}): OutboxDeps & { logger: FakeLogger } {
  mkdirSync(join(root, ".git"), { recursive: true });
  return {
    cwd: root,
    logger: new FakeLogger(),
    readStdin: () => "",
    today: () => "2026-09-23",
    gh: () => {
      throw new Error("gh must not be called");
    },
    ...over,
  } as OutboxDeps & { logger: FakeLogger };
}

test("check: a clean repository exits 0", async () => {
  const root = repo({
    ".fieldnote/profile.md": PROFILE,
    "docs/inbox/7-seven.md": INBOX,
    "docs/outbox/7/s1-01-a.md": item("s1-01-a", "medium"),
  });
  const d = deps(root);
  assert.equal(await runOutbox("check", [], {}, d), 0);
});

test("check: lists every failure with its file and exits 1", async () => {
  const root = repo({
    ".fieldnote/profile.md": PROFILE,
    "docs/inbox/7-seven.md": INBOX.replace("tracker: file", "tracker: file\nstatus: done"),
    "docs/outbox/7/s1-01-a.md": item("s1-01-a", "medium", "shared.md#money"),
  });
  const d = deps(root);
  assert.equal(await runOutbox("check", [], {}, d), 1);
  const out = d.logger.errors.join("\n");
  assert.match(out, /docs\/inbox\/7-seven\.md: "status" is not allowed/);
  assert.match(out, /docs\/outbox\/7\/s1-01-a\.md: rank "medium" is below the floor/);
});

test("check with the outbox off still checks the inbox", async () => {
  const root = repo({
    ".fieldnote/profile.md": "## Docs\n- **inbox** — docs/inbox\n- **outbox** — (none)\n",
    "docs/inbox/7-seven.md": INBOX.replace("blocked-by: none", "blocked-by: [9]"),
  });
  const d = deps(root);
  assert.equal(await runOutbox("check", [], {}, d), 1);
  assert.match(d.logger.errors.join("\n"), /blocked-by 9 names no inbox file/);
});

test("open: lists open items worst first and exits 1", async () => {
  const root = repo({
    ".fieldnote/profile.md": PROFILE,
    "docs/outbox/7/s1-01-a.md": item("s1-01-a", "medium"),
    "docs/outbox/7/s2-01-b.md": item("s2-01-b", "high", "shared.md#money"),
  });
  const d = deps(root);
  assert.equal(await runOutbox("open", ["7"], {}, d), 1);
  assert.deepEqual(d.logger.outputs, [
    "- [high] s2-01-b — Decision s2-01-b.",
    "- [medium] s1-01-a — Decision s1-01-a.",
  ]);
});

test("open --json prints the items as JSON", async () => {
  const root = repo({ ".fieldnote/profile.md": PROFILE, "docs/outbox/7/s1-01-a.md": item("s1-01-a", "medium") });
  const d = deps(root);
  await runOutbox("open", ["7"], { json: true }, d);
  assert.equal(JSON.parse(d.logger.outputs[0]!)[0].id, "s1-01-a");
});

test("open: nothing open exits 0", async () => {
  const root = repo({ ".fieldnote/profile.md": PROFILE });
  const d = deps(root);
  assert.equal(await runOutbox("open", ["7"], {}, d), 0);
  assert.deepEqual(d.logger.outputs, ["No open outbox items for 7."]);
});

test("open with no profile: says the outbox is off, exits 0, never crashes", async () => {
  const root = repo({});
  const d = deps(root);
  assert.equal(await runOutbox("open", ["7"], {}, d), 0);
  assert.match(d.logger.infos.join("\n"), /No \.fieldnote\/profile\.md/);
  assert.match(d.logger.outputs.join("\n"), /outbox is off/);
});

test("open without an id is a usage error", async () => {
  const d = deps(repo({ ".fieldnote/profile.md": PROFILE }));
  await assert.rejects(runOutbox("open", [], {}, d), /Usage: fieldnote-skills outbox open <id>/);
});

test("an unknown subcommand is a usage error", async () => {
  const d = deps(repo({}));
  await assert.rejects(runOutbox("frobnicate", [], {}, d), /Unknown outbox command "frobnicate"/);
});

test("outside a git repository is an error", async () => {
  const d = { ...deps(repo({})), cwd: "/" };
  await assert.rejects(runOutbox("check", [], {}, d), /not inside a git repository/);
});

test("settle: needs a verdict", async () => {
  const root = repo({ ".fieldnote/profile.md": PROFILE, "docs/outbox/7/s1-01-a.md": item("s1-01-a", "medium") });
  const d = deps(root);
  await assert.rejects(
    runOutbox("settle", ["docs/outbox/7/s1-01-a.md"], { answer: "-" }, d),
    /--verdict agreed\|drifted is required/,
  );
});

test("settle: reads the answer from stdin with --answer -", async () => {
  const root = repo({ ".fieldnote/profile.md": PROFILE, "docs/outbox/7/s1-01-a.md": item("s1-01-a", "medium") });
  const d = deps(root, { readStdin: () => "Keep it." });
  const code = await runOutbox("settle", ["docs/outbox/7/s1-01-a.md"], { verdict: "agreed", answer: "-" }, d);
  assert.equal(code, 0);
  assert.equal(existsSync(join(root, "docs/outbox/7/s1-01-a.md")), false);
  assert.match(d.logger.outputs.join("\n"), /Settled s1-01-a \(agreed\)/);
  assert.match(d.logger.outputs.join("\n"), /commit both/);
});

test("settle: reads the answer from a file", async () => {
  const root = repo({ ".fieldnote/profile.md": PROFILE, "docs/outbox/7/s1-01-a.md": item("s1-01-a", "medium") });
  write(join(root, "answer.txt"), "From a file.");
  const d = deps(root);
  assert.equal(
    await runOutbox("settle", ["docs/outbox/7/s1-01-a.md"], { verdict: "drifted", answer: "answer.txt" }, d),
    0,
  );
});

test("settle with the outbox off is an error", async () => {
  const d = deps(repo({}));
  await assert.rejects(
    runOutbox("settle", ["x.md"], { verdict: "agreed", answer: "-" }, d),
    /outbox is off/,
  );
});

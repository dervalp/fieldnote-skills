import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync as write } from "node:fs";
import { join } from "node:path";
import { runOutbox, type OutboxDeps } from "./outbox.js";
import { FakeLogger } from "../testkit.js";
import { item, repo } from "../outbox/fixtures.js";
import { UserError } from "../types.js";

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
    /No verdict: start the answer with a line "Verdict: agreed" or "Verdict: drifted", or pass --verdict/,
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

const GH_PROFILE = PROFILE + "\n## Tracker\n- **kind** — github\n- **repo** — acme/app\n";

test("comment: posts the list to the PRD issue through gh", async () => {
  const root = repo({ ".fieldnote/profile.md": GH_PROFILE, "docs/outbox/7/s1-01-a.md": item("s1-01-a", "medium") });
  const calls: string[][] = [];
  const d = deps(root, {
    gh: (args) => {
      calls.push(args);
      return "";
    },
  });
  assert.equal(await runOutbox("comment", ["7"], {}, d), 0);
  assert.equal(calls[1]![1], "repos/acme/app/issues/7/comments");
  assert.match(d.logger.outputs.join("\n"), /created/);
});

test("comment: a file tracker is a no-op", async () => {
  const d = deps(repo({ ".fieldnote/profile.md": PROFILE }));
  assert.equal(await runOutbox("comment", ["7"], {}, d), 0);
  assert.match(d.logger.outputs.join("\n"), /tracker is not GitHub/);
});

test("comment: no Tracker → repo asks gh for the current repository", async () => {
  const root = repo({
    ".fieldnote/profile.md": PROFILE + "\n## Tracker\n- **kind** — github\n",
  });
  const calls: string[][] = [];
  const d = deps(root, {
    gh: (args) => {
      calls.push(args);
      return args[0] === "repo" ? "acme/app\n" : "";
    },
  });
  await runOutbox("comment", ["7"], {}, d);
  assert.deepEqual(calls[0], ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
  assert.equal(calls[1]![2], "repos/acme/app/issues/7/comments");
});

// --- check <id>: scoped to one spec ---

test("check <id>: ignores other inbox files and other ids' items", async () => {
  const root = repo({
    ".fieldnote/profile.md": PROFILE,
    "docs/inbox/7-seven.md": INBOX,
    "docs/inbox/8-eight.md": INBOX.replace("id: 7", "id: 8").replace("blocked-by: none", "blocked-by: [99]"),
    "docs/outbox/8/s1-01-a.md": item("s1-01-a", "medium", "shared.md#money", "8"),
  });
  const d = deps(root);
  assert.equal(await runOutbox("check", ["7"], {}, d), 0);
  assert.deepEqual(d.logger.errors, []);
});

test("check <id>: its blocked-by resolves against the other inbox files", async () => {
  const root = repo({
    ".fieldnote/profile.md": PROFILE,
    "docs/inbox/7-seven.md": INBOX.replace("blocked-by: none", "blocked-by: [8]"),
    "docs/inbox/8-eight.md": INBOX.replace("id: 7", "id: 8"),
  });
  assert.equal(await runOutbox("check", ["7"], {}, deps(root)), 0);
});

test("check <id>: reports its own unresolved blocker, missing plan and bad items", async () => {
  const root = repo({
    ".fieldnote/profile.md": PROFILE,
    "docs/inbox/7-seven.md": INBOX.replace("blocked-by: none", "blocked-by: [9]").replace(
      "plan: none",
      "plan: plans/missing.md",
    ),
    "docs/outbox/7/s1-01-a.md": item("s1-01-a", "medium", "shared.md#money"),
  });
  const d = deps(root);
  assert.equal(await runOutbox("check", ["7"], {}, d), 1);
  const out = d.logger.errors.join("\n");
  assert.match(out, /blocked-by 9 names no inbox file/);
  assert.match(out, /plan "plans\/missing\.md" does not exist/);
  assert.match(out, /rank "medium" is below the floor/);
});

test("check <id>: reports an unparseable inbox file of that id", async () => {
  const root = repo({
    ".fieldnote/profile.md": PROFILE,
    "docs/inbox/7-seven.md": INBOX.replace("tracker: file", "tracker: file\nstatus: done"),
  });
  const d = deps(root);
  assert.equal(await runOutbox("check", ["7"], {}, d), 1);
  assert.match(d.logger.errors.join("\n"), /"status" is not allowed/);
});

test("check <id>: two inbox files with that id is an error", async () => {
  const root = repo({
    ".fieldnote/profile.md": PROFILE,
    "docs/inbox/7-seven.md": INBOX,
    "docs/inbox/7-other.md": INBOX,
  });
  const d = deps(root);
  assert.equal(await runOutbox("check", ["7"], {}, d), 1);
  assert.match(d.logger.errors.join("\n"), /id 7 is used by more than one inbox file/);
});

// --- check: an item must sit where its front matter says ---

test("check: an item whose prd differs from its folder is an error", async () => {
  const root = repo({
    ".fieldnote/profile.md": PROFILE,
    "docs/outbox/7/s1-01-a.md": item("s1-01-a", "medium", "none", "8"),
  });
  const d = deps(root);
  assert.equal(await runOutbox("check", [], {}, d), 1);
  assert.match(d.logger.errors.join("\n"), /docs\/outbox\/7\/s1-01-a\.md: prd "8" does not match its folder "7"/);
});

test("check: an item whose id does not start with its slice is an error", async () => {
  const root = repo({
    ".fieldnote/profile.md": PROFILE,
    "docs/outbox/7/s1-01-a.md": item("s1-01-a", "medium").replace("slice: s1", "slice: s2"),
  });
  const d = deps(root);
  assert.equal(await runOutbox("check", [], {}, d), 1);
  assert.match(d.logger.errors.join("\n"), /id "s1-01-a" does not start with its slice "s2-"/);
});

// --- settle: the verdict from the answer's Verdict line or the flag ---

function settleRepo() {
  return repo({ ".fieldnote/profile.md": PROFILE, "docs/outbox/7/s1-01-a.md": item("s1-01-a", "medium") });
}
const ITEM = "docs/outbox/7/s1-01-a.md";

test("settle: a Verdict line in the answer is enough", async () => {
  const root = settleRepo();
  const d = deps(root, { readStdin: () => "Verdict: drifted\nLeave it blank." });
  assert.equal(await runOutbox("settle", [ITEM], { answer: "-" }, d), 0);
  assert.match(d.logger.outputs.join("\n"), /Settled s1-01-a \(drifted\)/);
});

test("settle: the Verdict line is found on any line, any case", async () => {
  const root = settleRepo();
  const d = deps(root, { readStdin: () => "Thanks.\nverdict:   Agreed  \n" });
  assert.equal(await runOutbox("settle", [ITEM], { answer: "-" }, d), 0);
  assert.match(d.logger.outputs.join("\n"), /\(agreed\)/);
});

test("settle: flag and line agreeing is fine", async () => {
  const root = settleRepo();
  const d = deps(root, { readStdin: () => "Verdict: agreed\nKeep it." });
  assert.equal(await runOutbox("settle", [ITEM], { verdict: "agreed", answer: "-" }, d), 0);
});

test("settle: flag and line disagreeing refuses and settles nothing", async () => {
  const root = settleRepo();
  const d = deps(root, { readStdin: () => "Verdict: drifted\nChange it." });
  await assert.rejects(
    runOutbox("settle", [ITEM], { verdict: "agreed", answer: "-" }, d),
    /--verdict agreed disagrees with the answer's "Verdict: drifted"/,
  );
  assert.equal(existsSync(join(root, ITEM)), true);
});

test("settle: a --verdict that is neither agreed nor drifted is refused", async () => {
  const root = settleRepo();
  const d = deps(root, { readStdin: () => "Keep it." });
  await assert.rejects(runOutbox("settle", [ITEM], { verdict: "yes", answer: "-" }, d), /--verdict must be agreed or drifted/);
});

test("settle: a missing answer file is a plain error", async () => {
  const root = settleRepo();
  const d = deps(root);
  await assert.rejects(
    runOutbox("settle", [ITEM], { verdict: "agreed", answer: "nope.txt" }, d),
    (err: Error) => err instanceof UserError && /answer file nope\.txt cannot be read/.test(err.message),
  );
  assert.equal(existsSync(join(root, ITEM)), true);
});

test("comment: a gh failure is a plain error", async () => {
  const root = repo({ ".fieldnote/profile.md": GH_PROFILE });
  const d = deps(root, {
    gh: () => {
      throw new Error("Command failed: gh api\nHTTP 404: Not Found");
    },
  });
  await assert.rejects(
    runOutbox("comment", ["7"], {}, d),
    (err: Error) => err instanceof UserError && /gh failed: .*HTTP 404: Not Found/s.test(err.message),
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { installSkill, targetDirFor } from "./installer.js";
import { readManifest } from "./manifest.js";
import { makeHarness, toEntry } from "./testkit.js";

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

const CODE_SKILL = {
  name: "fieldnote-do-work",
  stage: "build" as const,
  surface: "both" as const,
  files: {
    "commands/do-work.md": "# /do-work command",
    "agents/reviewer.md": "# reviewer agent",
    "hooks/pre-commit.sh": "#!/bin/sh\necho hook",
    "references/playbook.md": "# playbook",
    "scripts/helper.py": "print('hi')",
  },
};

test("a code skill with commands/agents/hooks installs all subfolders under ~/.claude", async () => {
  const h = await makeHarness([CODE_SKILL]);
  try {
    await installSkill(h.env, toEntry(CODE_SKILL));
    const target = targetDirFor(h.env, "fieldnote-do-work");

    for (const rel of [
      "SKILL.md",
      "commands/do-work.md",
      "agents/reviewer.md",
      "hooks/pre-commit.sh",
      "references/playbook.md",
      "scripts/helper.py",
    ]) {
      assert.ok(await exists(join(target, rel)), `${rel} should be installed`);
    }
    assert.match(await readFile(join(target, "commands/do-work.md"), "utf8"), /do-work command/);

    // Tracked in the manifest like any other skill.
    const manifest = await readManifest(h.env);
    assert.equal(manifest.skills["fieldnote-do-work"]?.surface, "both");
  } finally {
    await h.cleanup();
  }
});

test("atomic rollback holds for a multi-folder skill", async () => {
  const h = await makeHarness([CODE_SKILL]);
  try {
    await installSkill(h.env, toEntry(CODE_SKILL));

    // A broken update (missing source) must leave the full multi-folder install intact.
    const broken = toEntry({ name: "fieldnote-nonexistent", stage: "build", version: "2.0.0" });
    await assert.rejects(() => installSkill(h.env, broken), /not found/);

    const target = targetDirFor(h.env, "fieldnote-do-work");
    assert.ok(await exists(join(target, "hooks/pre-commit.sh")));
    assert.ok(await exists(join(target, "agents/reviewer.md")));

    const skillsRoot = join(h.claudeDir, "skills");
    const leftovers = (await readdir(skillsRoot)).filter(
      (n) => n.startsWith(".staging-") || n.startsWith(".backup-"),
    );
    assert.deepEqual(leftovers, []);
  } finally {
    await h.cleanup();
  }
});

test("dev-only tests/ folders never install into ~/.claude", async () => {
  const skillWithTests = {
    ...CODE_SKILL,
    files: {
      ...CODE_SKILL.files,
      "tests/fake-runner.ts": "export const x = 1;",
      "tests/fixtures/tickets/happy-path.json": "{}",
    },
  };
  const h = await makeHarness([skillWithTests]);
  try {
    await installSkill(h.env, toEntry(skillWithTests));
    const target = targetDirFor(h.env, "fieldnote-do-work");

    assert.ok(await exists(join(target, "SKILL.md")));
    assert.ok(await exists(join(target, "scripts/helper.py")));
    assert.equal(await exists(join(target, "tests")), false, "tests/ must not ship");
  } finally {
    await h.cleanup();
  }
});

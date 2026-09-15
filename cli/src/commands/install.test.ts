import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { runInstall } from "./install.js";
import { targetDirFor } from "../installer.js";
import { readManifest } from "../manifest.js";
import { UserError } from "../types.js";
import { makeHarness } from "../testkit.js";

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

test("install <names> installs named skills without prompting and records versions", async () => {
  const h = await makeHarness([
    { name: "fieldnote-do-work", stage: "build", version: "1.0.0" },
    { name: "fieldnote-run-agent", stage: "build", version: "2.0.0" },
  ]);
  try {
    await runInstall(h.env, ["fieldnote-do-work", "fieldnote-run-agent"], {});

    assert.ok(await exists(join(targetDirFor(h.env, "fieldnote-do-work"), "SKILL.md")));
    assert.ok(await exists(join(targetDirFor(h.env, "fieldnote-run-agent"), "SKILL.md")));

    const manifest = await readManifest(h.env);
    assert.equal(manifest.skills["fieldnote-do-work"]?.version, "1.0.0");
    assert.equal(manifest.skills["fieldnote-run-agent"]?.version, "2.0.0");
    // The fake prompter was never consulted.
    assert.deepEqual(h.prompter.checkboxAnswers, []);
  } finally {
    await h.cleanup();
  }
});

test("--json emits machine-readable output and nothing decorative", async () => {
  const h = await makeHarness([{ name: "fieldnote-do-work", stage: "build" }]);
  try {
    await runInstall(h.env, ["fieldnote-do-work"], { json: true });
    assert.equal(h.logger.infos.length, 0, "no decorative info lines in --json mode");
    assert.equal(h.logger.outputs.length, 1);
    const payload = JSON.parse(h.logger.outputs[0]!);
    assert.deepEqual(
      payload.installed.map((i: { name: string; version: string; action: string; agent: string }) => ({
        name: i.name,
        version: i.version,
        action: i.action,
        agent: i.agent,
      })),
      [{ name: "fieldnote-do-work", version: "1.0.0", action: "installed", agent: "claude" }],
    );
  } finally {
    await h.cleanup();
  }
});

test("reinstalling an existing skill reports action=updated", async () => {
  const h = await makeHarness([{ name: "fieldnote-do-work", stage: "build" }]);
  try {
    await runInstall(h.env, ["fieldnote-do-work"], {});
    await runInstall(h.env, ["fieldnote-do-work"], { json: true });
    const payload = JSON.parse(h.logger.outputs.at(-1)!);
    assert.equal(payload.installed[0].action, "updated");
  } finally {
    await h.cleanup();
  }
});

test("installing an unknown skill fails with a clear error", async () => {
  const h = await makeHarness([{ name: "fieldnote-do-work", stage: "build" }]);
  try {
    await assert.rejects(() => runInstall(h.env, ["fieldnote-nope"], {}), UserError);
  } finally {
    await h.cleanup();
  }
});

test("install with no names is a user error", async () => {
  const h = await makeHarness([{ name: "fieldnote-do-work", stage: "build" }]);
  try {
    await assert.rejects(() => runInstall(h.env, [], {}), /requires at least one skill name/);
  } finally {
    await h.cleanup();
  }
});

test("installs a flat-tree skill into the claude dir", async () => {
  const h = await makeHarness([{ name: "fieldnote-parallel-wave", stage: "build", variance: "universal" }]);
  try {
    await runInstall(h.env, ["fieldnote-parallel-wave"], { yes: true, json: false });
    const installed = join(targetDirFor(h.env, "fieldnote-parallel-wave"), "SKILL.md");
    assert.ok(await exists(installed), "SKILL.md should be installed");
    const body = await readFile(installed, "utf8");
    assert.match(body, /stage: build/);
  } finally {
    await h.cleanup();
  }
});

test("install puts the skill in every agent home and says where each copy went", async () => {
  const h = await makeHarness([{ name: "fieldnote-do-work", stage: "build" }], {
    agents: ["claude", "codex"],
  });
  try {
    await runInstall(h.env, ["fieldnote-do-work"], {});

    for (const agent of ["claude", "codex"] as const) {
      const skill = join(h.homes[agent]!, "skills", "fieldnote-do-work", "SKILL.md");
      assert.ok(await stat(skill).then(() => true, () => false), `missing in ${agent}: ${skill}`);
    }
    const said = h.logger.infos.join("\n");
    assert.match(said, /claude/);
    assert.match(said, /codex/);
  } finally {
    await h.cleanup();
  }
});

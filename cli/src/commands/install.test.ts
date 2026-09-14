import { test } from "node:test";
import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
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
    { name: "vertuo-do-work", stage: "build", version: "1.0.0" },
    { name: "vertuo-run-agent", stage: "build", version: "2.0.0" },
  ]);
  try {
    await runInstall(h.env, ["vertuo-do-work", "vertuo-run-agent"], {});

    assert.ok(await exists(join(targetDirFor(h.env, "vertuo-do-work"), "SKILL.md")));
    assert.ok(await exists(join(targetDirFor(h.env, "vertuo-run-agent"), "SKILL.md")));

    const manifest = await readManifest(h.env);
    assert.equal(manifest.skills["vertuo-do-work"]?.version, "1.0.0");
    assert.equal(manifest.skills["vertuo-run-agent"]?.version, "2.0.0");
    // The fake prompter was never consulted.
    assert.deepEqual(h.prompter.checkboxAnswers, []);
  } finally {
    await h.cleanup();
  }
});

test("--json emits machine-readable output and nothing decorative", async () => {
  const h = await makeHarness([{ name: "vertuo-do-work", stage: "build" }]);
  try {
    await runInstall(h.env, ["vertuo-do-work"], { json: true });
    assert.equal(h.logger.infos.length, 0, "no decorative info lines in --json mode");
    assert.equal(h.logger.outputs.length, 1);
    const payload = JSON.parse(h.logger.outputs[0]!);
    assert.deepEqual(payload.installed, [
      { name: "vertuo-do-work", version: "1.0.0", action: "installed" },
    ]);
  } finally {
    await h.cleanup();
  }
});

test("reinstalling an existing skill reports action=updated", async () => {
  const h = await makeHarness([{ name: "vertuo-do-work", stage: "build" }]);
  try {
    await runInstall(h.env, ["vertuo-do-work"], {});
    await runInstall(h.env, ["vertuo-do-work"], { json: true });
    const payload = JSON.parse(h.logger.outputs.at(-1)!);
    assert.equal(payload.installed[0].action, "updated");
  } finally {
    await h.cleanup();
  }
});

test("installing an unknown skill fails with a clear error", async () => {
  const h = await makeHarness([{ name: "vertuo-do-work", stage: "build" }]);
  try {
    await assert.rejects(() => runInstall(h.env, ["vertuo-nope"], {}), UserError);
  } finally {
    await h.cleanup();
  }
});

test("install with no names is a user error", async () => {
  const h = await makeHarness([{ name: "vertuo-do-work", stage: "build" }]);
  try {
    await assert.rejects(() => runInstall(h.env, [], {}), /requires at least one skill name/);
  } finally {
    await h.cleanup();
  }
});

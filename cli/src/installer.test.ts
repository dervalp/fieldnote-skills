import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { installEntries, installSkill, targetDirFor } from "./installer.js";
import { readManifest } from "./manifest.js";
import { hashSkillDir } from "./lock.js";
import { makeHarness, toEntry } from "./testkit.js";

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

test("install copies the skill into ~/.claude and creates the skills dir", async () => {
  const h = await makeHarness([{ name: "vertuo-do-work", section: "engineering-standards" }]);
  try {
    const entry = toEntry({ name: "vertuo-do-work", section: "engineering-standards" });
    await installSkill(h.env, entry);

    const skillMd = join(targetDirFor(h.env, "vertuo-do-work"), "SKILL.md");
    assert.ok(await exists(skillMd), "SKILL.md should be installed");
    const text = await readFile(skillMd, "utf8");
    assert.match(text, /name: vertuo-do-work/);
  } finally {
    await h.cleanup();
  }
});

test("install is atomic: a missing source leaves the prior version untouched", async () => {
  const h = await makeHarness([{ name: "vertuo-do-work", section: "engineering-standards" }]);
  try {
    const good = toEntry({ name: "vertuo-do-work", section: "engineering-standards", version: "1.0.0" });
    await installSkill(h.env, good);

    // An entry whose section points nowhere has no source folder.
    const broken = toEntry({ name: "vertuo-do-work", section: "nonexistent-section", version: "2.0.0" });
    await assert.rejects(() => installSkill(h.env, broken), /not found/);

    // Prior install intact, manifest still v1, and no temp residue left behind.
    const skillMd = join(targetDirFor(h.env, "vertuo-do-work"), "SKILL.md");
    assert.ok(await exists(skillMd));
    const manifest = await readManifest(h.env);
    assert.equal(manifest.skills["vertuo-do-work"]?.version, "1.0.0");

    const skillsRoot = join(h.claudeDir, "skills");
    const leftovers = (await readdir(skillsRoot)).filter(
      (n) => n.startsWith(".staging-") || n.startsWith(".backup-"),
    );
    assert.deepEqual(leftovers, [], "no staging/backup temp dirs should remain");
  } finally {
    await h.cleanup();
  }
});

test("reinstalling replaces content cleanly (no stale files from the old version)", async () => {
  const h = await makeHarness([
    { name: "vertuo-do-work", section: "engineering-standards", files: { "OLD.md": "old" } },
  ]);
  try {
    const entry = toEntry({ name: "vertuo-do-work", section: "engineering-standards" });
    await installSkill(h.env, entry);
    const target = targetDirFor(h.env, "vertuo-do-work");
    assert.ok(await exists(join(target, "OLD.md")));

    // Remove OLD.md from the source, then reinstall.
    const { rm } = await import("node:fs/promises");
    await rm(join(h.sourceDir, "engineering-standards", "vertuo-do-work", "OLD.md"));
    await writeFile(
      join(h.sourceDir, "engineering-standards", "vertuo-do-work", "NEW.md"),
      "new",
      "utf8",
    );
    await installSkill(h.env, entry);

    assert.equal(await exists(join(target, "OLD.md")), false, "stale file should be gone");
    assert.ok(await exists(join(target, "NEW.md")), "new file should be present");
  } finally {
    await h.cleanup();
  }
});

test("install records a core hash matching the files on disk", async () => {
  const h = await makeHarness([{ name: "vertuo-do-thing", section: "engineering-standards" }]);
  try {
    await installEntries(h.env, [toEntry({ name: "vertuo-do-thing", section: "engineering-standards" })]);
    const manifest = await readManifest(h.env);
    const recorded = manifest.skills["vertuo-do-thing"]!.coreHash;
    const { coreHash } = hashSkillDir(targetDirFor(h.env, "vertuo-do-thing"));
    assert.equal(recorded, coreHash);
  } finally {
    await h.cleanup();
  }
});

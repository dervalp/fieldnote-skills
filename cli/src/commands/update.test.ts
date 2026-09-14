import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runUpdate, runSync } from "./update.js";
import { runInstall } from "./install.js";
import { runDoctor } from "./doctor.js";
import { hashSkillDir, renderLock, type LockEntry } from "../lock.js";
import { computeRows } from "../state.js";
import { targetDirFor } from "../installer.js";
import { readManifest } from "../manifest.js";
import { makeHarness, bumpVersion } from "../testkit.js";

test("list flags a skill whose bundled version is newer than installed", async () => {
  const h = await makeHarness([{ name: "vertuo-do-work", section: "engineering-standards", version: "1.0.0" }]);
  try {
    await runInstall(h.env, ["vertuo-do-work"], {});
    await bumpVersion(h, "vertuo-do-work", "1.1.0");

    const rows = await computeRows(h.env);
    const row = rows.find((r) => r.entry.name === "vertuo-do-work")!;
    assert.equal(row.installed, true);
    assert.equal(row.installedVersion, "1.0.0");
    assert.equal(row.outdated, true);
  } finally {
    await h.cleanup();
  }
});

test("update <name> updates a specific skill and refreshes the manifest", async () => {
  const h = await makeHarness([{ name: "vertuo-do-work", section: "engineering-standards", version: "1.0.0" }]);
  try {
    await runInstall(h.env, ["vertuo-do-work"], {});
    await bumpVersion(h, "vertuo-do-work", "2.0.0");

    await runUpdate(h.env, ["vertuo-do-work"]);

    const manifest = await readManifest(h.env);
    assert.equal(manifest.skills["vertuo-do-work"]?.version, "2.0.0");
    const md = await readFile(join(targetDirFor(h.env, "vertuo-do-work"), "SKILL.md"), "utf8");
    assert.match(md, /version: 2\.0\.0/);
  } finally {
    await h.cleanup();
  }
});

test("interactive update pre-checks outdated skills", async () => {
  const h = await makeHarness([
    { name: "vertuo-do-work", section: "engineering-standards", version: "1.0.0" },
    { name: "vertuo-run-agent", section: "engineering-standards", version: "1.0.0" },
  ]);
  try {
    await runInstall(h.env, ["vertuo-do-work", "vertuo-run-agent"], {});
    await bumpVersion(h, "vertuo-do-work", "1.1.0"); // only this one is outdated

    // Accept the pre-selection: the picker should default-check the outdated one.
    h.prompter.checkboxAnswers = [["vertuo-do-work"]];
    await runUpdate(h.env, []);

    const checked = h.prompter.lastCheckboxChoices.filter(
      (c): c is { name: string; value: string; checked?: boolean } => "checked" in c && Boolean(c.checked),
    );
    assert.deepEqual(checked.map((c) => c.value), ["vertuo-do-work"]);

    const manifest = await readManifest(h.env);
    assert.equal(manifest.skills["vertuo-do-work"]?.version, "1.1.0");
  } finally {
    await h.cleanup();
  }
});

test("update with nothing installed guides the user", async () => {
  const h = await makeHarness([{ name: "vertuo-do-work", section: "engineering-standards" }]);
  try {
    await runUpdate(h.env, []);
    assert.ok(h.logger.infos.some((l) => /No skills installed/.test(l)));
  } finally {
    await h.cleanup();
  }
});

test("sync updates outdated installed skills and reports newly available ones", async () => {
  const h = await makeHarness([
    { name: "vertuo-do-work", section: "engineering-standards", version: "1.0.0" },
    { name: "vertuo-run-agent", section: "engineering-standards", version: "1.0.0" },
  ]);
  try {
    await runInstall(h.env, ["vertuo-do-work"], {}); // only do-work installed
    await bumpVersion(h, "vertuo-do-work", "1.2.0"); // and it is now outdated

    await runSync(h.env, { json: true });
    const payload = JSON.parse(h.logger.outputs.at(-1)!);

    assert.deepEqual(payload.updated, [
      { name: "vertuo-do-work", version: "1.2.0", action: "updated" },
    ]);
    assert.deepEqual(
      payload.available.map((s: { name: string }) => s.name),
      ["vertuo-run-agent"],
    );

    const manifest = await readManifest(h.env);
    assert.equal(manifest.skills["vertuo-do-work"]?.version, "1.2.0");
  } finally {
    await h.cleanup();
  }
});

test("sync with everything current reports up to date", async () => {
  const h = await makeHarness([{ name: "vertuo-do-work", section: "engineering-standards" }]);
  try {
    await runInstall(h.env, ["vertuo-do-work"], {});
    await runSync(h.env, {});
    assert.ok(h.logger.infos.some((l) => /up to date/.test(l)));
  } finally {
    await h.cleanup();
  }
});

test("sync reports an orphan and names its replacement", async () => {
  const h = await makeHarness([{ name: "vertuo-matt-tdd", section: "engineering-standards", surface: "both" }]);
  try {
    await mkdir(join(h.claudeDir, "skills"), { recursive: true });
    await writeFile(
      join(h.claudeDir, "skills", ".fieldnote-skills.json"),
      JSON.stringify({ version: 1, skills: { tdd: { version: "0.0.0", section: "engineering-standards", surface: "code" } } }),
      "utf8",
    );
    await writeFile(
      join(h.repoRoot, "skills.lock.json"),
      JSON.stringify({ release: "skills-v1.0.0", skills: [{ name: "vertuo-matt-tdd", version: "1.0.0", coreHash: "x", files: {}, supersedes: ["tdd"] }] }),
      "utf8",
    );
    h.prompter.confirmAnswers = [false];
    await runSync(h.env, {});
    const out = h.logger.infos.join("\n");
    assert.match(out, /tdd/);
    assert.match(out, /superseded by vertuo-matt-tdd/);
  } finally {
    await h.cleanup();
  }
});

test("sync removes an orphan when confirmed", async () => {
  const h = await makeHarness([{ name: "vertuo-matt-tdd", section: "engineering-standards", surface: "both" }]);
  try {
    await mkdir(join(h.claudeDir, "skills", "tdd"), { recursive: true });
    await writeFile(join(h.claudeDir, "skills", "tdd", "SKILL.md"), "---\nname: tdd\n---\n", "utf8");
    await writeFile(
      join(h.claudeDir, "skills", ".fieldnote-skills.json"),
      JSON.stringify({ version: 1, skills: { tdd: { version: "0.0.0", section: "engineering-standards", surface: "code" } } }),
      "utf8",
    );
    await writeFile(
      join(h.repoRoot, "skills.lock.json"),
      JSON.stringify({ release: "skills-v1.0.0", skills: [{ name: "vertuo-matt-tdd", version: "1.0.0", coreHash: "x", files: {}, supersedes: ["tdd"] }] }),
      "utf8",
    );
    h.prompter.confirmAnswers = [true];
    await runSync(h.env, {});
    assert.equal(await readManifest(h.env).then((m) => m.skills["tdd"]), undefined);
    await assert.rejects(() => stat(join(h.claudeDir, "skills", "tdd")));
  } finally {
    await h.cleanup();
  }
});

test("sync --json lists orphans without prompting", async () => {
  const h = await makeHarness([{ name: "vertuo-matt-tdd", section: "engineering-standards", surface: "both" }]);
  try {
    await mkdir(join(h.claudeDir, "skills"), { recursive: true });
    await writeFile(
      join(h.claudeDir, "skills", ".fieldnote-skills.json"),
      JSON.stringify({ version: 1, skills: { tdd: { version: "0.0.0", section: "engineering-standards", surface: "code" } } }),
      "utf8",
    );
    await writeFile(
      join(h.repoRoot, "skills.lock.json"),
      JSON.stringify({ release: "skills-v1.0.0", skills: [{ name: "vertuo-matt-tdd", version: "1.0.0", coreHash: "x", files: {}, supersedes: ["tdd"] }] }),
      "utf8",
    );
    // Seed a confirm answer: if the --json path ever prompts, .shift() would
    // consume it. Asserting the array is untouched afterwards proves confirm
    // was never called — a payload-shape check alone can't tell a skipped
    // prompt from one that fired and silently defaulted to false.
    h.prompter.confirmAnswers = [true];
    await runSync(h.env, { json: true });
    const payload = JSON.parse(h.logger.outputs.at(-1)!) as { orphaned: { name: string; supersededBy?: string }[] };
    assert.deepEqual(payload.orphaned, [{ name: "tdd", supersededBy: "vertuo-matt-tdd" }]);
    assert.equal(h.prompter.confirmAnswers.length, 1, "confirm() must not be called on the --json path");

    // If it HAD prompted, the seeded `true` would also have triggered
    // removal — so also assert the orphan is still on record, which fails
    // loudly in a second, independent way.
    const manifest = await readManifest(h.env);
    assert.ok(manifest.skills["tdd"], "orphan should still be present; --json must not remove it");
  } finally {
    await h.cleanup();
  }
});

// --- C1: a release is catalog-level, so sync must act on it ---------------
//
// Most releases leave most skills' `version:` untouched. Before this fix,
// `outdated` (pure per-skill semver) was sync's only input, so every unchanged
// skill reported `behind` in doctor forever while sync answered "Everything
// installed is up to date." — the tool told people to run a command that
// could not fix what it had just reported.

/** Write release.json + a lock for the given skills at the given release. */
async function writeReleaseAndLock(
  h: Awaited<ReturnType<typeof makeHarness>>,
  release: string,
  skills: { name: string; section: string; version?: string }[],
  extra: LockEntry[] = [],
): Promise<void> {
  const entries: LockEntry[] = skills.map((s) => {
    const { coreHash, files } = hashSkillDir(join(h.sourceDir, s.section, s.name));
    return { name: s.name, version: s.version ?? "1.0.0", coreHash, files };
  });
  await writeFile(join(h.repoRoot, "release.json"), JSON.stringify({ release }) + "\n", "utf8");
  await writeFile(join(h.repoRoot, "skills.lock.json"), renderLock({ release, skills: [...entries, ...extra] }), "utf8");
}

const TDD = { name: "vertuo-matt-tdd", section: "engineering-standards", surface: "both" as const };

test("sync reinstalls a skill left behind by a new release even though its version never changed", async () => {
  const h = await makeHarness([TDD]);
  try {
    await writeReleaseAndLock(h, "skills-v1.0.0", [TDD]);
    await runInstall(h.env, [TDD.name], {});
    assert.equal((await readManifest(h.env)).skills[TDD.name]?.release, "skills-v1.0.0");

    // A new release is cut. Nothing about the skill itself changed.
    await writeReleaseAndLock(h, "skills-v1.0.1", [TDD]);

    await runSync(h.env, { json: true });
    const payload = JSON.parse(h.logger.outputs.at(-1)!) as { updated: { name: string }[] };
    assert.deepEqual(payload.updated.map((u) => u.name), [TDD.name]);
    assert.equal((await readManifest(h.env)).skills[TDD.name]?.release, "skills-v1.0.1");
  } finally {
    await h.cleanup();
  }
});

test("sync leaves a locally modified skill alone and reports it instead of overwriting", async () => {
  const h = await makeHarness([TDD]);
  try {
    await writeReleaseAndLock(h, "skills-v1.0.0", [TDD]);
    await runInstall(h.env, [TDD.name], {});
    await writeFile(join(targetDirFor(h.env, TDD.name), "SKILL.md"), "---\nname: mine\n---\n\nmy notes\n", "utf8");
    await writeReleaseAndLock(h, "skills-v1.0.1", [TDD]);

    await runSync(h.env, { json: true });
    const payload = JSON.parse(h.logger.outputs.at(-1)!) as {
      updated: { name: string }[];
      skipped: { name: string; state: string }[];
    };
    assert.deepEqual(payload.updated, [], "a modified copy must not be silently overwritten");
    assert.deepEqual(payload.skipped, [{ name: TDD.name, state: "modified" }]);
    const md = await readFile(join(targetDirFor(h.env, TDD.name), "SKILL.md"), "utf8");
    assert.match(md, /my notes/, "the engineer's edit must survive");
  } finally {
    await h.cleanup();
  }
});

test("sync still reports up to date when the release matches", async () => {
  const h = await makeHarness([TDD]);
  try {
    await writeReleaseAndLock(h, "skills-v1.0.0", [TDD]);
    await runInstall(h.env, [TDD.name], {});
    await runSync(h.env, {});
    assert.ok(h.logger.infos.some((l) => /up to date/.test(l)), h.logger.infos.join("\n"));
  } finally {
    await h.cleanup();
  }
});

// --- I2: one orphan definition, and a narrow removal set -----------------

test("sync reports the same orphans doctor does", async () => {
  const h = await makeHarness([TDD]);
  try {
    await writeReleaseAndLock(h, "skills-v1.0.0", [TDD], [
      { name: TDD.name, version: "1.0.0", coreHash: "x", files: {}, supersedes: ["tdd"] },
    ]);
    // Two directories installed by hand: one a vendored skill supersedes, one
    // nobody claims.
    await mkdir(join(h.claudeDir, "skills", "tdd"), { recursive: true });
    await mkdir(join(h.claudeDir, "skills", "diagnose"), { recursive: true });

    await runDoctor(h.env, { json: true });
    const doctorPayload = JSON.parse(h.logger.outputs.at(-1)!) as {
      claudeCode: { name: string; state: string }[];
    };
    const doctorOrphans = doctorPayload.claudeCode.filter((r) => r.state === "orphaned").map((r) => r.name).sort();

    h.prompter.confirmAnswers = [false];
    await runSync(h.env, { json: true });
    const syncPayload = JSON.parse(h.logger.outputs.at(-1)!) as {
      orphaned: { name: string }[];
      unmanaged: { name: string }[];
    };
    const syncOrphans = [...syncPayload.orphaned, ...syncPayload.unmanaged].map((o) => o.name).sort();

    assert.deepEqual(doctorOrphans, ["diagnose", "tdd"]);
    assert.deepEqual(syncOrphans, doctorOrphans, "sync and doctor must agree on what an orphan is");
  } finally {
    await h.cleanup();
  }
});

test("an unclaimed unmanaged directory is never removed, even on yes", async () => {
  const h = await makeHarness([TDD]);
  try {
    await writeReleaseAndLock(h, "skills-v1.0.0", [TDD], [
      { name: TDD.name, version: "1.0.0", coreHash: "x", files: {}, supersedes: ["tdd"] },
    ]);
    // `tdd` is claimed by a supersedes entry; the other two are somebody's own
    // work. Widening the orphan list must not arm `rm -rf` against them.
    for (const name of ["tdd", "my-own-skill", "borrowed-from-a-colleague"]) {
      await mkdir(join(h.claudeDir, "skills", name), { recursive: true });
      await writeFile(join(h.claudeDir, "skills", name, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
    }

    h.prompter.confirmAnswers = [true];
    await runSync(h.env, {});

    await assert.rejects(() => stat(join(h.claudeDir, "skills", "tdd")), "a superseded copy is removable");
    await stat(join(h.claudeDir, "skills", "my-own-skill"));
    await stat(join(h.claudeDir, "skills", "borrowed-from-a-colleague"));
    const out = h.logger.infos.join("\n");
    assert.match(out, /left alone/);
    assert.match(out, /my-own-skill/);
  } finally {
    await h.cleanup();
  }
});

test("sync never prompts when the only orphans are unmanaged", async () => {
  const h = await makeHarness([TDD]);
  try {
    await writeReleaseAndLock(h, "skills-v1.0.0", [TDD]);
    await mkdir(join(h.claudeDir, "skills", "someone-elses"), { recursive: true });
    h.prompter.confirmAnswers = [true];
    await runSync(h.env, {});
    assert.equal(h.prompter.confirmAnswers.length, 1, "nothing removable means nothing to confirm");
    await stat(join(h.claudeDir, "skills", "someone-elses"));
  } finally {
    await h.cleanup();
  }
});

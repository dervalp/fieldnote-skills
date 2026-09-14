import { strict as assert } from "node:assert";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { runDoctor } from "./doctor.js";
import { installEntries, targetDirFor } from "../installer.js";
import { hashSkillDir, renderLock, type LockEntry } from "../lock.js";
import { makeHarness, toEntry, type FixtureSkill } from "../testkit.js";

const SKILL = { name: "vertuo-matt-tdd", section: "engineering-standards", surface: "both" as const };

const VENDORED = {
  upstream: "https://github.com/mattpocock/skills",
  ref: "v1.2.3",
  commit: "6acc160e",
  path: "skills/engineering/tdd",
  license: "MIT",
  licenseFile: "skills/_vendor/mattpocock/LICENSE",
  upstreamBodyHash: "sha256:abc",
};

/** Write a lock next to the harness catalog, as the bundle would ship it. */
async function writeLockFor(
  h: Awaited<ReturnType<typeof makeHarness>>,
  release: string,
  opts: { coreHash?: string; vendored?: Record<string, string>; extra?: LockEntry[]; skills?: FixtureSkill[] } = {},
): Promise<void> {
  const skills = (opts.skills ?? [SKILL]).map((skill) => {
    const { coreHash, files } = hashSkillDir(join(h.sourceDir, skill.section, skill.name));
    const entry: LockEntry = {
      name: skill.name,
      version: "1.0.0",
      coreHash: opts.coreHash ?? coreHash,
      files,
      supersedes: ["tdd"],
    };
    if (opts.vendored !== undefined) entry.vendored = opts.vendored;
    return entry;
  });
  await writeFile(
    join(h.repoRoot, "skills.lock.json"),
    renderLock({ release, skills: [...skills, ...(opts.extra ?? [])] }),
    "utf8",
  );
  await writeFile(join(h.repoRoot, "release.json"), JSON.stringify({ release }) + "\n", "utf8");
}

/** Write a Mastra bundle at <root>/orch, returning the --orchestrator path. */
async function writeOrchestrator(
  h: Awaited<ReturnType<typeof makeHarness>>,
  manifest: unknown,
  pin?: unknown,
): Promise<string> {
  const root = join(h.repoRoot, "orch");
  const knowledge = join(root, "apps", "orchestrator", "src", "mastra", "public", "knowledge");
  await mkdir(knowledge, { recursive: true });
  if (manifest !== undefined) {
    await writeFile(join(knowledge, "manifest.json"), JSON.stringify(manifest), "utf8");
  }
  if (pin !== undefined) {
    await writeFile(join(root, "apps", "orchestrator", "skills.pin.json"), JSON.stringify(pin), "utf8");
  }
  return root;
}

test("reports ok for a freshly installed skill and exits 0", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0");
    await installEntries(h.env, [toEntry(SKILL)]);
    const code = await runDoctor(h.env, {});
    assert.equal(code, 0);
    const out = h.logger.infos.join("\n");
    assert.match(out, /skills-v1\.0\.0/);
    assert.match(out, /vertuo-matt-tdd/);
    assert.ok(!/behind|modified|orphaned/.test(out), out);
  } finally {
    await h.cleanup();
  }
});

test("reports modified when a file changed on disk, and never exits non-zero without --strict", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0");
    await installEntries(h.env, [toEntry(SKILL)]);
    await writeFile(join(targetDirFor(h.env, SKILL.name), "SKILL.md"), "---\nname: hacked\n---\n", "utf8");
    assert.equal(await runDoctor(h.env, {}), 0);
    assert.match(h.logger.infos.join("\n"), /modified/);
    assert.equal(await runDoctor(h.env, { strict: true }), 1);
  } finally {
    await h.cleanup();
  }
});

test("reports an orphan and names its replacement", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0");
    await mkdir(join(h.claudeDir, "skills", "tdd"), { recursive: true });
    await writeFile(
      join(h.claudeDir, "skills", ".fieldnote-skills.json"),
      JSON.stringify({ version: 1, skills: { tdd: { version: "0.0.0", section: "engineering-standards", surface: "code" } } }),
      "utf8",
    );
    await runDoctor(h.env, {});
    assert.match(h.logger.infos.join("\n"), /orphaned .*vertuo-matt-tdd/);
  } finally {
    await h.cleanup();
  }
});

test("reports an unmanaged directory as orphaned and names its replacement", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0");
    // "tdd" sits on disk but was never installed through this CLI — no
    // manifest entry at all, unlike a manifest-tracked orphan.
    await mkdir(join(h.claudeDir, "skills", "tdd"), { recursive: true });
    await runDoctor(h.env, {});
    const out = h.logger.infos.join("\n");
    assert.match(out, /⚠ tdd\s+—\s+—\s+orphaned — superseded by vertuo-matt-tdd/);
  } finally {
    await h.cleanup();
  }
});

test("says claude.ai cannot be inspected, and never claims it is fine", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0");
    await runDoctor(h.env, {});
    const out = h.logger.infos.join("\n");
    assert.match(out, /cannot be inspected/);
    assert.match(out, /vertuo-matt-tdd-skills-v1\.0\.0\.zip/);
  } finally {
    await h.cleanup();
  }
});

test("says Mastra was not checked when no path is given", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0");
    await runDoctor(h.env, {});
    assert.match(h.logger.infos.join("\n"), /not checked/);
  } finally {
    await h.cleanup();
  }
});

test("compares a Mastra manifest against the release when a path is given", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0");
    const orch = await writeOrchestrator(h, {
      release: "skills-v0.9.0",
      skills: [{ name: SKILL.name, version: "1.0.0" }],
    });
    await runDoctor(h.env, { orchestrator: orch });
    assert.match(h.logger.infos.join("\n"), /skills-v0\.9\.0/);
  } finally {
    await h.cleanup();
  }
});

// --- I1: the release label bound to content ------------------------------

test("reports divergent when the label matches but the bytes do not", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0");
    await installEntries(h.env, [toEntry(SKILL)]);
    // Same release, different content hash: two engineers holding different
    // bytes, both stamped skills-v1.0.0. This is what the hash is for.
    await writeLockFor(h, "skills-v1.0.0", { coreHash: "sha256:somethingelse" });

    assert.equal(await runDoctor(h.env, {}), 0);
    const out = h.logger.infos.join("\n");
    assert.match(out, /differs from skills-v1\.0\.0/);
    assert.ok(!/behind/.test(out), "a same-release divergence must not be reported as behind");
    assert.equal(await runDoctor(h.env, { strict: true }), 1, "divergence is drift, so --strict must exit 1");
  } finally {
    await h.cleanup();
  }
});

// --- I5: an unreadable tree under ~/.claude must not kill the report ------

test("survives a dangling symlink inside an installed skill and reports it", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0");
    await installEntries(h.env, [toEntry(SKILL)]);
    await symlink(join(h.claudeDir, "skills", "gone", "target.md"), join(targetDirFor(h.env, SKILL.name), "link.md"));

    assert.equal(await runDoctor(h.env, {}), 0);
    const out = h.logger.infos.join("\n");
    assert.match(out, /unreadable/);
    assert.match(out, /link\.md/);
    assert.ok(!/modified/.test(out), "a partial hash must never be reported as a local edit");
    // And the rest of the report still printed.
    assert.match(out, /cannot be inspected/);
  } finally {
    await h.cleanup();
  }
});

test("survives a dangling symlink standing in for a whole skill folder", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0");
    await mkdir(join(h.claudeDir, "skills"), { recursive: true });
    await symlink(join(h.claudeDir, "moved-repo", "some-skill"), join(h.claudeDir, "skills", "some-skill"));

    assert.equal(await runDoctor(h.env, {}), 0);
    assert.match(h.logger.infos.join("\n"), /some-skill/);
  } finally {
    await h.cleanup();
  }
});

// --- I4: the Mastra row must verify something before printing a tick -----

test("does not print a check mark for a Mastra manifest that carries no hashes", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0");
    const orch = await writeOrchestrator(h, {
      release: "skills-v1.0.0",
      skills: [{ name: SKILL.name, version: "1.0.0" }],
    });
    await runDoctor(h.env, { orchestrator: orch });
    const mastra = h.logger.infos.filter((l) => /manifest/.test(l)).join("\n");
    assert.ok(!mastra.includes("✔"), `a hashless bundle must not get a tick: ${mastra}`);
    assert.match(mastra, /no coreHash|cannot verify|carries no hashes/);
  } finally {
    await h.cleanup();
  }
});

test("names the Mastra skills whose hashes differ from the lock", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0");
    const orch = await writeOrchestrator(h, {
      release: "skills-v1.0.0",
      skills: [{ name: SKILL.name, version: "1.0.0", coreHash: "sha256:stale" }],
    });
    await runDoctor(h.env, { orchestrator: orch });
    const mastra = h.logger.infos.filter((l) => /manifest/.test(l)).join("\n");
    assert.ok(!mastra.includes("✔"));
    assert.match(mastra, /vertuo-matt-tdd/);
  } finally {
    await h.cleanup();
  }
});

test("verifies hashes and says so when the Mastra bundle really matches", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0");
    const { coreHash } = hashSkillDir(join(h.sourceDir, SKILL.section, SKILL.name));
    const orch = await writeOrchestrator(
      h,
      { release: "skills-v1.0.0", skills: [{ name: SKILL.name, version: "1.0.0", coreHash }] },
      { release: "skills-v1.0.0", skills: [SKILL.name] },
    );
    await runDoctor(h.env, { orchestrator: orch });
    assert.match(h.logger.infos.join("\n"), /✔ manifest matches skills-v1\.0\.0, 1 skill\(s\), hashes verified/);
  } finally {
    await h.cleanup();
  }
});

test("reports a Mastra pin that disagrees with the release", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0");
    const { coreHash } = hashSkillDir(join(h.sourceDir, SKILL.section, SKILL.name));
    const orch = await writeOrchestrator(
      h,
      { release: "skills-v1.0.0", skills: [{ name: SKILL.name, version: "1.0.0", coreHash }] },
      { release: "skills-v0.9.0", skills: [SKILL.name] },
    );
    await runDoctor(h.env, { orchestrator: orch });
    const out = h.logger.infos.join("\n");
    assert.match(out, /pin/);
    assert.match(out, /skills-v0\.9\.0/);
  } finally {
    await h.cleanup();
  }
});

// --- I6: the Upstream section, and the pin in the header -----------------

test("prints the upstream pin in the header and an Upstream section", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0", { vendored: VENDORED });
    await runDoctor(h.env, {});
    const out = h.logger.infos.join("\n");
    assert.match(out, /upstream pin mattpocock\/skills v1\.2\.3/);
    assert.match(out, /^Upstream {2}mattpocock\/skills$/m);
    assert.match(out, /latest not checked/);
  } finally {
    await h.cleanup();
  }
});

test("flags vendored skills that disagree on the upstream pin", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0", {
      vendored: VENDORED,
      extra: [
        {
          name: "vertuo-matt-triage",
          version: "1.0.0",
          coreHash: "sha256:x",
          files: {},
          vendored: { ...VENDORED, ref: "v1.3.0" },
        },
      ],
    });
    await runDoctor(h.env, {});
    const out = h.logger.infos.join("\n");
    assert.match(out, /disagree on the pin/);
    assert.match(out, /v1\.3\.0/);
  } finally {
    await h.cleanup();
  }
});

// --- M8: the table has to survive the longest name we ship ---------------

test("sizes the name column to the longest name printed", async () => {
  const long = {
    name: "vertuo-matt-improve-codebase-architecture",
    section: "engineering-standards",
    surface: "both" as const,
  };
  const h = await makeHarness([SKILL, long]);
  try {
    await writeLockFor(h, "skills-v1.0.0", { skills: [SKILL, long] });
    await installEntries(h.env, [toEntry(SKILL), toEntry(long)]);
    await runDoctor(h.env, {});
    const rows = h.logger.infos.filter((l) => /^ {2}[✔⚠] vertuo-matt-/.test(l));
    assert.equal(rows.length, 2);
    const columns = rows.map((l) => l.indexOf("1.0.0"));
    assert.equal(columns[0], columns[1], `version column must align:\n${rows.join("\n")}`);
  } finally {
    await h.cleanup();
  }
});

// --- M9: --json must show all three surfaces, not a third of the picture --

test("--json reports every surface, with claude.ai marked uninspectable", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0", { vendored: VENDORED });
    await installEntries(h.env, [toEntry(SKILL)]);
    await runDoctor(h.env, { json: true });
    const payload = JSON.parse(h.logger.outputs.at(-1)!) as {
      release: string;
      claudeCode: { name: string; state: string }[];
      mastra: { checked: boolean };
      claudeAi: { inspectable: boolean; expected: string[] };
      upstream: { pins: { repo: string; ref: string }[]; latestChecked: boolean };
    };
    assert.equal(payload.release, "skills-v1.0.0");
    assert.deepEqual(payload.claudeCode.map((r) => r.state), ["ok"]);
    assert.equal(payload.mastra.checked, false);
    assert.equal(payload.claudeAi.inspectable, false);
    assert.deepEqual(payload.claudeAi.expected, ["vertuo-matt-tdd-skills-v1.0.0.zip"]);
    assert.deepEqual(payload.upstream.pins, [{ repo: "mattpocock/skills", ref: "v1.2.3", skills: 1 }]);
    assert.equal(payload.upstream.latestChecked, false);
  } finally {
    await h.cleanup();
  }
});

// --- Multi-upstream vendoring is the healthy state, not a finding ---------

const SUPERPOWERS = {
  ...VENDORED,
  upstream: "https://github.com/obra/superpowers",
  ref: "v6.3.0",
  path: "skills/brainstorming",
};

/** A second vendored skill, so the lock carries two pins. */
function vendoredEntry(name: string, vendored: Record<string, string>): LockEntry {
  return { name, version: "1.0.0", coreHash: "sha256:x", files: {}, vendored };
}

test("names both upstreams in the header without calling two of them a disagreement", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0", {
      vendored: VENDORED,
      extra: [vendoredEntry("vertuo-superpowers-brainstorming", SUPERPOWERS)],
    });
    await runDoctor(h.env, {});
    const out = h.logger.infos.join("\n");
    assert.match(out, /upstream pins mattpocock\/skills v1\.2\.3, obra\/superpowers v6\.3\.0/);
    assert.ok(!/disagree/.test(out), `one ref per upstream is healthy multi-upstream vendoring:\n${out}`);
  } finally {
    await h.cleanup();
  }
});

test("the header cries disagreement only for the upstream that carries two refs", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0", {
      vendored: VENDORED,
      extra: [
        vendoredEntry("vertuo-matt-triage", { ...VENDORED, ref: "v1.3.0" }),
        vendoredEntry("vertuo-superpowers-brainstorming", SUPERPOWERS),
      ],
    });
    await runDoctor(h.env, {});
    const out = h.logger.infos.join("\n");
    assert.match(out, /upstream pins disagree \(mattpocock\/skills v1\.2\.3 \+ v1\.3\.0\)/);
    // The upstream that is fine must not be dragged into the accusation.
    assert.ok(!/disagree.*obra/.test(out), out);
  } finally {
    await h.cleanup();
  }
});

// --- What doctor promises about a locally edited skill must be what
//     `sync` actually does (`HELD` in commands/update.ts) ------------------

test("tells the truth about a locally modified skill: sync holds it, update overwrites", async () => {
  const h = await makeHarness([SKILL]);
  try {
    await writeLockFor(h, "skills-v1.0.0");
    await installEntries(h.env, [toEntry(SKILL)]);
    await writeFile(join(targetDirFor(h.env, SKILL.name), "SKILL.md"), "edited by hand\n", "utf8");

    assert.equal(await runDoctor(h.env, {}), 0);
    const out = h.logger.infos.join("\n");
    assert.match(out, /modified on disk/);
    assert.match(out, /`sync` leaves it/);
    assert.match(out, /`update vertuo-matt-tdd` overwrites/);
    assert.ok(!/would overwrite your edit/.test(out), `sync holds modified skills — it does not overwrite them:\n${out}`);
  } finally {
    await h.cleanup();
  }
});

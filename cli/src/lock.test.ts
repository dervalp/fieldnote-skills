import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { baseFm, makeSkillsDir, writeSkill } from "./skill-fixtures.js";
import { discover } from "./skill-model.js";
import {
  bodyOf,
  buildLock,
  computeLockEntry,
  hashSkillDir,
  hashSkillDirSafe,
  readLock,
  readRelease,
  renderLock,
  sha256,
} from "./lock.js";

function withSkillsDir(fn: (skillsDir: string) => void): void {
  const skillsDir = makeSkillsDir();
  try {
    fn(skillsDir);
  } finally {
    rmSync(dirname(skillsDir), { recursive: true, force: true });
  }
}

/** A throwaway directory for readRelease/readLock fixtures — never the repo root. */
function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "vz-lock-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const CODE = { surface: "code", variance: "configured" };

const VENDOR_FM = [
  "vendored:",
  "  upstream: https://github.com/mattpocock/skills",
  "  ref: v1.2.3",
  "  commit: 6acc160e",
  "  path: skills/engineering/tdd",
  "  license: MIT",
  "  licenseFile: skills/_vendor/mattpocock/LICENSE",
  "  upstreamBodyHash: sha256:abc",
].join("\n");

/** Splice extra frontmatter lines in just before the closing fence. */
function addFrontmatter(md: string, block: string): void {
  const text = readFileSync(md, "utf8");
  const end = text.indexOf("---", 3);
  writeFileSync(md, `${text.slice(0, end)}${block}\n${text.slice(end)}`, "utf8");
}

test("bodyOf returns everything after the closing fence", () => {
  assert.equal(bodyOf("---\nname: x\n---\n\n# Title\n"), "\n\n# Title\n");
  assert.equal(bodyOf("no frontmatter"), "no frontmatter");
});

test("roles are assigned and coreHash is stable across runs", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, "vertuo-do-thing", baseFm("vertuo-do-thing", CODE));
    const skillDir = dirname(md);
    writeFileSync(join(skillDir, "b.md"), "bee\n", "utf8");
    writeFileSync(join(skillDir, "a.md"), "ay\n", "utf8");
    mkdirSync(join(skillDir, "scripts"), { recursive: true });
    writeFileSync(join(skillDir, "scripts", "run.sh"), "echo hi\n", "utf8");

    const first = computeLockEntry(discover(d)[0]!);
    assert.equal(first.files["scripts/run.sh"]!.role, "tooling");
    assert.equal(first.files["a.md"]!.role, "prompt");
    assert.ok(first.coreHash.startsWith("sha256:"));
    assert.equal(computeLockEntry(discover(d)[0]!).coreHash, first.coreHash);
  });
});

test("a tooling-only change leaves coreHash alone but changes its file hash", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, "vertuo-do-thing", baseFm("vertuo-do-thing", CODE));
    mkdirSync(join(dirname(md), "scripts"), { recursive: true });
    writeFileSync(join(dirname(md), "scripts", "run.sh"), "one\n", "utf8");
    const before = computeLockEntry(discover(d)[0]!);
    writeFileSync(join(dirname(md), "scripts", "run.sh"), "two\n", "utf8");
    const after = computeLockEntry(discover(d)[0]!);
    assert.equal(before.coreHash, after.coreHash);
    assert.notEqual(before.files["scripts/run.sh"]!.hash, after.files["scripts/run.sh"]!.hash);
  });
});

test("a prompt-file change does change coreHash", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, "vertuo-do-thing", baseFm("vertuo-do-thing", CODE));
    writeFileSync(join(dirname(md), "a.md"), "one\n", "utf8");
    const before = computeLockEntry(discover(d)[0]!);
    writeFileSync(join(dirname(md), "a.md"), "two\n", "utf8");
    assert.notEqual(before.coreHash, computeLockEntry(discover(d)[0]!).coreHash);
  });
});

test("tests/ is excluded from the lock, as it never ships", () => {
  withSkillsDir((d) => {
    writeSkill(d, "vertuo-do-thing", baseFm("vertuo-do-thing", CODE), ["tests"]);
    const entry = computeLockEntry(discover(d)[0]!);
    assert.ok(!Object.keys(entry.files).some((f) => f.startsWith("tests/")), Object.keys(entry.files).join(","));
  });
});

test("buildLock stamps the release and covers every discovered skill", () => {
  withSkillsDir((d) => {
    writeSkill(d, "vertuo-do-thing", baseFm("vertuo-do-thing", CODE));
    writeSkill(d, "vertuo-make-deck", baseFm("vertuo-make-deck"));
    const lock = buildLock(discover(d), "skills-v1.0.0");
    assert.equal(lock.release, "skills-v1.0.0");
    assert.deepEqual(lock.skills.map((s) => s.name).sort(), ["vertuo-do-thing", "vertuo-make-deck"]);
  });
});

test("renderLock sorts skills by name and ends with a newline", () => {
  const out = renderLock({
    release: "skills-v1.0.0",
    skills: [
      { name: "b", version: "1.0.0", coreHash: sha256("b"), files: {} },
      { name: "a", version: "1.0.0", coreHash: sha256("a"), files: {} },
    ],
  });
  assert.ok(out.endsWith("\n"));
  assert.ok(out.indexOf('"a"') < out.indexOf('"b"'));
});

test("a vendored skill's lock entry carries vendored, upstreamBodyHash, and a distinct bodyHash", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, "fieldnote-matt-tdd", baseFm("fieldnote-matt-tdd", CODE));
    addFrontmatter(md, `supersedes: [tdd]\n${VENDOR_FM}`);
    const entry = computeLockEntry(discover(d)[0]!);
    assert.ok(entry.vendored);
    assert.equal(entry.vendored!["upstream"], "https://github.com/mattpocock/skills");
    assert.equal(entry.upstreamBodyHash, "sha256:abc");
    const expectedBodyHash = sha256(bodyOf(readFileSync(md, "utf8")));
    assert.equal(entry.bodyHash, expectedBodyHash);
    assert.notEqual(entry.bodyHash, entry.upstreamBodyHash);
  });
});

test("computeLockEntry falls back to folderName when name is absent from frontmatter", () => {
  withSkillsDir((d) => {
    const fm = baseFm("vertuo-do-thing", CODE);
    delete fm["name"];
    writeSkill(d, "vertuo-do-thing", fm);
    const entry = computeLockEntry(discover(d)[0]!);
    assert.equal(entry.name, "vertuo-do-thing");
  });
});

test("readRelease returns \"unreleased\" when release.json is absent", () => {
  withTempDir((dir) => {
    assert.equal(readRelease(dir), "unreleased");
  });
});

test("readRelease returns \"unreleased\" when release.json is malformed JSON", () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, "release.json"), "{not valid json", "utf8");
    assert.equal(readRelease(dir), "unreleased");
  });
});

test("readRelease returns \"unreleased\" when release is blank or not a string", () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, "release.json"), JSON.stringify({ release: "" }), "utf8");
    assert.equal(readRelease(dir), "unreleased");
  });
  withTempDir((dir) => {
    writeFileSync(join(dir, "release.json"), JSON.stringify({ release: 42 }), "utf8");
    assert.equal(readRelease(dir), "unreleased");
  });
});

test("readRelease returns the real value when release.json holds one", () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, "release.json"), JSON.stringify({ release: "skills-v1.0.0" }), "utf8");
    assert.equal(readRelease(dir), "skills-v1.0.0");
  });
});

test("readLock returns the parsed lock for a well-formed file", () => {
  withTempDir((dir) => {
    const path = join(dir, "skills.lock.json");
    const lock = { release: "skills-v1.0.0", skills: [] };
    writeFileSync(path, JSON.stringify(lock), "utf8");
    assert.deepEqual(readLock(path), lock);
  });
});

test("readLock returns null for a missing file", () => {
  withTempDir((dir) => {
    assert.equal(readLock(join(dir, "does-not-exist.json")), null);
  });
});

test("readLock returns null for malformed JSON", () => {
  withTempDir((dir) => {
    const path = join(dir, "skills.lock.json");
    writeFileSync(path, "{not valid json", "utf8");
    assert.equal(readLock(path), null);
  });
});

test("readLock returns null when skills is not an array", () => {
  withTempDir((dir) => {
    const path = join(dir, "skills.lock.json");
    writeFileSync(path, JSON.stringify({ release: "skills-v1.0.0", skills: {} }), "utf8");
    assert.equal(readLock(path), null);
  });
});

// --- I5: the read-the-user's-machine path must not die on a broken entry ---

test("hashSkillDir stays strict for a repo skill, so npm run catalog fails loudly", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, "vertuo-do-thing", baseFm("vertuo-do-thing", CODE));
    const skillDir = dirname(md);
    // The everyday breakage: a symlink into a repo that has since moved.
    symlinkSync(join(skillDir, "nowhere", "gone.md"), join(skillDir, "dangling.md"));
    assert.throws(() => hashSkillDir(skillDir));
  });
});

test("hashSkillDirSafe reports the unreadable entry instead of aborting the run", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, "vertuo-do-thing", baseFm("vertuo-do-thing", CODE));
    const skillDir = dirname(md);
    symlinkSync(join(skillDir, "nowhere", "gone.md"), join(skillDir, "dangling.md"));

    const result = hashSkillDirSafe(skillDir);
    assert.deepEqual(result.unreadable, ["dangling.md"]);
    // SKILL.md was still hashed — but the caller is told the tree is partial,
    // so it can report "unreadable" instead of the lie "modified".
    assert.ok(result.files["SKILL.md"]);
  });
});

test("hashSkillDirSafe survives an unreadable subdirectory", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, "vertuo-do-thing", baseFm("vertuo-do-thing", CODE));
    const skillDir = dirname(md);
    symlinkSync(join(skillDir, "nowhere"), join(skillDir, "references"));
    const result = hashSkillDirSafe(skillDir);
    assert.deepEqual(result.unreadable, ["references"]);
  });
});

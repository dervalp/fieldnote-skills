import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseFrontmatter } from "./skill-model.js";
import { importSkill, renderVendoredSkillMd, vendoredNameFor } from "./vendor-import.js";

const SKILL = {
  upstreamPath: "skills/engineering/tdd",
  surface: "both" as const,
  stage: "build" as const,
  variance: "configured" as const,
  version: "1.0.0",
  supersedes: ["tdd"],
  description:
    "Use when an engineer wants to build a feature or fix a bug test-first, red green refactor, one vertical slice at a time.",
};

const COMMON = {
  upstream: "https://github.com/mattpocock/skills",
  ref: "v1.2.3",
  commit: "6acc160e",
  license: "MIT",
  licenseFile: "skills/_vendor/mattpocock/LICENSE",
};

test("derives our name from the upstream folder", () => {
  assert.equal(vendoredNameFor("skills/engineering/to-tickets", "fieldnote-matt-"), "fieldnote-matt-to-tickets");
});

test("renders our frontmatter over the upstream body", () => {
  const md = renderVendoredSkillMd({
    name: "fieldnote-matt-tdd",
    release: "unreleased",
    skill: SKILL,
    common: COMMON,
    body: "\n# TDD\n\nRun /fieldnote-matt-code-review after.\n",
    upstreamBodyHash: "sha256:deadbeef",
  });
  const fm = parseFrontmatter(md)!;
  assert.equal(fm["name"], "fieldnote-matt-tdd");
  assert.equal(fm["surface"], "both");
  assert.equal(fm["release"], "unreleased");
  assert.deepEqual(fm["supersedes"], ["tdd"]);
  const vendored = fm["vendored"] as Record<string, string>;
  assert.equal(vendored["upstreamBodyHash"], "sha256:deadbeef");
  assert.equal(vendored["path"], "skills/engineering/tdd");
  assert.ok(md.includes("# TDD"));
});

test("the rendered description is exactly one line", () => {
  const md = renderVendoredSkillMd({
    name: "fieldnote-matt-tdd",
    release: "unreleased",
    skill: { ...SKILL, description: "Use when an engineer\n  wants it\n  on one line despite this." },
    common: COMMON,
    body: "\n# TDD\n",
    upstreamBodyHash: "sha256:x",
  });
  assert.equal(md.split("\n").filter((l) => l.startsWith("description:")).length, 1);
  assert.ok(md.includes("description: Use when an engineer wants it on one line despite this."));
});

test("a description containing --- throws instead of silently truncating the frontmatter", () => {
  assert.throws(
    () =>
      renderVendoredSkillMd({
        name: "fieldnote-matt-tdd",
        release: "unreleased",
        skill: { ...SKILL, description: "Use when the plan needs --- review before merging." },
        common: COMMON,
        body: "\n# TDD\n",
        upstreamBodyHash: "sha256:x",
      }),
    (err: unknown) => err instanceof Error && err.message.includes("fieldnote-matt-tdd") && err.message.includes("---"),
  );
});

test("a description wrapped in [ ] throws instead of being misparsed as a list", () => {
  assert.throws(
    () =>
      renderVendoredSkillMd({
        name: "fieldnote-matt-tdd",
        release: "unreleased",
        skill: { ...SKILL, description: "[Use when the description looks like a list]" },
        common: COMMON,
        body: "\n# TDD\n",
        upstreamBodyHash: "sha256:x",
      }),
    (err: unknown) => err instanceof Error && err.message.includes("fieldnote-matt-tdd"),
  );
});

test("a description with an ordinary colon and normal punctuation still round-trips", () => {
  const md = renderVendoredSkillMd({
    name: "fieldnote-matt-tdd",
    release: "unreleased",
    skill: { ...SKILL, description: "Use when: the engineer wants tests first, red-green-refactor style." },
    common: COMMON,
    body: "\n# TDD\n",
    upstreamBodyHash: "sha256:x",
  });
  const fm = parseFrontmatter(md)!;
  assert.equal(fm["description"], "Use when: the engineer wants tests first, red-green-refactor style.");
});

test("copies siblings, skips agents/, rewrites refs and reports unresolved ones", () => {
  const root = mkdtempSync(join(tmpdir(), "vz-vendor-"));
  try {
    const src = join(root, "up", "skills", "engineering", "tdd");
    mkdirSync(join(src, "agents"), { recursive: true });
    mkdirSync(join(src, "scripts"), { recursive: true });
    writeFileSync(join(src, "SKILL.md"), "---\nname: tdd\n---\n\n# TDD\n\nSee /code-review and /wizard.\n", "utf8");
    writeFileSync(join(src, "tests.md"), "test guidance\n", "utf8");
    writeFileSync(join(src, "agents", "openai.yaml"), "nope\n", "utf8");
    writeFileSync(join(src, "scripts", "run.sh"), "echo hi\n", "utf8");

    const dest = join(root, "out", "fieldnote-matt-tdd");
    const result = importSkill({
      refStyle: { kind: "slash" },
      upstreamRoot: join(root, "up"),
      destDir: dest,
      name: "fieldnote-matt-tdd",
      release: "unreleased",
      skill: SKILL,
      common: COMMON,
      vendoredNames: new Set(["tdd", "code-review"]),
      allUpstreamNames: new Set(["tdd", "code-review", "wizard"]),
    });

    assert.deepEqual(result.unresolved, ["wizard"]);
    const md = readFileSync(join(dest, "SKILL.md"), "utf8");
    assert.ok(md.includes("/fieldnote-matt-code-review"));
    assert.ok(md.includes("/wizard"), "an unvendored reference is left alone, not broken");
    assert.equal(readFileSync(join(dest, "tests.md"), "utf8"), "test guidance\n");
    assert.equal(readFileSync(join(dest, "scripts", "run.sh"), "utf8"), "echo hi\n");
    assert.throws(() => readFileSync(join(dest, "agents", "openai.yaml"), "utf8"), "agents/ must not be vendored");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rewrites a top-level sibling .md file, not just SKILL.md", () => {
  const root = mkdtempSync(join(tmpdir(), "vz-vendor-"));
  try {
    const src = join(root, "up", "skills", "engineering", "tdd");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "SKILL.md"), "---\nname: tdd\n---\n\n# TDD\n", "utf8");
    writeFileSync(join(src, "notes.md"), "See /code-review for the follow-up.\n", "utf8");

    const dest = join(root, "out", "fieldnote-matt-tdd");
    importSkill({
      refStyle: { kind: "slash" },
      upstreamRoot: join(root, "up"),
      destDir: dest,
      name: "fieldnote-matt-tdd",
      release: "unreleased",
      skill: SKILL,
      common: COMMON,
      vendoredNames: new Set(["tdd", "code-review"]),
      allUpstreamNames: new Set(["tdd", "code-review"]),
    });

    assert.equal(readFileSync(join(dest, "notes.md"), "utf8"), "See /fieldnote-matt-code-review for the follow-up.\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rewrites a .md file nested in a subdirectory", () => {
  const root = mkdtempSync(join(tmpdir(), "vz-vendor-"));
  try {
    const src = join(root, "up", "skills", "engineering", "tdd");
    mkdirSync(join(src, "references"), { recursive: true });
    writeFileSync(join(src, "SKILL.md"), "---\nname: tdd\n---\n\n# TDD\n", "utf8");
    writeFileSync(join(src, "references", "deep.md"), "Deep guidance: see /code-review.\n", "utf8");

    const dest = join(root, "out", "fieldnote-matt-tdd");
    importSkill({
      refStyle: { kind: "slash" },
      upstreamRoot: join(root, "up"),
      destDir: dest,
      name: "fieldnote-matt-tdd",
      release: "unreleased",
      skill: SKILL,
      common: COMMON,
      vendoredNames: new Set(["tdd", "code-review"]),
      allUpstreamNames: new Set(["tdd", "code-review"]),
    });

    assert.equal(
      readFileSync(join(dest, "references", "deep.md"), "utf8"),
      "Deep guidance: see /fieldnote-matt-code-review.\n",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("never rewrites scripts/ content, even a slash token that matches a vendored name", () => {
  const root = mkdtempSync(join(tmpdir(), "vz-vendor-"));
  try {
    const src = join(root, "up", "skills", "engineering", "tdd");
    mkdirSync(join(src, "scripts"), { recursive: true });
    writeFileSync(join(src, "SKILL.md"), "---\nname: tdd\n---\n\n# TDD\n", "utf8");
    writeFileSync(join(src, "scripts", "run.sh"), "echo /tdd\n", "utf8");

    const dest = join(root, "out", "fieldnote-matt-tdd");
    importSkill({
      refStyle: { kind: "slash" },
      upstreamRoot: join(root, "up"),
      destDir: dest,
      name: "fieldnote-matt-tdd",
      release: "unreleased",
      skill: SKILL,
      common: COMMON,
      vendoredNames: new Set(["tdd"]),
      allUpstreamNames: new Set(["tdd"]),
    });

    assert.equal(readFileSync(join(dest, "scripts", "run.sh"), "utf8"), "echo /tdd\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unions unresolved references from siblings, not just SKILL.md", () => {
  const root = mkdtempSync(join(tmpdir(), "vz-vendor-"));
  try {
    const src = join(root, "up", "skills", "engineering", "tdd");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "SKILL.md"), "---\nname: tdd\n---\n\n# TDD\n", "utf8");
    writeFileSync(join(src, "notes.md"), "See /wayfinder for routing.\n", "utf8");

    const dest = join(root, "out", "fieldnote-matt-tdd");
    const result = importSkill({
      refStyle: { kind: "slash" },
      upstreamRoot: join(root, "up"),
      destDir: dest,
      name: "fieldnote-matt-tdd",
      release: "unreleased",
      skill: SKILL,
      common: COMMON,
      vendoredNames: new Set(["tdd"]),
      allUpstreamNames: new Set(["tdd", "wayfinder"]),
    });

    assert.deepEqual(result.unresolved, ["wayfinder"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("preserves an existing references/ directory across the destination wipe", () => {
  const root = mkdtempSync(join(tmpdir(), "vz-vendor-"));
  try {
    const src = join(root, "up", "skills", "engineering", "tdd");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "SKILL.md"), "---\nname: tdd\n---\n\n# TDD\n", "utf8");

    const dest = join(root, "out", "fieldnote-matt-tdd");
    mkdirSync(join(dest, "references"), { recursive: true });
    writeFileSync(join(dest, "references", "fieldnote-context.md"), "Our own fieldnote context.\n", "utf8");

    importSkill({
      refStyle: { kind: "slash" },
      upstreamRoot: join(root, "up"),
      destDir: dest,
      name: "fieldnote-matt-tdd",
      release: "unreleased",
      skill: SKILL,
      common: COMMON,
      vendoredNames: new Set(["tdd"]),
      allUpstreamNames: new Set(["tdd"]),
    });

    assert.equal(
      readFileSync(join(dest, "references", "fieldnote-context.md"), "utf8"),
      "Our own fieldnote context.\n",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("upstream's references/ file wins over our preserved snapshot of the same name", () => {
  const root = mkdtempSync(join(tmpdir(), "vz-vendor-"));
  try {
    const src = join(root, "up", "skills", "engineering", "tdd");
    mkdirSync(join(src, "references"), { recursive: true });
    writeFileSync(join(src, "SKILL.md"), "---\nname: tdd\n---\n\n# TDD\n", "utf8");
    writeFileSync(join(src, "references", "fieldnote-context.md"), "Upstream now ships this file too.\n", "utf8");

    const dest = join(root, "out", "fieldnote-matt-tdd");
    mkdirSync(join(dest, "references"), { recursive: true });
    writeFileSync(join(dest, "references", "fieldnote-context.md"), "Our stale local copy.\n", "utf8");

    importSkill({
      refStyle: { kind: "slash" },
      upstreamRoot: join(root, "up"),
      destDir: dest,
      name: "fieldnote-matt-tdd",
      release: "unreleased",
      skill: SKILL,
      common: COMMON,
      vendoredNames: new Set(["tdd"]),
      allUpstreamNames: new Set(["tdd"]),
    });

    assert.equal(
      readFileSync(join(dest, "references", "fieldnote-context.md"), "utf8"),
      "Upstream now ships this file too.\n",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("importing with no existing references/ directory does not crash", () => {
  const root = mkdtempSync(join(tmpdir(), "vz-vendor-"));
  try {
    const src = join(root, "up", "skills", "engineering", "tdd");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "SKILL.md"), "---\nname: tdd\n---\n\n# TDD\n", "utf8");

    const dest = join(root, "out", "fieldnote-matt-tdd");
    assert.doesNotThrow(() =>
      importSkill({
      refStyle: { kind: "slash" },
        upstreamRoot: join(root, "up"),
        destDir: dest,
        name: "fieldnote-matt-tdd",
        release: "unreleased",
        skill: SKILL,
        common: COMMON,
        vendoredNames: new Set(["tdd"]),
        allUpstreamNames: new Set(["tdd"]),
      }),
    );
    assert.ok(readFileSync(join(dest, "SKILL.md"), "utf8").includes("# TDD"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a re-import drops a file upstream no longer ships", () => {
  const root = mkdtempSync(join(tmpdir(), "vz-vendor-"));
  try {
    const src = join(root, "up", "skills", "engineering", "tdd");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "SKILL.md"), "---\nname: tdd\n---\n\n# TDD\n", "utf8");
    writeFileSync(join(src, "gone.md"), "old\n", "utf8");
    const dest = join(root, "out", "fieldnote-matt-tdd");
    const args = {
      upstreamRoot: join(root, "up"),
      destDir: dest,
      name: "fieldnote-matt-tdd",
      release: "unreleased",
      skill: SKILL,
      common: COMMON,
      vendoredNames: new Set(["tdd"]),
      allUpstreamNames: new Set(["tdd"]),
      refStyle: { kind: "slash" } as const,
    };
    importSkill(args);
    assert.equal(readFileSync(join(dest, "gone.md"), "utf8"), "old\n");
    rmSync(join(src, "gone.md"));
    importSkill(args);
    assert.throws(() => readFileSync(join(dest, "gone.md"), "utf8"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// importSkill wipes destDir before copying. Safe today only because the
// prefix is non-empty: with prefix "" (or an upstreamPath whose basename
// collapses) destDir would be the *section* directory, and the wipe would
// take every skill in it. The guard makes that impossible to reach.
test("refuses to import under a name that is not a vendored name, before wiping anything", () => {
  const root = mkdtempSync(join(tmpdir(), "vz-vendor-"));
  try {
    const src = join(root, "up", "skills", "engineering", "tdd");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "SKILL.md"), "---\nname: tdd\n---\n\n# TDD\n", "utf8");

    // The section directory, holding an unrelated skill that must survive.
    const section = join(root, "out", "engineering-standards");
    mkdirSync(join(section, "vertuo-do-work"), { recursive: true });
    writeFileSync(join(section, "vertuo-do-work", "SKILL.md"), "---\nname: vertuo-do-work\n---\n", "utf8");

    for (const [name, destDir] of [
      ["tdd", join(section, "tdd")], // prefix: "" — an unprefixed name
      ["fieldnote-matt-tdd", section], // destDir collapsed to the section dir
    ] as const) {
      assert.throws(
        () =>
          importSkill({
      refStyle: { kind: "slash" },
            upstreamRoot: join(root, "up"),
            destDir,
            name,
            release: "unreleased",
            skill: SKILL,
            common: COMMON,
            vendoredNames: new Set(["tdd"]),
            allUpstreamNames: new Set(["tdd"]),
          }),
        /vendor/i,
      );
    }

    assert.equal(
      readFileSync(join(section, "vertuo-do-work", "SKILL.md"), "utf8"),
      "---\nname: vertuo-do-work\n---\n",
      "the section directory and its skills must survive a refused import",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("imports a flat-layout upstream with namespaced references", () => {
  const root = mkdtempSync(join(tmpdir(), "vz-vendor-"));
  try {
    // obra/superpowers: skills sit directly under skills/, name each other
    // `superpowers:<name>`, and point at their own bundled files by repo path.
    const src = join(root, "up", "skills", "brainstorming");
    mkdirSync(src, { recursive: true });
    writeFileSync(
      join(src, "SKILL.md"),
      "---\nname: brainstorming\n---\n\n# Brainstorming\n\n" +
        "Then use superpowers:writing-plans, or superpowers:using-git-worktrees.\n" +
        "Read `skills/brainstorming/visual-companion.md` first.\n",
      "utf8",
    );
    writeFileSync(join(src, "visual-companion.md"), "Hand off to superpowers:writing-plans.\n", "utf8");

    const dest = join(root, "out", "fieldnote-superpowers-brainstorming");
    const result = importSkill({
      refStyle: { kind: "namespace", namespace: "superpowers" },
      upstreamRoot: join(root, "up"),
      destDir: dest,
      name: "fieldnote-superpowers-brainstorming",
      release: "unreleased",
      skill: { ...SKILL, upstreamPath: "skills/brainstorming", supersedes: ["brainstorming"] },
      common: { ...COMMON, upstream: "https://github.com/obra/superpowers" },
      vendoredNames: new Set(["brainstorming", "writing-plans"]),
      allUpstreamNames: new Set(["brainstorming", "writing-plans", "using-git-worktrees"]),
    });

    assert.deepEqual(result.unresolved, ["using-git-worktrees"]);
    const md = readFileSync(join(dest, "SKILL.md"), "utf8");
    assert.ok(md.includes("use fieldnote-superpowers-writing-plans"));
    assert.ok(md.includes("superpowers:using-git-worktrees"), "an unvendored sibling is left alone");
    assert.ok(md.includes("`../fieldnote-superpowers-brainstorming/visual-companion.md`"));
    assert.equal(
      readFileSync(join(dest, "visual-companion.md"), "utf8"),
      "Hand off to fieldnote-superpowers-writing-plans.\n",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("refuses a destination whose name carries no known vendor prefix", () => {
  const root = mkdtempSync(join(tmpdir(), "vz-vendor-"));
  try {
    const src = join(root, "up", "skills", "brainstorming");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "SKILL.md"), "---\nname: brainstorming\n---\n\n# B\n", "utf8");
    assert.throws(
      () =>
        importSkill({
          refStyle: { kind: "namespace", namespace: "superpowers" },
          upstreamRoot: join(root, "up"),
          destDir: join(root, "out", "vertuo-obra-brainstorming"),
          name: "vertuo-obra-brainstorming",
          release: "unreleased",
          skill: { ...SKILL, upstreamPath: "skills/brainstorming" },
          common: COMMON,
          vendoredNames: new Set(["brainstorming"]),
          allUpstreamNames: new Set(["brainstorming"]),
        }),
      (err: unknown) => err instanceof Error && err.message.includes("fieldnote-matt-*, fieldnote-superpowers-*"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


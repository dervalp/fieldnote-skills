import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ADVISED_CONCERNS,
  CONCERNS_DIR,
  CONCERN_NAME_RE,
  classifyConcerns,
  concernPath,
  findConcerns,
  missingConcerns,
  sortConcerns,
} from "./concerns.js";

const repoRoot = join(import.meta.dirname, "..", "..");

/** A temp repo root with the given concern files present, removed afterwards. */
function withRepo(files: string[], fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "fn-concerns-"));
  try {
    if (files.length > 0) {
      mkdirSync(join(root, ".fieldnote", "concerns"), { recursive: true });
      for (const f of files) writeFileSync(join(root, ".fieldnote", "concerns", f), "# x\n", "utf8");
    }
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("the convention advises six concerns, broad to narrow", () => {
  assert.deepEqual(
    [...ADVISED_CONCERNS],
    ["shared", "front-end", "backend", "database", "qa", "ci"],
  );
});

test("the folder sits next to the profile", () => {
  assert.equal(CONCERNS_DIR, ".fieldnote/concerns");
  assert.equal(concernPath("front-end"), ".fieldnote/concerns/front-end.md");
});

test("a concern name is a kebab-case file stem", () => {
  assert.ok(CONCERN_NAME_RE.test("front-end"));
  assert.ok(CONCERN_NAME_RE.test("qa"));
  assert.ok(!CONCERN_NAME_RE.test("Front-End"));
  assert.ok(!CONCERN_NAME_RE.test("front_end"));
  assert.ok(!CONCERN_NAME_RE.test("front-end.md"));
  assert.ok(!CONCERN_NAME_RE.test(""));
});

test("advised names sort in convention order, extras alphabetically after", () => {
  assert.deepEqual(
    sortConcerns(["prompts", "ci", "shared", "ios", "backend"]),
    ["shared", "backend", "ci", "ios", "prompts"],
  );
});

test("findConcerns reads the folder and drops anything that is not a .md file", () => {
  withRepo(["shared.md", "ci.md", "notes.txt"], (root) => {
    assert.deepEqual(findConcerns(root), ["shared", "ci"]);
  });
});

test("findConcerns returns nothing for a repository with no folder", () => {
  withRepo([], (root) => {
    assert.deepEqual(findConcerns(root), []);
  });
});

test("findConcerns keeps a repository's own concern name", () => {
  withRepo(["shared.md", "prompts.md"], (root) => {
    assert.deepEqual(findConcerns(root), ["shared", "prompts"]);
  });
});

test("missingConcerns names declared files the repository does not have", () => {
  assert.deepEqual(missingConcerns(["shared", "qa", "ci"], ["shared"]), ["qa", "ci"]);
  assert.deepEqual(missingConcerns(["shared"], ["shared", "ci"]), []);
});

test("a starter ships for every advised concern", () => {
  for (const name of ADVISED_CONCERNS) {
    const path = join(repoRoot, "templates", "concerns", `${name}.md`);
    assert.ok(existsSync(path), `templates/concerns/${name}.md must exist`);
  }
});

test("the convention document shows every advised concern, so the copies cannot drift", () => {
  const md = readFileSync(join(repoRoot, "docs", "concerns.md"), "utf8");
  for (const name of ADVISED_CONCERNS) {
    assert.ok(md.includes(concernPath(name)), `docs/concerns.md must show ${concernPath(name)}`);
  }
});

test("classifyConcerns pairs what skills want with what the repository has, wantedBy sorted alphabetically regardless of insertion order", () => {
  const rows = classifyConcerns({
    present: ["shared", "ci"],
    // "shared" is declared by fieldnote-fix-bug BEFORE fieldnote-do-work here
    // — insertion order disagrees with alphabetical order, so the assertion
    // below only passes if classifyConcerns actually sorts wantedBy.
    declaredBy: new Map([
      ["fieldnote-pr-monitor", ["ci"]],
      ["fieldnote-fix-bug", ["shared", "qa"]],
      ["fieldnote-do-work", ["shared"]],
    ]),
  });
  assert.deepEqual(rows, [
    { name: "shared", present: true, wantedBy: ["fieldnote-do-work", "fieldnote-fix-bug"] },
    { name: "qa", present: false, wantedBy: ["fieldnote-fix-bug"] },
    { name: "ci", present: true, wantedBy: ["fieldnote-pr-monitor"] },
  ]);
});

test("classifyConcerns reports a file no installed skill asked for", () => {
  const rows = classifyConcerns({ present: ["prompts"], declaredBy: new Map() });
  assert.deepEqual(rows, [{ name: "prompts", present: true, wantedBy: [] }]);
});

test("classifyConcerns on a repository with nothing returns nothing", () => {
  assert.deepEqual(classifyConcerns({ present: [], declaredBy: new Map() }), []);
});

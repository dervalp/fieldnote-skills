import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ADVISED_CONCERNS,
  CONCERNS_DIR,
  CONCERN_NAME_RE,
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

import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { findRepoRoot, resolveEnv } from "./paths.js";
import type { Logger, ProcessRunner, Prompter } from "./types.js";

/** A directory that passes findRepoRoot's repo-clone markers. */
function makeFakeClone(): string {
  const root = mkdtempSync(join(tmpdir(), "fieldnote-fake-clone-"));
  mkdirSync(join(root, "skills"), { recursive: true });
  mkdirSync(join(root, "cli"), { recursive: true });
  writeFileSync(join(root, "cli", "package.json"), "{}\n");
  writeFileSync(join(root, "catalog.json"), '{ "version": 1, "skills": [] }\n');
  return root;
}

const deps = {
  prompter: {} as Prompter,
  runner: {} as ProcessRunner,
  logger: {} as Logger,
};

test("findRepoRoot walks up to the clone root from a nested directory", () => {
  const clone = makeFakeClone();
  try {
    const nested = join(clone, "skills", "brand", "deep");
    mkdirSync(nested, { recursive: true });
    assert.equal(findRepoRoot(nested), clone);
  } finally {
    rmSync(clone, { recursive: true, force: true });
  }
});

test("findRepoRoot returns null outside a clone", () => {
  const plain = mkdtempSync(join(tmpdir(), "fieldnote-plain-"));
  try {
    assert.equal(findRepoRoot(plain), null);
  } finally {
    rmSync(plain, { recursive: true, force: true });
  }
});

test("cwd inside a clone still sets repoRoot for the authoring commands", () => {
  const clone = makeFakeClone();
  try {
    const env = resolveEnv({ ...deps, cwd: clone });
    assert.equal(env.repoRoot, clone);
  } finally {
    rmSync(clone, { recursive: true, force: true });
  }
});

test("the catalog follows the executing package, not the cwd clone", () => {
  // Standing inside some (possibly stale) clone must not hijack the catalog:
  // this test's own package runs from THIS repo, so the catalog resolves to
  // this repo's — never to the fake clone the cwd points into.
  const clone = makeFakeClone();
  try {
    const env = resolveEnv({ ...deps, cwd: clone });
    assert.notEqual(env.catalogPath, join(clone, "catalog.json"));
    assert.notEqual(env.skillsSourceDir, join(clone, "skills"));
  } finally {
    rmSync(clone, { recursive: true, force: true });
  }
});

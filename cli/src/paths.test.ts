import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { findGitRoot, findRepoRoot, resolveEnv } from "./paths.js";
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

test("findGitRoot walks up to a .git directory from a nested path, unlike findRepoRoot", () => {
  const repo = mkdtempSync(join(tmpdir(), "fieldnote-plain-git-"));
  try {
    mkdirSync(join(repo, ".git"), { recursive: true });
    const nested = join(repo, "src", "deep");
    mkdirSync(nested, { recursive: true });
    assert.equal(findGitRoot(nested), repo);
    // Not a fieldnote-skills clone (no skills/ + cli/package.json), so the
    // repo-specific detector correctly finds nothing here.
    assert.equal(findRepoRoot(nested), null);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("findGitRoot returns null with no .git anywhere above", () => {
  const plain = mkdtempSync(join(tmpdir(), "fieldnote-no-git-"));
  try {
    assert.equal(findGitRoot(plain), null);
  } finally {
    rmSync(plain, { recursive: true, force: true });
  }
});

/** Run `fn` with the fieldnote home overrides set to the given values. */
function withOverrides(vars: Record<string, string | undefined>, fn: () => void): void {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  try {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("both home overrides put both agents in the env's target list", () => {
  withOverrides(
    { FIELDNOTE_CLAUDE_DIR: "/tmp/env-claude", FIELDNOTE_CODEX_DIR: "/tmp/env-codex" },
    () => {
      const env = resolveEnv(deps);
      assert.deepEqual(env.agentHomes, [
        { agent: "claude", root: "/tmp/env-claude" },
        { agent: "codex", root: "/tmp/env-codex" },
      ]);
    },
  );
});

test("agentDir is the first target, so single-root callers keep working", () => {
  withOverrides({ FIELDNOTE_CLAUDE_DIR: "/tmp/env-claude", FIELDNOTE_CODEX_DIR: undefined }, () => {
    const env = resolveEnv(deps);
    assert.equal(env.agentDir, "/tmp/env-claude");
    assert.deepEqual(env.agentHomes, [{ agent: "claude", root: "/tmp/env-claude" }]);
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderProfile, runInit } from "./init.js";
import { parseProfile } from "../profile.js";
import { FakeLogger, FakePrompter } from "../testkit.js";
import type { Env } from "../types.js";

test("maps a check script onto Commands.check", () => {
  const md = renderProfile({
    scripts: { check: "turbo run lint test", build: "tsc" },
    labels: ["ready-for-agent", "bug"],
    docs: ["docs/definition-of-done.md"],
    strictStatusChecks: true,
    tracker: { kind: null, repo: null },
    hasPlansDir: false,
    git: { baseRemote: null, baseBranch: null },
  });
  const p = parseProfile(md);
  assert.equal(p.commands.check, "npm run check");
  assert.equal(p.labels.ready, "ready-for-agent");
  assert.equal(p.docs.definitionOfDone, "docs/definition-of-done.md");
  assert.equal(p.mergePolicy.strictStatusChecks, "true");
});

test("writes TODO for anything it could not read", () => {
  const md = renderProfile({
    scripts: {},
    labels: [],
    docs: [],
    strictStatusChecks: null,
    tracker: { kind: null, repo: null },
    hasPlansDir: false,
    git: { baseRemote: null, baseBranch: null },
  });
  const p = parseProfile(md);
  assert.equal(p.commands.check, "TODO");
  assert.equal(p.labels.ready, "TODO");
  assert.equal(p.mergePolicy.strictStatusChecks, "TODO");
  assert.equal(p.tracker.kind, "TODO");
  assert.equal(p.tracker.repo, "TODO");
  assert.equal(p.tracker.epicLink, "TODO");
  assert.equal(p.tracker.blockedBy, "TODO");
  assert.equal(p.docs.plans, "TODO");
  assert.equal(p.parallelism.waveSize, "TODO");
  assert.equal(p.localization.canonicalLocale, "TODO");
  assert.equal(p.localization.locales, "TODO");
  assert.equal(p.localization.catalogs, "TODO");
  assert.equal(p.git.baseRemote, "TODO");
  assert.equal(p.git.baseBranch, "TODO");
});

test("never invents a label that the repository does not have", () => {
  const md = renderProfile({
    scripts: {},
    labels: ["bug", "chore"],
    docs: [],
    strictStatusChecks: null,
    tracker: { kind: null, repo: null },
    hasPlansDir: false,
    git: { baseRemote: null, baseBranch: null },
  });
  assert.ok(!md.includes("ready-for-agent"));
});

test("maps an observed GitHub remote onto Tracker.kind and Tracker.repo", () => {
  const md = renderProfile({
    scripts: {},
    labels: [],
    docs: [],
    strictStatusChecks: null,
    tracker: { kind: "github", repo: "acme/widgets" },
    hasPlansDir: false,
    git: { baseRemote: null, baseBranch: null },
  });
  const p = parseProfile(md);
  assert.equal(p.tracker.kind, "github");
  assert.equal(p.tracker.repo, "acme/widgets");
  assert.equal(p.tracker.epicLink, "TODO");
  assert.equal(p.tracker.blockedBy, "TODO");
});

test("does not treat a bare test script as the quality gate", () => {
  const md = renderProfile({
    scripts: { test: "jest" },
    labels: [],
    docs: [],
    strictStatusChecks: null,
    tracker: { kind: null, repo: null },
    hasPlansDir: false,
    git: { baseRemote: null, baseBranch: null },
  });
  const p = parseProfile(md);
  assert.equal(p.commands.check, "TODO");
});

test("does not treat an epic label as needing a PRD", () => {
  const md = renderProfile({
    scripts: {},
    labels: ["epic"],
    docs: [],
    strictStatusChecks: null,
    tracker: { kind: null, repo: null },
    hasPlansDir: false,
    git: { baseRemote: null, baseBranch: null },
  });
  const p = parseProfile(md);
  assert.equal(p.labels.needsPrd, "TODO");
});

test("observes a plans/ directory when present", () => {
  const md = renderProfile({
    scripts: {},
    labels: [],
    docs: [],
    strictStatusChecks: null,
    tracker: { kind: null, repo: null },
    hasPlansDir: true,
    git: { baseRemote: null, baseBranch: null },
  });
  const p = parseProfile(md);
  assert.equal(p.docs.plans, "./plans/");
});

test("emits all six documented Docs keys, including verification and ciTriage", () => {
  const md = renderProfile({
    scripts: {},
    labels: [],
    docs: ["docs/verification.md", "docs/ci-triage.md"],
    strictStatusChecks: null,
    tracker: { kind: null, repo: null },
    hasPlansDir: false,
    git: { baseRemote: null, baseBranch: null },
  });
  const p = parseProfile(md);
  assert.equal(p.docs.verification, "docs/verification.md");
  assert.equal(p.docs.ciTriage, "docs/ci-triage.md");
});

test("maps observed git facts onto Git.baseRemote and Git.baseBranch", () => {
  const md = renderProfile({
    scripts: {},
    labels: [],
    docs: [],
    strictStatusChecks: null,
    tracker: { kind: null, repo: null },
    hasPlansDir: false,
    git: { baseRemote: "origin", baseBranch: "main" },
  });
  const p = parseProfile(md);
  assert.equal(p.git.baseRemote, "origin");
  assert.equal(p.git.baseBranch, "main");
});

test("never invents Localization facts — always TODO, since none is observable", () => {
  const md = renderProfile({
    scripts: {},
    labels: [],
    docs: [],
    strictStatusChecks: null,
    tracker: { kind: null, repo: null },
    hasPlansDir: false,
    git: { baseRemote: "origin", baseBranch: "main" },
  });
  const p = parseProfile(md);
  assert.equal(p.localization.canonicalLocale, "TODO");
  assert.equal(p.localization.locales, "TODO");
  assert.equal(p.localization.catalogs, "TODO");
});

function makeEnv(repoRoot: string | null): Env {
  return {
    claudeDir: "/unused",
    catalogPath: "/unused/catalog.json",
    skillsSourceDir: "/unused/skills",
    repoRoot,
    prompter: new FakePrompter(),
    logger: new FakeLogger(),
  };
}

test("runInit walks up to the git root from a nested cwd rather than writing under it", async () => {
  const repo = mkdtempSync(join(tmpdir(), "fieldnote-init-git-"));
  mkdirSync(join(repo, ".git"), { recursive: true });
  const nested = join(repo, "src", "deep");
  mkdirSync(nested, { recursive: true });
  const prevCwd = process.cwd();
  process.chdir(nested);
  try {
    await runInit(makeEnv(null));
    assert.equal(existsSync(join(repo, ".fieldnote", "profile.md")), true);
    assert.equal(existsSync(join(nested, ".fieldnote")), false);
  } finally {
    process.chdir(prevCwd);
    rmSync(repo, { recursive: true, force: true });
  }
});

test("runInit refuses with a clear message outside any git repository, rather than writing into cwd", async () => {
  const plain = mkdtempSync(join(tmpdir(), "fieldnote-init-plain-"));
  const prevCwd = process.cwd();
  process.chdir(plain);
  try {
    await assert.rejects(() => runInit(makeEnv(null)), /git repository/);
    assert.equal(existsSync(join(plain, ".fieldnote")), false);
  } finally {
    process.chdir(prevCwd);
    rmSync(plain, { recursive: true, force: true });
  }
});

test("--print writes the profile to stdout and creates nothing on disk", async () => {
  const repo = mkdtempSync(join(tmpdir(), "fieldnote-init-print-"));
  mkdirSync(join(repo, ".git"), { recursive: true });
  const prevCwd = process.cwd();
  process.chdir(repo);
  try {
    const logger = new FakeLogger();
    const env: Env = {
      claudeDir: "/unused",
      catalogPath: "/unused/catalog.json",
      skillsSourceDir: "/unused/skills",
      repoRoot: null,
      prompter: new FakePrompter(),
      logger,
    };

    const code = await runInit(env, { print: true });

    assert.equal(code, 0);
    assert.equal(existsSync(join(repo, ".fieldnote")), false, "no directory is created");
    assert.equal(logger.outputs.length, 1, "the profile goes to stdout exactly once");
    assert.match(logger.outputs[0]!, /^# fieldnote profile/);
    assert.equal(parseProfile(logger.outputs[0]!).tracker.epicLink, "TODO");
  } finally {
    process.chdir(prevCwd);
    rmSync(repo, { recursive: true, force: true });
  }
});

test("--print does not refuse when a profile already exists, and leaves it untouched", async () => {
  const repo = mkdtempSync(join(tmpdir(), "fieldnote-init-print-existing-"));
  mkdirSync(join(repo, ".git"), { recursive: true });
  mkdirSync(join(repo, ".fieldnote"), { recursive: true });
  const existing = join(repo, ".fieldnote", "profile.md");
  writeFileSync(existing, "# hand written, do not touch\n", "utf8");
  const prevCwd = process.cwd();
  process.chdir(repo);
  try {
    const logger = new FakeLogger();
    const env: Env = {
      claudeDir: "/unused",
      catalogPath: "/unused/catalog.json",
      skillsSourceDir: "/unused/skills",
      repoRoot: null,
      prompter: new FakePrompter(),
      logger,
    };

    const code = await runInit(env, { print: true });

    assert.equal(code, 0);
    assert.equal(readFileSync(existing, "utf8"), "# hand written, do not touch\n");
    assert.match(logger.outputs[0]!, /^# fieldnote profile/);
  } finally {
    process.chdir(prevCwd);
    rmSync(repo, { recursive: true, force: true });
  }
});

test("--print reports no TODO warning, because it is not scaffolding anything", async () => {
  const repo = mkdtempSync(join(tmpdir(), "fieldnote-init-print-quiet-"));
  mkdirSync(join(repo, ".git"), { recursive: true });
  const prevCwd = process.cwd();
  process.chdir(repo);
  try {
    const logger = new FakeLogger();
    const env: Env = {
      claudeDir: "/unused",
      catalogPath: "/unused/catalog.json",
      skillsSourceDir: "/unused/skills",
      repoRoot: null,
      prompter: new FakePrompter(),
      logger,
    };

    await runInit(env, { print: true });

    assert.deepEqual(logger.warns, [], "stdout stays the only channel");
    assert.deepEqual(logger.infos, []);
  } finally {
    process.chdir(prevCwd);
    rmSync(repo, { recursive: true, force: true });
  }
});

test("--print resolves Docs.definitionOfDone to .fieldnote/definition-of-done.md, preferring it over docs/definition-of-done.md", async () => {
  const repo = mkdtempSync(join(tmpdir(), "fieldnote-init-dod-"));
  mkdirSync(join(repo, ".git"), { recursive: true });
  mkdirSync(join(repo, ".fieldnote"), { recursive: true });
  writeFileSync(join(repo, ".fieldnote", "definition-of-done.md"), "# DoD\n", "utf8");
  mkdirSync(join(repo, "docs"), { recursive: true });
  writeFileSync(join(repo, "docs", "definition-of-done.md"), "# other DoD\n", "utf8");
  const prevCwd = process.cwd();
  process.chdir(repo);
  try {
    const logger = new FakeLogger();
    const env: Env = {
      claudeDir: "/unused",
      catalogPath: "/unused/catalog.json",
      skillsSourceDir: "/unused/skills",
      repoRoot: null,
      prompter: new FakePrompter(),
      logger,
    };

    await runInit(env, { print: true });

    const p = parseProfile(logger.outputs[0]!);
    assert.equal(p.docs.definitionOfDone, ".fieldnote/definition-of-done.md");
  } finally {
    process.chdir(prevCwd);
    rmSync(repo, { recursive: true, force: true });
  }
});

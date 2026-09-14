import { test } from "node:test";
import assert from "node:assert/strict";
import { renderProfile } from "./init.js";
import { parseProfile } from "../profile.js";

test("maps a check script onto Commands.check", () => {
  const md = renderProfile({
    scripts: { check: "turbo run lint test", build: "tsc" },
    labels: ["ready-for-agent", "bug"],
    docs: ["docs/definition-of-done.md"],
    strictStatusChecks: true,
    tracker: { kind: null, repo: null },
    hasPlansDir: false,
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
  });
  const p = parseProfile(md);
  assert.equal(p.commands.check, "TODO");
  assert.equal(p.labels.ready, "TODO");
  assert.equal(p.mergePolicy.strictStatusChecks, "TODO");
  assert.equal(p.tracker.kind, "TODO");
  assert.equal(p.tracker.repo, "TODO");
  assert.equal(p.docs.plans, "TODO");
  assert.equal(p.parallelism.waveSize, "TODO");
});

test("never invents a label that the repository does not have", () => {
  const md = renderProfile({
    scripts: {},
    labels: ["bug", "chore"],
    docs: [],
    strictStatusChecks: null,
    tracker: { kind: null, repo: null },
    hasPlansDir: false,
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
  });
  const p = parseProfile(md);
  assert.equal(p.tracker.kind, "github");
  assert.equal(p.tracker.repo, "acme/widgets");
});

test("does not treat a bare test script as the quality gate", () => {
  const md = renderProfile({
    scripts: { test: "jest" },
    labels: [],
    docs: [],
    strictStatusChecks: null,
    tracker: { kind: null, repo: null },
    hasPlansDir: false,
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
  });
  const p = parseProfile(md);
  assert.equal(p.docs.verification, "docs/verification.md");
  assert.equal(p.docs.ciTriage, "docs/ci-triage.md");
});

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { classifyInstalled, findOrphans, knownSkillNames, supersedesMap } from "./doctor-state.js";
import type { Lock } from "./lock.js";
import type { Manifest } from "./types.js";

const LOCK: Lock = {
  release: "skills-v1.0.0",
  skills: [
    { name: "fieldnote-matt-tdd", version: "1.0.0", coreHash: "sha256:aaa", files: {}, supersedes: ["tdd"] },
    { name: "fieldnote-validate-ticket", version: "2.4.2", coreHash: "sha256:bbb", files: {} },
  ],
};

const manifestOf = (skills: Manifest["skills"]): Manifest => ({ version: 1, skills });

test("an install matching release and hash is ok", () => {
  const rows = classifyInstalled({
    lock: LOCK,
    manifest: manifestOf({
      "fieldnote-matt-tdd": { version: "1.0.0", stage: "build", surface: "both", release: "skills-v1.0.0", coreHash: "sha256:aaa" },
    }),
    onDiskCoreHash: new Map([["fieldnote-matt-tdd", "sha256:aaa"]]),
    supersedes: new Map(),
  });
  assert.deepEqual(rows.map((r) => [r.name, r.state]), [["fieldnote-matt-tdd", "ok"]]);
});

test("an older recorded release is behind", () => {
  const rows = classifyInstalled({
    lock: LOCK,
    manifest: manifestOf({
      "fieldnote-matt-tdd": { version: "1.0.0", stage: "build", surface: "both", release: "skills-v0.9.0", coreHash: "sha256:aaa" },
    }),
    onDiskCoreHash: new Map([["fieldnote-matt-tdd", "sha256:aaa"]]),
    supersedes: new Map(),
  });
  assert.equal(rows[0]!.state, "behind");
});

test("a changed on-disk hash is modified, and beats behind", () => {
  const rows = classifyInstalled({
    lock: LOCK,
    manifest: manifestOf({
      "fieldnote-matt-tdd": { version: "1.0.0", stage: "build", surface: "both", release: "skills-v0.9.0", coreHash: "sha256:aaa" },
    }),
    onDiskCoreHash: new Map([["fieldnote-matt-tdd", "sha256:zzz"]]),
    supersedes: new Map(),
  });
  assert.equal(rows[0]!.state, "modified");
});

test("an install absent from the lock is orphaned, and names its replacement", () => {
  const rows = classifyInstalled({
    lock: LOCK,
    manifest: manifestOf({
      tdd: { version: "0.0.0", stage: "build", surface: "code" },
    }),
    onDiskCoreHash: new Map([["tdd", "sha256:old"]]),
    supersedes: new Map([["tdd", "fieldnote-matt-tdd"]]),
  });
  assert.equal(rows[0]!.state, "orphaned");
  assert.equal(rows[0]!.supersededBy, "fieldnote-matt-tdd");
});

test("a pre-release install with no recorded release counts as behind, not modified", () => {
  const rows = classifyInstalled({
    lock: LOCK,
    manifest: manifestOf({
      "fieldnote-validate-ticket": { version: "2.4.2", stage: "build", surface: "code" },
    }),
    onDiskCoreHash: new Map([["fieldnote-validate-ticket", "sha256:bbb"]]),
    supersedes: new Map(),
  });
  assert.equal(rows[0]!.state, "behind");
});

test("rows come back sorted by name", () => {
  const rows = classifyInstalled({
    lock: LOCK,
    manifest: manifestOf({
      "fieldnote-validate-ticket": { version: "2.4.2", stage: "build", surface: "code", release: "skills-v1.0.0", coreHash: "sha256:bbb" },
      "fieldnote-matt-tdd": { version: "1.0.0", stage: "build", surface: "both", release: "skills-v1.0.0", coreHash: "sha256:aaa" },
    }),
    onDiskCoreHash: new Map([["fieldnote-matt-tdd", "sha256:aaa"], ["fieldnote-validate-ticket", "sha256:bbb"]]),
    supersedes: new Map(),
  });
  assert.deepEqual(rows.map((r) => r.name), ["fieldnote-matt-tdd", "fieldnote-validate-ticket"]);
});

test("an unmanaged directory absent from both manifest and lock is orphaned with no known version or release", () => {
  const rows = classifyInstalled({
    lock: LOCK,
    manifest: manifestOf({}),
    onDiskCoreHash: new Map([["tdd", "sha256:old"]]),
    supersedes: new Map([["tdd", "fieldnote-matt-tdd"]]),
    onDiskNames: ["tdd"],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.state, "orphaned");
  assert.equal(rows[0]!.installedVersion, null);
  assert.equal(rows[0]!.installedRelease, null);
  assert.equal(rows[0]!.supersededBy, "fieldnote-matt-tdd");
});

test("an unmanaged directory with no known replacement is still orphaned, with supersededBy undefined", () => {
  const rows = classifyInstalled({
    lock: LOCK,
    manifest: manifestOf({}),
    onDiskCoreHash: new Map([["teach", "sha256:old"]]),
    supersedes: new Map([["tdd", "fieldnote-matt-tdd"]]),
    onDiskNames: ["teach"],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.state, "orphaned");
  assert.equal(rows[0]!.supersededBy, undefined);
});

test("a directory that IS in the manifest does not also produce an unmanaged row", () => {
  const rows = classifyInstalled({
    lock: LOCK,
    manifest: manifestOf({
      tdd: { version: "0.0.0", stage: "build", surface: "code" },
    }),
    onDiskCoreHash: new Map([["tdd", "sha256:old"]]),
    supersedes: new Map([["tdd", "fieldnote-matt-tdd"]]),
    onDiskNames: ["tdd"],
  });
  assert.equal(rows.filter((r) => r.name === "tdd").length, 1);
  assert.equal(rows[0]!.state, "orphaned");
  assert.equal(rows[0]!.installedVersion, "0.0.0");
});

test("supersedesMap inverts each skill's supersedes list", () => {
  const map = supersedesMap({
    release: "skills-v1.0.0",
    skills: [{ name: "fieldnote-matt-tdd", version: "1.0.0", coreHash: "x", files: {}, supersedes: ["tdd", "diagnose"] }],
  });
  assert.equal(map.get("tdd"), "fieldnote-matt-tdd");
  assert.equal(map.get("diagnose"), "fieldnote-matt-tdd");
});

// --- I1: the release label bound to content ------------------------------
//
// A release promises one number to quote and hashes to prove it. A copy whose
// recorded release matches but whose bytes do not match the locked coreHash
// is exactly the case the hash exists to catch: two engineers holding
// different bytes, both stamped skills-v1.0.0. It must not report ok.

test("a matching release with a coreHash that differs from the lock is drift, not ok", () => {
  const rows = classifyInstalled({
    lock: LOCK,
    manifest: manifestOf({
      "fieldnote-matt-tdd": { version: "1.0.0", stage: "build", surface: "both", release: "skills-v1.0.0", coreHash: "sha256:other" },
    }),
    onDiskCoreHash: new Map([["fieldnote-matt-tdd", "sha256:other"]]),
    supersedes: new Map(),
  });
  assert.equal(rows[0]!.state, "divergent");
});

test("divergence is judged on the bytes on disk, not only on what was recorded", () => {
  // Recorded hash agrees with the lock, but nothing on disk does: the install
  // record is stale relative to reality, so the label still cannot be trusted.
  const rows = classifyInstalled({
    lock: LOCK,
    manifest: manifestOf({
      "fieldnote-matt-tdd": { version: "1.0.0", stage: "build", surface: "both", release: "skills-v1.0.0" },
    }),
    onDiskCoreHash: new Map([["fieldnote-matt-tdd", "sha256:other"]]),
    supersedes: new Map(),
  });
  assert.equal(rows[0]!.state, "divergent");
});

test("modified still outranks divergent, so an edit is never mistaken for a bad build", () => {
  const rows = classifyInstalled({
    lock: LOCK,
    manifest: manifestOf({
      "fieldnote-matt-tdd": { version: "1.0.0", stage: "build", surface: "both", release: "skills-v1.0.0", coreHash: "sha256:aaa" },
    }),
    onDiskCoreHash: new Map([["fieldnote-matt-tdd", "sha256:edited"]]),
    supersedes: new Map(),
  });
  assert.equal(rows[0]!.state, "modified");
});

// --- I5: an unreadable tree is its own answer ----------------------------

test("a skill whose tree could not be read is unreadable, not modified", () => {
  const rows = classifyInstalled({
    lock: LOCK,
    manifest: manifestOf({
      "fieldnote-matt-tdd": { version: "1.0.0", stage: "build", surface: "both", release: "skills-v1.0.0", coreHash: "sha256:aaa" },
    }),
    onDiskCoreHash: new Map(),
    unreadable: new Map([["fieldnote-matt-tdd", ["references/gone.md"]]]),
    supersedes: new Map(),
  });
  assert.equal(rows[0]!.state, "unreadable");
  assert.match(rows[0]!.detail!, /references\/gone\.md/);
});

// --- I2: one orphan definition, and a narrow removal set -----------------

test("findOrphans reports manifest-tracked and unmanaged directories alike", () => {
  const orphans = findOrphans({
    manifest: manifestOf({
      "fieldnote-do-work": { version: "2.1.0", stage: "build", surface: "code" },
    }),
    known: new Set(["fieldnote-matt-tdd"]),
    supersedes: new Map([["tdd", "fieldnote-matt-tdd"]]),
    onDiskNames: ["fieldnote-matt-tdd", "tdd", "my-own-experiment"],
  });
  assert.deepEqual(
    orphans.map((o) => [o.name, o.removable]),
    [["fieldnote-do-work", true], ["my-own-experiment", false], ["tdd", true]],
  );
});

test("only a manifest-tracked or superseded orphan is removable", () => {
  const orphans = findOrphans({
    manifest: manifestOf({}),
    known: new Set(["fieldnote-matt-tdd"]),
    supersedes: new Map([["tdd", "fieldnote-matt-tdd"]]),
    onDiskNames: ["tdd", "some-other-persons-skill"],
  });
  const removable = orphans.filter((o) => o.removable).map((o) => o.name);
  assert.deepEqual(removable, ["tdd"], "an unclaimed unmanaged directory must never be offered for removal");
  assert.equal(orphans.find((o) => o.name === "some-other-persons-skill")!.removable, false);
});

test("knownSkillNames unions the lock with the catalog", () => {
  const known = knownSkillNames(LOCK, ["fieldnote-brand-new"]);
  assert.ok(known.has("fieldnote-matt-tdd"));
  assert.ok(known.has("fieldnote-brand-new"));
  assert.equal(known.has("tdd"), false);
});

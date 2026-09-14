import { test } from "node:test";
import assert from "node:assert/strict";
import { readManifest, recordInstalled, forgetInstalled, manifestPath } from "./manifest.js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { makeHarness, toEntry } from "./testkit.js";

test("an absent manifest reads back as empty", async () => {
  const h = await makeHarness([]);
  try {
    const manifest = await readManifest(h.env);
    assert.deepEqual(manifest.skills, {});
  } finally {
    await h.cleanup();
  }
});

test("recording a skill persists its name, version, stage and surface", async () => {
  const h = await makeHarness([]);
  try {
    await recordInstalled(h.env, toEntry({ name: "fieldnote-do-work", stage: "build" }));
    const manifest = await readManifest(h.env);
    assert.deepEqual(manifest.skills["fieldnote-do-work"], {
      version: "1.0.0",
      stage: "build",
      surface: "code",
    });
  } finally {
    await h.cleanup();
  }
});

test("the manifest survives multiple installs and version bumps", async () => {
  const h = await makeHarness([]);
  try {
    await recordInstalled(h.env, toEntry({ name: "fieldnote-a", stage: "build", version: "1.0.0" }));
    await recordInstalled(h.env, toEntry({ name: "fieldnote-b", stage: "build", version: "2.1.0" }));
    await recordInstalled(h.env, toEntry({ name: "fieldnote-a", stage: "build", version: "1.2.0" }));

    const manifest = await readManifest(h.env);
    assert.equal(manifest.skills["fieldnote-a"]?.version, "1.2.0");
    assert.equal(manifest.skills["fieldnote-b"]?.version, "2.1.0");
  } finally {
    await h.cleanup();
  }
});

test("forgetting a skill removes it from the manifest", async () => {
  const h = await makeHarness([]);
  try {
    await recordInstalled(h.env, toEntry({ name: "fieldnote-a", stage: "build" }));
    await forgetInstalled(h.env, "fieldnote-a");
    const manifest = await readManifest(h.env);
    assert.equal(manifest.skills["fieldnote-a"], undefined);
  } finally {
    await h.cleanup();
  }
});

test("a corrupt manifest does not crash reads (starts fresh)", async () => {
  const h = await makeHarness([]);
  try {
    await recordInstalled(h.env, toEntry({ name: "fieldnote-a", stage: "build" }));
    await writeFile(manifestPath(h.env), "{ not json", "utf8");
    const manifest = await readManifest(h.env);
    assert.deepEqual(manifest.skills, {});
  } finally {
    await h.cleanup();
  }
});

test("a manifest written by an older CLI (no release/coreHash) reads back cleanly", async () => {
  const h = await makeHarness([]);
  try {
    const path = manifestPath(h.env);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        skills: {
          "fieldnote-old-skill": { version: "1.0.0", stage: "build", surface: "code" },
        },
      }),
      "utf8",
    );

    const manifest = await readManifest(h.env);
    assert.deepEqual(manifest.skills["fieldnote-old-skill"], {
      version: "1.0.0",
      stage: "build",
      surface: "code",
    });
    assert.equal(manifest.skills["fieldnote-old-skill"]?.release, undefined);
    assert.equal(manifest.skills["fieldnote-old-skill"]?.coreHash, undefined);
  } finally {
    await h.cleanup();
  }
});

test("records the release and core hash alongside the version", async () => {
  const h = await makeHarness([{ name: "fieldnote-do-thing", stage: "build" }]);
  try {
    await recordInstalled(h.env, toEntry({ name: "fieldnote-do-thing", stage: "build" }), {
      release: "skills-v1.0.0",
      coreHash: "sha256:abc",
    });
    const manifest = await readManifest(h.env);
    assert.equal(manifest.skills["fieldnote-do-thing"]!.release, "skills-v1.0.0");
    assert.equal(manifest.skills["fieldnote-do-thing"]!.coreHash, "sha256:abc");
  } finally {
    await h.cleanup();
  }
});

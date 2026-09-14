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

test("recording a skill persists its name, version, section and surface", async () => {
  const h = await makeHarness([]);
  try {
    await recordInstalled(h.env, toEntry({ name: "vertuo-do-work", section: "engineering-standards" }));
    const manifest = await readManifest(h.env);
    assert.deepEqual(manifest.skills["vertuo-do-work"], {
      version: "1.0.0",
      section: "engineering-standards",
      surface: "code",
    });
  } finally {
    await h.cleanup();
  }
});

test("the manifest survives multiple installs and version bumps", async () => {
  const h = await makeHarness([]);
  try {
    await recordInstalled(h.env, toEntry({ name: "vertuo-a", section: "engineering-standards", version: "1.0.0" }));
    await recordInstalled(h.env, toEntry({ name: "vertuo-b", section: "engineering-standards", version: "2.1.0" }));
    await recordInstalled(h.env, toEntry({ name: "vertuo-a", section: "engineering-standards", version: "1.2.0" }));

    const manifest = await readManifest(h.env);
    assert.equal(manifest.skills["vertuo-a"]?.version, "1.2.0");
    assert.equal(manifest.skills["vertuo-b"]?.version, "2.1.0");
  } finally {
    await h.cleanup();
  }
});

test("forgetting a skill removes it from the manifest", async () => {
  const h = await makeHarness([]);
  try {
    await recordInstalled(h.env, toEntry({ name: "vertuo-a", section: "engineering-standards" }));
    await forgetInstalled(h.env, "vertuo-a");
    const manifest = await readManifest(h.env);
    assert.equal(manifest.skills["vertuo-a"], undefined);
  } finally {
    await h.cleanup();
  }
});

test("a corrupt manifest does not crash reads (starts fresh)", async () => {
  const h = await makeHarness([]);
  try {
    await recordInstalled(h.env, toEntry({ name: "vertuo-a", section: "engineering-standards" }));
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
          "vertuo-old-skill": { version: "1.0.0", section: "engineering-standards", surface: "code" },
        },
      }),
      "utf8",
    );

    const manifest = await readManifest(h.env);
    assert.deepEqual(manifest.skills["vertuo-old-skill"], {
      version: "1.0.0",
      section: "engineering-standards",
      surface: "code",
    });
    assert.equal(manifest.skills["vertuo-old-skill"]?.release, undefined);
    assert.equal(manifest.skills["vertuo-old-skill"]?.coreHash, undefined);
  } finally {
    await h.cleanup();
  }
});

test("records the release and core hash alongside the version", async () => {
  const h = await makeHarness([{ name: "vertuo-do-thing", section: "engineering-standards" }]);
  try {
    await recordInstalled(h.env, toEntry({ name: "vertuo-do-thing", section: "engineering-standards" }), {
      release: "skills-v1.0.0",
      coreHash: "sha256:abc",
    });
    const manifest = await readManifest(h.env);
    assert.equal(manifest.skills["vertuo-do-thing"]!.release, "skills-v1.0.0");
    assert.equal(manifest.skills["vertuo-do-thing"]!.coreHash, "sha256:abc");
  } finally {
    await h.cleanup();
  }
});

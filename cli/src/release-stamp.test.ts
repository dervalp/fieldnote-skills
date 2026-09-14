import { strict as assert } from "node:assert";
import { test } from "node:test";
import { releaseTagFor, stampRelease } from "./release-stamp.js";

test("turns a bare semver into a release tag", () => {
  assert.equal(releaseTagFor("1.0.0"), "skills-v1.0.0");
  assert.throws(() => releaseTagFor("v1.0.0"), /bare semver/);
  assert.throws(() => releaseTagFor("1.0"), /bare semver/);
});

test("inserts release: after version: when absent", () => {
  const md = "---\nname: x\nversion: 1.0.0\nsection: brand\n---\n\n# X\n";
  assert.equal(
    stampRelease(md, "skills-v1.0.0"),
    "---\nname: x\nversion: 1.0.0\nrelease: skills-v1.0.0\nsection: brand\n---\n\n# X\n",
  );
});

test("replaces an existing release: in place", () => {
  const md = "---\nname: x\nversion: 1.0.0\nrelease: skills-v0.9.0\n---\n\n# X\n";
  assert.ok(stampRelease(md, "skills-v1.0.0").includes("release: skills-v1.0.0"));
  assert.ok(!stampRelease(md, "skills-v1.0.0").includes("v0.9.0"));
});

test("never touches the body", () => {
  const md = "---\nname: x\nversion: 1.0.0\n---\n\nrelease: not frontmatter\n";
  assert.ok(stampRelease(md, "skills-v1.0.0").endsWith("\nrelease: not frontmatter\n"));
});

test("a file with no frontmatter is returned unchanged", () => {
  assert.equal(stampRelease("# no fm\n", "skills-v1.0.0"), "# no fm\n");
});

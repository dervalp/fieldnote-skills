import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DOD_SECTIONS,
  DOD_CONVENTION_PATH,
  DOD_FILENAME,
  findDodSections,
  missingDodSections,
} from "./dod.js";

const repoRoot = join(import.meta.dirname, "..", "..");

test("the convention names five sections in the order work passes through them", () => {
  assert.deepEqual(
    [...DOD_SECTIONS],
    ["Always", "PRD", "Do work", "Pull request", "Deployment"],
  );
});

test("the convention path sits next to the profile", () => {
  assert.equal(DOD_CONVENTION_PATH, ".fieldnote/definition-of-done.md");
  assert.equal(DOD_FILENAME, "definition-of-done.md");
});

test("findDodSections returns known headings in document order", () => {
  const md = "# Definition of done\n\n## PRD\n\n- a\n\n## Deployment\n\n- b\n";
  assert.deepEqual(findDodSections(md), ["PRD", "Deployment"]);
});

test("findDodSections ignores headings that are not part of the convention", () => {
  const md = "## Always\n\n## Release notes\n\n## PRD\n";
  assert.deepEqual(findDodSections(md), ["Always", "PRD"]);
});

test("findDodSections ignores a heading that is not exactly two hashes plus a space", () => {
  const md = "### PRD\n##PRD\n# PRD\n## Always\n";
  assert.deepEqual(findDodSections(md), ["Always"]);
});

test("missingDodSections names what a document still needs, in convention order", () => {
  const md = "## Deployment\n\n## PRD\n";
  assert.deepEqual(missingDodSections(md), ["Always", "Do work", "Pull request"]);
});

test("a complete document is missing nothing", () => {
  const md = DOD_SECTIONS.map((s) => `## ${s}\n`).join("\n");
  assert.deepEqual(missingDodSections(md), []);
});

test("the shipped template carries every section of the convention", () => {
  const md = readFileSync(join(repoRoot, "templates", "definition-of-done.md"), "utf8");
  assert.deepEqual(missingDodSections(md), []);
});

test("the convention document shows every section, so the doc cannot drift from the code", () => {
  const md = readFileSync(join(repoRoot, "docs", "definition-of-done.md"), "utf8");
  for (const section of DOD_SECTIONS) {
    assert.ok(md.includes(`## ${section}`), `docs/definition-of-done.md must show "## ${section}"`);
  }
});

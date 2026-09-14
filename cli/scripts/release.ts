#!/usr/bin/env node
/**
 * Prepare a catalog release: stamp `release:` into every SKILL.md and bump
 * release.json. Run from the repo root: npm run release 1.0.0
 *
 * This only prepares the commit. Regenerate the catalog, open the PR, and tag
 * the merge commit — see docs/RELEASING.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { releaseTagFor, stampRelease } from "../src/release-stamp.js";
import { discover } from "../src/skill-model.js";

const version = process.argv[2];
if (version === undefined) {
  console.error("Usage: npm run release <version>   e.g. npm run release 1.0.0");
  process.exit(1);
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const release = releaseTagFor(version);

for (const skill of discover(join(repoRoot, "skills"))) {
  const before = readFileSync(skill.path, "utf8");
  const after = stampRelease(before, release);
  if (after !== before) {
    writeFileSync(skill.path, after, "utf8");
    console.log(`  stamped ${skill.folderName}`);
  }
}

writeFileSync(join(repoRoot, "release.json"), `${JSON.stringify({ release }, null, 2)}\n`, "utf8");
console.log(`✅ prepared ${release}. Next: npm run catalog && npm run validate, then see docs/RELEASING.md.`);

#!/usr/bin/env node
/**
 * Validate every skill in skills/ against this repository's frontmatter
 * conventions — required fields, the name pattern, semver, and the closed
 * sets for stage/variance/surface.
 * Runs in CI on every PR; exits non-zero (failing the PR) on any violation.
 * Run from the repo root: npm run validate
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readRelease } from "../src/lock.js";
import { discover } from "../src/skill-model.js";
import { collectErrors } from "../src/skill-validate.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const skillsDir = join(repoRoot, "skills");

if (!existsSync(skillsDir)) {
  console.error(`No skills/ directory at ${skillsDir}`);
  process.exit(1);
}

const errors = collectErrors(skillsDir, readRelease(repoRoot));
if (errors.length > 0) {
  console.error(`❌ ${errors.length} validation error(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✅ ${discover(skillsDir).length} skill(s) valid.`);

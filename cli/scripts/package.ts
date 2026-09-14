#!/usr/bin/env node
/**
 * Build one installable .zip per packageable skill into dist/. Each .zip
 * contains the skill folder so it drops straight into Claude Desktop ->
 * Settings -> Capabilities -> Skills. Only `surface: desktop|both` skills are
 * packaged — a `code`-only skill can't be loaded there. Filenames are
 * `<name>-<release>.zip` and replaced in place on every build. Run from the
 * repo root: npm run package
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readRelease } from "../src/lock.js";
import { discover } from "../src/skill-model.js";
import { zipSkillDir } from "../src/skill-package.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const distDir = join(repoRoot, "dist");

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

const release = readRelease(repoRoot);
// Only desktop|both skills can be loaded in Claude Desktop / claude.ai. A
// `code` skill in that folder would be a zip nobody can use.
const packageable = discover(join(repoRoot, "skills")).filter(
  (skill) => skill.surface === "desktop" || skill.surface === "both",
);
for (const skill of packageable) {
  const skillDir = dirname(skill.path);
  const name = basename(skillDir);
  writeFileSync(join(distDir, `${name}-${release}.zip`), zipSkillDir(skillDir));
  console.log(`  packaged ${name} -> dist/${name}-${release}.zip`);
}
console.log(`✅ built ${packageable.length} skill .zip(s) for ${release} into dist/`);

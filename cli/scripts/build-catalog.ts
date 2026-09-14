#!/usr/bin/env node
/**
 * Regenerate CATALOG.md and catalog.json from every SKILL.md's frontmatter.
 * Run from the repo root: npm run catalog
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderCatalogJson, renderMarkdown } from "../src/catalog-build.js";
import { buildLock, readRelease, renderLock } from "../src/lock.js";
import { discover } from "../src/skill-model.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const skills = discover(join(repoRoot, "skills"));

writeFileSync(join(repoRoot, "CATALOG.md"), renderMarkdown(skills), "utf8");
writeFileSync(join(repoRoot, "catalog.json"), renderCatalogJson(skills), "utf8");

const release = readRelease(repoRoot);
writeFileSync(join(repoRoot, "skills.lock.json"), renderLock(buildLock(skills, release)), "utf8");
console.log(`✅ wrote CATALOG.md, catalog.json and skills.lock.json (${skills.length} skills, ${release}).`);

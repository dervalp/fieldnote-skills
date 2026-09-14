#!/usr/bin/env node
/** Fail the build when a published skill names a coordinate only one repo has. */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { findCouplingViolations } from "../src/decoupling.js";

const repoRoot = join(import.meta.dirname, "..", "..");
const root = join(repoRoot, "skills");

const violations: string[] = [];
for (const entry of readdirSync(root)) {
  const dir = join(root, entry);
  if (!statSync(dir).isDirectory()) continue;
  const file = join(dir, "SKILL.md");
  violations.push(...findCouplingViolations(entry, readFileSync(file, "utf8")));
}

// Also check tracked docs and the skill template — everything actually
// published — via `git ls-files` so an untracked/gitignored working file
// (e.g. the local migration record under docs/superpowers/) is never scanned.
const trackedDocsAndTemplates = execFileSync(
  "git",
  ["ls-files", "docs/*.md", "docs/**/*.md", "templates/**"],
  { cwd: repoRoot, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
for (const rel of trackedDocsAndTemplates) {
  violations.push(...findCouplingViolations(rel, readFileSync(join(repoRoot, rel), "utf8")));
}

if (violations.length > 0) {
  console.error("Coupling violations — these skills would not work in another repository:\n");
  for (const v of violations) console.error(`  ${v}`);
  console.error(`\n${violations.length} violation(s). See each line above for what to do about it.`);
  process.exit(1);
}

console.log(
  `No coupling violations across ${readdirSync(root).length} skill(s), ` +
    `${trackedDocsAndTemplates.length} doc/template file(s).`,
);

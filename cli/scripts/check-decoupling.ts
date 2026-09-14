#!/usr/bin/env node
/** Fail the build when a published skill names a coordinate only one repo has. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { findCouplingViolations } from "../src/decoupling.js";

const root = join(import.meta.dirname, "..", "..", "skills");

const violations: string[] = [];
for (const entry of readdirSync(root)) {
  const dir = join(root, entry);
  if (!statSync(dir).isDirectory()) continue;
  const file = join(dir, "SKILL.md");
  violations.push(...findCouplingViolations(entry, readFileSync(file, "utf8")));
}

if (violations.length > 0) {
  console.error("Coupling violations — these skills would not work in another repository:\n");
  for (const v of violations) console.error(`  ${v}`);
  console.error(`\n${violations.length} violation(s). Cite .fieldnote/profile.md instead.`);
  process.exit(1);
}

console.log(`No coupling violations across ${readdirSync(root).length} skill(s).`);

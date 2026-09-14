/**
 * Zip one skill folder for Claude Desktop upload. Repo-side tooling — not part
 * of the CLI runtime (fflate is a devDependency; nothing in commands/ imports this).
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { zipSync } from "fflate";
import { shipsInSkill } from "./skill-model.js";

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

/** Zip a skill folder: entries rooted at the folder name, .gitkeep and dev-only dirs (tests/) excluded. */
export function zipSkillDir(skillDir: string): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const file of walkFiles(skillDir)) {
    if (basename(file) === ".gitkeep") continue;
    if (!shipsInSkill(relative(skillDir, file))) continue;
    const arcname = relative(dirname(skillDir), file).split(sep).join("/");
    files[arcname] = readFileSync(file);
  }
  return zipSync(files);
}

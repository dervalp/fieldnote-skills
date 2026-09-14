import { readFile } from "node:fs/promises";
import type { Catalog, Env, SkillEntry } from "./types.js";
import { UserError } from "./types.js";

/** Load and lightly validate catalog.json. */
export async function loadCatalog(env: Env): Promise<Catalog> {
  let raw: string;
  try {
    raw = await readFile(env.catalogPath, "utf8");
  } catch {
    throw new UserError(
      `Could not read catalog at ${env.catalogPath}. ` +
        `Run npm run catalog (in a repo clone) or reinstall the package.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new UserError(`Catalog at ${env.catalogPath} is not valid JSON.`);
  }

  const catalog = parsed as Catalog;
  if (!catalog || !Array.isArray(catalog.skills)) {
    throw new UserError(`Catalog at ${env.catalogPath} is missing a "skills" array.`);
  }
  return catalog;
}

/** Skills the CLI can install into ~/.claude (Desktop-only skills are excluded). */
export function installableSkills(catalog: Catalog): SkillEntry[] {
  return catalog.skills.filter((s) => s.surface === "code" || s.surface === "both");
}

/** Find one installable skill by name, or throw a clear error. */
export function requireSkill(catalog: Catalog, name: string): SkillEntry {
  const match = installableSkills(catalog).find((s) => s.name === name);
  if (!match) {
    throw new UserError(
      `No installable skill named "${name}". ` +
        `Run \`vertuoza-skills list\` to see what is available.`,
    );
  }
  return match;
}

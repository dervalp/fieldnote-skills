#!/usr/bin/env node
/**
 * Bundle installable skill content into the package so `npx fieldnote-skills`
 * works outside a repo clone.
 *
 * Copies catalog.json and every code|both skill folder (with all subfolders —
 * commands/agents/hooks/references/scripts/assets, minus dev-only dirs like
 * tests/, see NON_SHIPPED_SKILL_DIRS) from the repo into cli/skills/ and
 * cli/catalog.json, plus release.json and skills.lock.json (ADR-0010) so a
 * bundled install can record a real release + coreHash, not "unreleased".
 * These bundled copies are gitignored and regenerated at publish time;
 * paths.ts falls back to them when no repo clone is detected.
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { shipsInSkill } from "../src/skill-model.js";
import type { Catalog } from "../src/types.js";

const cliDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(cliDir, "..");

async function main(): Promise<void> {
  const catalogPath = join(repoRoot, "catalog.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8")) as Catalog;

  const outSkills = join(cliDir, "skills");
  await rm(outSkills, { recursive: true, force: true });
  await mkdir(outSkills, { recursive: true });

  const installable = catalog.skills.filter((s) => s.surface === "code" || s.surface === "both");
  for (const entry of installable) {
    const from = join(repoRoot, "skills", entry.name);
    const to = join(outSkills, entry.name);
    await mkdir(dirname(to), { recursive: true });
    await cp(from, to, {
      recursive: true,
      filter: (src) => shipsInSkill(relative(from, src)),
    });
    console.log(`  bundled ${entry.name}`);
  }

  await writeFile(join(cliDir, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n", "utf8");

  for (const file of ["release.json", "skills.lock.json"]) {
    await cp(join(repoRoot, file), join(cliDir, file));
  }
  console.log("  bundled release.json + skills.lock.json");

  console.log(`✅ bundled ${installable.length} installable skill(s) + catalog.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

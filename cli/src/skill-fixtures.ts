/** Fixture builders for the skill tooling tests — mirrors the former tests/test_slice1.py helpers. */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const GOOD_DESC =
  "Use when the user wants to do a clearly described thing with several real " +
  "synonyms so that this trigger comfortably clears fifteen words.";

/** Create an empty temp skills/ root. Tests clean up by removing its parent dir. */
export function makeSkillsDir(): string {
  const root = mkdtempSync(join(tmpdir(), "vz-tooling-"));
  const skillsDir = join(root, "skills");
  mkdirSync(skillsDir, { recursive: true });
  return skillsDir;
}

export function baseFm(
  name: string,
  overrides: Record<string, string> = {},
): Record<string, string> {
  return { name, description: GOOD_DESC, version: "1.0.0", stage: "build", variance: "universal", ...overrides };
}

/** Materialize a fixture skill folder; returns the SKILL.md path. */
export function writeSkill(
  skillsDir: string,
  name: string,
  frontmatter: Record<string, string>,
  subdirs: string[] = [],
): string {
  const folder = join(skillsDir, name);
  mkdirSync(folder, { recursive: true });
  const lines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) lines.push(`${key}: ${value}`);
  lines.push("---", "", `# ${name}`, "");
  writeFileSync(join(folder, "SKILL.md"), lines.join("\n"), "utf8");
  for (const sub of subdirs) {
    mkdirSync(join(folder, sub), { recursive: true });
    writeFileSync(join(folder, sub, ".gitkeep"), "", "utf8");
  }
  return join(folder, "SKILL.md");
}

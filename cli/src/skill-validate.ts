/**
 * Validate every skill in skills/ against the Vertuo AI Playbook conventions.
 * Behavioral port of the former scripts/validate.py — error strings preserved.
 */
import { dirname, relative } from "node:path";
import {
  CODE_SUBDIRS,
  MIN_DESCRIPTION_WORDS,
  NAME_RE,
  SEMVER_RE,
  VALID_ARTIFACTS,
  VALID_CATEGORIES,
  VALID_SECTIONS,
  VALID_SURFACES,
  Skill,
  discover,
  frontmatterLineErrors,
} from "./skill-model.js";
import { isVendoredName, missingVendorFields, REQUIRED_VENDOR_FIELDS, vendorPrefixList } from "./vendor-model.js";

const sortedJoin = (values: readonly string[]): string => [...values].sort().join(", ");

export function validateSkill(
  skill: Skill,
  skillsRoot: string,
  errors: string[],
  expectedRelease = "unreleased",
): void {
  const rel = relative(dirname(skillsRoot), skill.path);
  const fm = skill.frontmatter;
  const err = (msg: string): void => {
    errors.push(`${rel}: ${msg}`);
  };

  if (!(VALID_SECTIONS as readonly string[]).includes(skill.section)) {
    err(`unknown section '${skill.section}' (allowed: ${sortedJoin(VALID_SECTIONS)})`);
  }

  if (!NAME_RE.test(skill.folderName)) {
    err(`folder name '${skill.folderName}' must match vertuo-<verb>-<noun> (kebab-case)`);
  }

  if (Object.keys(fm).length === 0) {
    err("missing or malformed YAML frontmatter");
    return;
  }

  for (const field of ["name", "description", "version", "section"]) {
    const value = fm[field];
    if (value === undefined || value.length === 0) {
      err(`frontmatter missing required field '${field}'`);
    }
  }

  if (skill.name !== "" && skill.name !== skill.folderName) {
    err(`frontmatter name '${skill.name}' must equal folder name '${skill.folderName}'`);
  }

  const fmSection = fm["section"];
  if (fmSection !== undefined && fmSection.length !== 0 && fmSection !== skill.section) {
    err(`frontmatter section '${fmSection}' must equal parent folder '${skill.section}'`);
  }

  const desc = skill.description;
  if (desc !== "") {
    const words = desc.split(/\s+/).filter(Boolean).length;
    if (words < MIN_DESCRIPTION_WORDS) {
      err(
        `description has ${words} words; needs >= ${MIN_DESCRIPTION_WORDS}. ` +
          "The description is the trigger — write it for someone who doesn't know the skill exists.",
      );
    }
    if (!desc.toLowerCase().includes("use when")) {
      err("description must contain a 'use when ...' trigger clause");
    }
  }

  if (skill.version !== "" && !SEMVER_RE.test(skill.version)) {
    err(`version '${skill.version}' is not valid semver (expected X.Y.Z)`);
  }

  for (const lineError of frontmatterLineErrors(skill.rawFrontmatter)) {
    err(`frontmatter ${lineError}`);
  }

  // --- vendored provenance (ADR-0009) --------------------------------------
  const vendored = skill.vendored;
  if (isVendoredName(skill.folderName)) {
    if (vendored === null) {
      err(`vendored skill must declare a 'vendored:' block with ${REQUIRED_VENDOR_FIELDS.join(", ")}`);
    } else {
      const missing = missingVendorFields(vendored);
      if (missing.length > 0) err(`vendored block missing field(s): ${missing.join(", ")}`);
    }
    if (fm["supersedes"] === undefined) {
      err("vendored skill must declare 'supersedes:' (use [] if it replaces nothing)");
    }
  } else if (vendored !== null) {
    err(`a 'vendored:' block is only valid on ${vendorPrefixList()} skills`);
  }

  // Skipped before the first release, so a fresh clone is not error-flooded.
  if (expectedRelease !== "unreleased" && skill.release !== expectedRelease) {
    err(`release '${skill.release || "(absent)"}' must equal ${expectedRelease} — run npm run release`);
  }

  // --- per-surface rules ---------------------------------------------------
  const declaredSurface = fm["surface"];
  if (
    declaredSurface !== undefined &&
    !(typeof declaredSurface === "string" && (VALID_SURFACES as readonly string[]).includes(declaredSurface))
  ) {
    err(
      `surface '${declaredSurface}' is invalid ` +
        `(allowed: ${sortedJoin(VALID_SURFACES)}; omit to default to desktop)`,
    );
  }

  const declaredCategory = fm["category"];
  if (
    declaredCategory !== undefined &&
    !(typeof declaredCategory === "string" && (VALID_CATEGORIES as readonly string[]).includes(declaredCategory))
  ) {
    err(`category '${declaredCategory}' is invalid (allowed: ${sortedJoin(VALID_CATEGORIES)})`);
  }
  if ((skill.surface === "code" || skill.surface === "both") && (declaredCategory === undefined || declaredCategory.length === 0)) {
    err(
      "frontmatter missing required field 'category' for code|both skill " +
        `(allowed: ${sortedJoin(VALID_CATEGORIES)})`,
    );
  }

  const subdirs = skill.codeSubdirsPresent;
  if (subdirs.length > 0 && skill.surface === "desktop") {
    err(
      `surface 'desktop' skill ships ${subdirs.join("/")} folder(s); ` +
        `only code|both skills may include ${CODE_SUBDIRS.join("/")}`,
    );
  }

  const mcpRaw = fm["mcp"];
  if (mcpRaw !== undefined) {
    if (!Array.isArray(mcpRaw)) {
      err("mcp must be an inline list, e.g. mcp: [jira, slack]");
    } else if (mcpRaw.some((item) => typeof item !== "string" || item === "")) {
      err("mcp entries must be non-empty server names");
    }
  }

  for (const field of ["produces", "consumes"] as const) {
    const raw = fm[field];
    if (raw === undefined) continue;
    if (!Array.isArray(raw)) {
      err(`${field} must be an inline list, e.g. ${field}: [prd]`);
      continue;
    }
    for (const item of raw) {
      if (typeof item !== "string" || !(VALID_ARTIFACTS as readonly string[]).includes(item)) {
        err(`${field} entry '${item}' is not a known artifact type (allowed: ${sortedJoin(VALID_ARTIFACTS)})`);
      }
    }
  }
}

/**
 * Validate every skill under skillsDir; return a list of error strings.
 * This is the behavioral seam tests drive against fixture trees.
 */
export function collectErrors(skillsDir: string, expectedRelease = "unreleased"): string[] {
  const errors: string[] = [];
  const skills = discover(skillsDir);
  for (const skill of skills) validateSkill(skill, skillsDir, errors, expectedRelease);

  // Cross-skill: one superseded name, one replacement. Two claimants would make
  // doctor offer an engineer two different answers for the same orphan.
  const claimed = new Map<string, string>();
  for (const skill of skills) {
    for (const old of skill.supersedes) {
      const first = claimed.get(old);
      if (first !== undefined) {
        errors.push(`${skill.folderName}: supersedes '${old}', already claimed by ${first}`);
        continue;
      }
      claimed.set(old, skill.folderName);
    }
  }
  return errors;
}

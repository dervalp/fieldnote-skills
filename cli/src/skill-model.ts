/**
 * Shared skill model: parse the skills/ tree into structured records.
 *
 * Single source of truth for how a SKILL.md's frontmatter is read — including
 * the `surface` default and `mcp` list parsing. The validator, the catalog
 * builder, the packager, and the CLI's authoring checks all import from here
 * so the rules can never drift.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

/** Position in the delivery loop. Read from frontmatter — the skills tree is flat. */
export const VALID_STAGES = ["plan", "build", "review"] as const;

export const STAGE_LABELS: Record<(typeof VALID_STAGES)[number], string> = {
  plan: "Plan",
  build: "Build",
  review: "Review",
};

/** Human label for a stage, or undefined when absent/unknown. */
export function stageLabel(stage: string): string | undefined {
  return (STAGE_LABELS as Record<string, string>)[stage];
}

// A skill's distribution surface. Every skill here is a Claude Code skill —
// absent -> "code".
export const VALID_SURFACES = ["desktop", "code", "both"] as const;
export const DEFAULT_SURFACE = "code";

/**
 * How much a repository must tailor the skill.
 * - universal:  no repository facts at all
 * - configured: one procedure, facts injected from .fieldnote/profile.md
 * - templated:  a generic spine plus repository-authored sections
 */
export const VALID_VARIANCES = ["universal", "configured", "templated"] as const;

export const VARIANCE_LABELS: Record<(typeof VALID_VARIANCES)[number], string> = {
  universal: "Universal",
  configured: "Configured",
  templated: "Templated",
};

// Richer Claude Code capabilities only make sense for code-bound surfaces.
export const CODE_SUBDIRS = ["commands", "agents", "hooks"] as const;

/**
 * Dev-only subfolders of a skill that must never ship to consumers — not in
 * Desktop zips (skill-package), not in the npm bundle (scripts/bundle), not in
 * ~/.claude installs (installer). Per-skill eval harnesses live in tests/.
 */
export const NON_SHIPPED_SKILL_DIRS = ["tests"] as const;

/** True when a path relative to the skill folder should ship to consumers. */
export function shipsInSkill(relPath: string): boolean {
  const first = relPath.split(/[\\/]/, 1)[0] ?? "";
  return !(NON_SHIPPED_SKILL_DIRS as readonly string[]).includes(first);
}

/**
 * Typed artifacts that may flow between skills via `produces:`/`consumes:`
 * frontmatter (ADR-0006). A skill that reintroduces one ships its Zod source
 * and generated JSON Schema under schemas/.
 */
export const VALID_ARTIFACTS = ["prd"] as const;

export const NAME_RE = /^fieldnote-[a-z0-9][a-z0-9-]*$/;
export const SEMVER_RE = /^\d+\.\d+\.\d+$/;
export const MIN_DESCRIPTION_WORDS = 15;

export type FrontmatterValue = string | string[] | Record<string, string>;
export type Frontmatter = Record<string, FrontmatterValue>;

/**
 * Frontmatter keys whose value may be an indented block instead of a scalar.
 * Deliberately an allow-list: promoting every bare `key:` to a block would
 * change how existing skills parse (a lone `mcp:` becomes an object).
 */
export const BLOCK_KEYS: ReadonlySet<string> = new Set(["vendored"]);

/**
 * Subfolders that are Claude-Code-only tooling, never prompt content.
 * `agents/` holds subagent definitions another harness reads (upstream ships
 * `agents/openai.yaml`); `scripts/` holds executables. Neither belongs in a
 * system prompt, so both stay out of `coreHash` and out of Mastra's bundle.
 */
export const TOOLING_DIRS = ["scripts", "agents"] as const;
export type FileRole = "prompt" | "tooling";

/** A file's role within a skill: what a model reads vs what only Code runs. */
export function fileRole(relPath: string): FileRole {
  const first = relPath.split(/[\\/]/, 1)[0] ?? "";
  return (TOOLING_DIRS as readonly string[]).includes(first) ? "tooling" : "prompt";
}

/** A skill entry as written into catalog.json. */
export interface CatalogEntry {
  name: string;
  stage: string;
  description: string;
  surface: string;
  version: string;
  mcp: string[];
  variance: string;
  produces?: string[];
  consumes?: string[];
}

function stripQuotes(raw: string): string {
  return raw.replace(/^['"]+/, "").replace(/['"]+$/, "");
}

/** Parse a frontmatter scalar, or an inline `[a, b]` list (used by `mcp`). */
function parseValue(raw: string): FrontmatterValue {
  raw = raw.trim();
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (inner === "") return [];
    return inner
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map(stripQuotes);
  }
  return stripQuotes(raw);
}

/**
 * Minimal YAML-frontmatter reader for `key: value` lines. Returns null when
 * frontmatter is missing or malformed. Inline lists (`mcp: [jira, slack]`)
 * come back as arrays; everything else as a stripped string.
 */
export function parseFrontmatter(text: string): Frontmatter | null {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("---", 3);
  if (end === -1) return null;
  const fm: Frontmatter = {};
  let blockKey: string | null = null;
  for (const raw of text.slice(3, end).split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    if (/^\s/.test(raw) && blockKey !== null) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      (fm[blockKey] as Record<string, string>)[line.slice(0, idx).trim()] = String(parseValue(line.slice(idx + 1)));
      continue;
    }
    if (!line.includes(":")) continue;
    const idx = line.indexOf(":");
    const key = line.slice(0, idx).trim();
    const rest = line.slice(idx + 1).trim();
    if (rest === "" && BLOCK_KEYS.has(key)) {
      fm[key] = {};
      blockKey = key;
      continue;
    }
    fm[key] = parseValue(rest);
    blockKey = null;
  }
  return fm;
}

/**
 * Lines the parser had to skip. Every value must sit on one line: there is no
 * folded-scalar support, so a wrapped description silently loses its tail.
 */
export function frontmatterLineErrors(rawFrontmatter: string): string[] {
  const errors: string[] = [];
  let blockKey: string | null = null;
  for (const raw of rawFrontmatter.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    if (/^\s/.test(raw)) {
      if (blockKey === null) errors.push(`indented line '${line}' does not belong to a block key`);
      continue;
    }
    if (!line.includes(":")) {
      errors.push(`line '${line}' has no 'key: value' — keep every value on a single line`);
      continue;
    }
    const key = line.slice(0, line.indexOf(":")).trim();
    const rest = line.slice(line.indexOf(":") + 1).trim();
    blockKey = rest === "" && BLOCK_KEYS.has(key) ? key : null;
  }
  return errors;
}

/** A discovered skill, normalized from its folder + frontmatter. */
export class Skill {
  constructor(
    /** Absolute path to the skill's SKILL.md. */
    public readonly path: string,
    public readonly folderName: string,
    public readonly frontmatter: Frontmatter,
    /** The text between the `---` fences, for line-level checks. */
    public readonly rawFrontmatter: string = "",
  ) {}

  private stringField(key: string): string {
    const value = this.frontmatter[key];
    return typeof value === "string" ? value : "";
  }

  get release(): string {
    return this.stringField("release");
  }

  /** The `vendored:` provenance block (ADR-0009), or null when first-party. */
  get vendored(): Record<string, string> | null {
    const value = this.frontmatter["vendored"];
    if (value === undefined || typeof value !== "object" || Array.isArray(value)) return null;
    return value;
  }

  /** Unmanaged skill folder names this skill replaces. */
  get supersedes(): string[] {
    return this.listField("supersedes");
  }

  get name(): string {
    return this.stringField("name");
  }
  get version(): string {
    return this.stringField("version");
  }
  get description(): string {
    return this.stringField("description");
  }
  /** Position in the delivery loop, read from frontmatter — the tree is flat. */
  get stage(): string {
    return this.stringField("stage");
  }
  /** How much a repository must tailor the skill, read from frontmatter. */
  get variance(): string {
    return this.stringField("variance");
  }

  get surface(): string {
    const value = this.frontmatter["surface"];
    return typeof value === "string" && value !== "" ? value : DEFAULT_SURFACE;
  }

  get mcp(): string[] {
    return this.listField("mcp");
  }

  /** Artifact types this skill emits (ADR-0006). */
  get produces(): string[] {
    return this.listField("produces");
  }

  /** Artifact types this skill reads (ADR-0006). */
  get consumes(): string[] {
    return this.listField("consumes");
  }

  private listField(key: string): string[] {
    const value = this.frontmatter[key];
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value !== "") return [value];
    return [];
  }

  /** Which of commands/agents/hooks actually exist next to SKILL.md. */
  get codeSubdirsPresent(): string[] {
    const skillDir = dirname(this.path);
    return CODE_SUBDIRS.filter((sub) => {
      try {
        return statSync(join(skillDir, sub)).isDirectory();
      } catch {
        return false;
      }
    });
  }

  toCatalogEntry(): CatalogEntry {
    const entry: CatalogEntry = {
      name: this.name,
      stage: this.stage,
      description: this.description,
      surface: this.surface,
      version: this.version,
      mcp: this.mcp,
      variance: this.variance,
    };
    // Emitted only when declared, so entries without artifacts stay byte-stable.
    if (this.produces.length > 0) entry.produces = this.produces;
    if (this.consumes.length > 0) entry.consumes = this.consumes;
    return entry;
  }
}

function listDirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/** Load every skills/<name>/SKILL.md into a Skill record. */
export function discover(skillsDir: string): Skill[] {
  const skills: Skill[] = [];
  for (const folder of listDirs(skillsDir)) {
    const skillMd = join(skillsDir, folder, "SKILL.md");
    let text: string;
    try {
      text = readFileSync(skillMd, "utf8");
    } catch {
      continue; // folder without a SKILL.md (e.g. _shared/ content) is not a skill
    }
    const end = text.indexOf("---", 3);
    const rawFm = text.startsWith("---") && end !== -1 ? text.slice(3, end) : "";
    skills.push(new Skill(skillMd, folder, parseFrontmatter(text) ?? {}, rawFm));
  }
  return skills;
}

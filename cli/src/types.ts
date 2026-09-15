/** Core data model shared across the CLI. */

export type Surface = "desktop" | "code" | "both";
/** Position in the delivery loop. */
export type SkillStage = "setup" | "plan" | "build" | "review";
/** How much a repository must tailor the skill. */
export type SkillVariance = "universal" | "configured" | "templated";

/** A skill entry as recorded in catalog.json (built by scripts/build-catalog.py). */
export interface SkillEntry {
  name: string;
  stage: SkillStage;
  description: string;
  surface: Surface;
  version: string;
  mcp: string[];
  variance: SkillVariance;
  /** Artifact types this skill emits / reads; absent when none. */
  produces?: string[];
  consumes?: string[];
  /** `.fieldnote/concerns/` files this skill always reads; absent when none. */
  concerns?: string[];
}

export interface Catalog {
  version: number;
  skills: SkillEntry[];
}

/** One installed skill, as recorded in the manifest under ~/.claude. */
export interface ManifestEntry {
  version: string;
  stage: SkillStage;
  surface: Surface;
  /** Catalog release this copy came from; absent for pre-0.3 installs. */
  release?: string;
  /** coreHash at install time, so a local edit can be told from being behind. */
  coreHash?: string;
}

/** The installed-skill manifest written into ~/.claude. */
export interface Manifest {
  version: number;
  skills: Record<string, ManifestEntry>;
}

/** A catalog row enriched with the engineer's local install state. */
export interface SkillRow {
  entry: SkillEntry;
  installed: boolean;
  installedVersion: string | null;
  /** Bundled version is newer than what is installed. */
  outdated: boolean;
}

/** Interactive prompt surface, behind an interface so tests inject a fake. */
export interface Prompter {
  checkbox(opts: {
    message: string;
    choices: { name: string; value: string; checked?: boolean; disabled?: boolean }[];
  }): Promise<string[]>;
  input(opts: {
    message: string;
    validate?: (value: string) => true | string;
  }): Promise<string>;
  select(opts: {
    message: string;
    choices: { name: string; value: string }[];
  }): Promise<string>;
  confirm(opts: { message: string; default?: boolean }): Promise<boolean>;
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  /** Raw stdout write with no decoration — used for --json output. */
  output(message: string): void;
}

/**
 * The injected environment every command operates against. Tests construct
 * this pointing at a temp ~/.claude and fixture sources; production builds it
 * from the real filesystem in paths.ts.
 */
export interface Env {
  /** Target install root, normally ~/.claude. */
  claudeDir: string;
  /** Path to catalog.json (repo clone or bundled in the package). */
  catalogPath: string;
  /** Directory holding skill source folders (skills/<name>/). */
  skillsSourceDir: string;
  /** Root of this repo when run inside a clone, else null — how paths.ts chose the two paths above. */
  repoRoot: string | null;
  prompter: Prompter;
  logger: Logger;
}

/** Raised for expected, user-facing failures (printed without a stack trace). */
export class UserError extends Error {}

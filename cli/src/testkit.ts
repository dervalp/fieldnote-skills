import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  Catalog,
  Env,
  Logger,
  SkillVariance,
  Prompter,
  SkillEntry,
  SkillStage,
  Surface,
} from "./types.js";

/** Prompter that replays scripted answers; records the choices it was shown. */
export class FakePrompter implements Prompter {
  checkboxAnswers: string[][] = [];
  inputAnswers: string[] = [];
  selectAnswers: string[] = [];
  confirmAnswers: boolean[] = [];
  lastCheckboxChoices: { name: string; value: string; disabled?: boolean }[] = [];
  lastSelectChoices: { name: string; value: string }[] = [];

  async checkbox(opts: {
    message: string;
    choices: { name: string; value: string; checked?: boolean; disabled?: boolean }[];
  }): Promise<string[]> {
    this.lastCheckboxChoices = opts.choices;
    return this.checkboxAnswers.shift() ?? [];
  }
  async input(): Promise<string> {
    return this.inputAnswers.shift() ?? "";
  }
  async select(opts: { message: string; choices: { name: string; value: string }[] }): Promise<string> {
    this.lastSelectChoices = opts.choices;
    return this.selectAnswers.shift() ?? "";
  }
  async confirm(): Promise<boolean> {
    return this.confirmAnswers.shift() ?? false;
  }
}

/** Logger that captures lines for assertions. */
export class FakeLogger implements Logger {
  infos: string[] = [];
  warns: string[] = [];
  errors: string[] = [];
  outputs: string[] = [];
  info(m: string): void {
    this.infos.push(m);
  }
  warn(m: string): void {
    this.warns.push(m);
  }
  error(m: string): void {
    this.errors.push(m);
  }
  output(m: string): void {
    this.outputs.push(m);
  }
}

export interface FixtureSkill {
  name: string;
  stage: SkillStage;
  surface?: Surface;
  version?: string;
  description?: string;
  mcp?: string[];
  variance?: SkillVariance;
  concerns?: string[];
  /** Extra files keyed by repo-relative path within the skill folder. */
  files?: Record<string, string>;
}

const DEFAULT_DESC =
  "Use when the user wants this fixture skill so that the description clears the fifteen word minimum easily.";

export function toEntry(skill: FixtureSkill): SkillEntry {
  const entry: SkillEntry = {
    name: skill.name,
    stage: skill.stage,
    surface: skill.surface ?? "code",
    version: skill.version ?? "1.0.0",
    description: skill.description ?? DEFAULT_DESC,
    mcp: skill.mcp ?? [],
    variance: skill.variance ?? "universal",
  };
  if (skill.concerns !== undefined && skill.concerns.length > 0) entry.concerns = skill.concerns;
  return entry;
}

export interface Harness {
  env: Env;
  prompter: FakePrompter;
  logger: FakeLogger;
  claudeDir: string;
  sourceDir: string;
  repoRoot: string;
  cleanup: () => Promise<void>;
}

/**
 * Build an Env pointing at temp dirs, materialize the given fixture skills into
 * a skills/ source tree, and write a catalog.json for them. The temp dir also
 * looks like a repo clone (skills/ + cli/package.json) so repo-detection
 * tests can rely on it.
 */
export async function makeHarness(skills: FixtureSkill[]): Promise<Harness> {
  const root = await mkdtemp(join(tmpdir(), "vz-skills-"));
  const repoRoot = join(root, "repo");
  const sourceDir = join(repoRoot, "skills");
  const claudeDir = join(root, "claude");
  await mkdir(claudeDir, { recursive: true });
  await mkdir(join(repoRoot, "cli"), { recursive: true });
  await writeFile(join(repoRoot, "cli", "package.json"), "{}\n", "utf8");

  const entries: SkillEntry[] = [];
  for (const skill of skills) {
    const entry = toEntry(skill);
    entries.push(entry);
    const folder = join(sourceDir, entry.name);
    await mkdir(folder, { recursive: true });
    const fm = [
      "---",
      `name: ${entry.name}`,
      `description: ${entry.description}`,
      `version: ${entry.version}`,
      `stage: ${entry.stage}`,
      `surface: ${entry.surface}`,
      `variance: ${entry.variance}`,
      "---",
      "",
      `# ${entry.name}`,
      "",
    ].join("\n");
    await writeFile(join(folder, "SKILL.md"), fm, "utf8");
    for (const [rel, content] of Object.entries(skill.files ?? {})) {
      const dest = join(folder, rel);
      await mkdir(join(dest, ".."), { recursive: true });
      await writeFile(dest, content, "utf8");
    }
  }

  const catalog: Catalog = { version: 1, skills: entries };
  const catalogPath = join(repoRoot, "catalog.json");
  await writeFile(catalogPath, JSON.stringify(catalog, null, 2), "utf8");

  const prompter = new FakePrompter();
  const logger = new FakeLogger();

  const env: Env = {
    claudeDir,
    catalogPath,
    skillsSourceDir: sourceDir,
    repoRoot,
    prompter,
    logger,
  };

  return {
    env,
    prompter,
    logger,
    claudeDir,
    sourceDir,
    repoRoot,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

/**
 * Raise a skill's version in both catalog.json and its source SKILL.md, to
 * simulate a newer bundled version than what an engineer has installed.
 */
export async function bumpVersion(h: Harness, name: string, version: string): Promise<void> {
  const catalog = JSON.parse(await readFile(h.env.catalogPath, "utf8")) as Catalog;
  const entry = catalog.skills.find((s) => s.name === name);
  if (!entry) throw new Error(`bumpVersion: no skill ${name}`);
  entry.version = version;
  await writeFile(h.env.catalogPath, JSON.stringify(catalog, null, 2), "utf8");

  const folder = join(h.sourceDir, name);
  const md = await readFile(join(folder, "SKILL.md"), "utf8");
  await writeFile(join(folder, "SKILL.md"), md.replace(/version: .*/g, `version: ${version}`), "utf8");
}

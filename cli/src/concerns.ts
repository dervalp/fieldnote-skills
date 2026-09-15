/**
 * The repository-concerns convention.
 *
 * A repository authors its own rules as one short Markdown file per concern
 * under `.fieldnote/concerns/`. A skill reads the file at the moment the rule
 * binds — there is no templating step and no runtime, so "composition" is an
 * instruction in the skill body, not a substitution.
 *
 * The six names below are STRONGLY ADVISED, not fixed. A command-line tool
 * has no front end; a repository doing model work may want `prompts`. Adding
 * one is dropping in a file: nothing here has to change, and no check may
 * reject an unadvised name. That is the difference from `dod.ts`, whose five
 * sections really are the same in every repository.
 *
 * The names live here, in code, because the documentation, the starter files
 * and the skills all have to agree on them. A test pins each against this list.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

/** Broad to narrow: what binds everywhere, then each surface, then the pipeline. */
export const ADVISED_CONCERNS = [
  "shared",
  "front-end",
  "backend",
  "database",
  "qa",
  "ci",
] as const;

export type AdvisedConcern = (typeof ADVISED_CONCERNS)[number];

/** Where the convention puts them: beside `.fieldnote/profile.md`. */
export const CONCERNS_DIR = ".fieldnote/concerns";

/** A concern name is a kebab-case file stem — the filename IS the name. */
export const CONCERN_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `.fieldnote/concerns/front-end.md` for `front-end`. */
export function concernPath(name: string): string {
  return `${CONCERNS_DIR}/${name}.md`;
}

function order(name: string): number {
  const index = (ADVISED_CONCERNS as readonly string[]).indexOf(name);
  return index === -1 ? ADVISED_CONCERNS.length : index;
}

/** Advised names in convention order; anything else alphabetically after them. */
export function sortConcerns(names: string[]): string[] {
  return [...names].sort((a, b) => order(a) - order(b) || (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * The concern files a repository actually has, by name.
 *
 * A missing folder is not an error: a repository that has authored nothing is
 * the ordinary starting state, and every skill degrades rather than stopping.
 */
export function findConcerns(repoRoot: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(join(repoRoot, ".fieldnote", "concerns"));
  } catch {
    return [];
  }
  const names = entries
    .filter((e) => e.endsWith(".md"))
    .map((e) => e.slice(0, -3))
    .filter((n) => CONCERN_NAME_RE.test(n));
  return sortConcerns(names);
}

/** Declared concerns with no file in the repository, in convention order. */
export function missingConcerns(declared: string[], present: string[]): string[] {
  const have = new Set(present);
  return sortConcerns(declared.filter((name) => !have.has(name)));
}

/** One concern: who reads it, and whether this repository wrote it. */
export interface ConcernRow {
  name: string;
  present: boolean;
  /** Installed skills that declared this concern, in name order. */
  wantedBy: string[];
}

/**
 * Pair what the installed skills declare against what the repository has.
 *
 * Pure: the command layer gathers the inputs and renders the output, the same
 * split `doctor-state.ts` uses, so every state is testable without a disk.
 * A file nobody asked for is still reported — it confirms the folder was seen,
 * and a name nothing reads is worth knowing about.
 */
export function classifyConcerns(input: {
  present: string[];
  declaredBy: Map<string, string[]>;
}): ConcernRow[] {
  const have = new Set(input.present);
  const wantedBy = new Map<string, string[]>();
  for (const [skill, concerns] of [...input.declaredBy].sort(([a], [b]) => (a < b ? -1 : 1))) {
    for (const name of concerns) {
      const list = wantedBy.get(name);
      if (list === undefined) wantedBy.set(name, [skill]);
      else list.push(skill);
    }
  }
  const names = sortConcerns([...new Set([...input.present, ...wantedBy.keys()])]);
  return names.map((name) => ({
    name,
    present: have.has(name),
    wantedBy: wantedBy.get(name) ?? [],
  }));
}

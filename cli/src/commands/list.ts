import { computeRows } from "../state.js";
import { installEntries } from "../installer.js";
import { STAGE_LABELS, VALID_STAGES } from "../skill-rules.js";
import type { Env, SkillRow, SkillStage } from "../types.js";
import { UserError } from "../types.js";

function stageTitle(stage: string): string {
  return (STAGE_LABELS as Record<string, string>)[stage] ?? stage;
}

type StageFilter = SkillStage | "all";

/** Longest description shown in the picker before it is truncated. */
const MAX_DESCRIPTION = 400;
/** Widest description column, so lines stay scannable on a full-screen terminal. */
const MAX_DESCRIPTION_WIDTH = 96;
/** Narrowest, so a cramped terminal still gets prose rather than one word per line. */
const MIN_DESCRIPTION_WIDTH = 40;
/** Indent for each wrapped description line, clear of the checkbox marker. */
const DESCRIPTION_INDENT = "      ";
/** Breathing room at the right edge, so no line lands exactly on the last column. */
const RIGHT_MARGIN = 2;

/**
 * Width to wrap descriptions to. We wrap by hand so the terminal never wraps
 * for us — its wrap ignores our indent and drops the continuation to column 0.
 * That only holds if the width is the terminal's: a hardcoded 96 plus the
 * indent overflowed every 80-column window, which is exactly what the manual
 * wrapping exists to prevent. `columns` is undefined when stdout is a pipe.
 */
export function descriptionWidth(columns: number | undefined = process.stdout.columns): number {
  // A pty whose window size was never set reports 0, not undefined, so `?? 80`
  // alone sails past it and every description wraps at the floor instead.
  const terminal = columns !== undefined && Number.isFinite(columns) && columns > 0 ? columns : 80;
  const usable = terminal - DESCRIPTION_INDENT.length - RIGHT_MARGIN;
  return Math.max(MIN_DESCRIPTION_WIDTH, Math.min(MAX_DESCRIPTION_WIDTH, usable));
}
/** Small left pad after the checkbox marker, so the item text has room to breathe. */
const HEADING_INDENT = " ";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trimEnd()}...`;
}

function wrapText(text: string, width: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (!line) {
      line = word;
    } else if (line.length + 1 + word.length <= width) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
}

/**
 * Multi-line, padded label for a skill in the picker. Renders as:
 *
 *     <name>  ·  v<version>  <state>
 *
 *         <description, truncated to 400 chars>
 *
 * The leading checkbox marker is supplied by the prompt. The blank line above
 * and below the description gives each skill breathing room so the long list
 * stays scannable instead of being a wall of crammed one-liners.
 */
export function rowLabel(row: SkillRow, columns?: number): string {
  const { entry } = row;
  let state = "";
  if (row.outdated) state = `  ⬆ update available (${row.installedVersion} → ${entry.version})`;
  else if (row.installed) state = "  ✓ installed";
  const heading = `${HEADING_INDENT}${entry.name}  ·  v${entry.version}${state}`;
  const description = wrapText(truncate(entry.description, MAX_DESCRIPTION), descriptionWidth(columns))
    .map((line) => `${DESCRIPTION_INDENT}${line}`)
    .join("\n");
  return `${heading}\n${description}\n`;
}

/** Build checkbox choices grouped by stage, with non-selectable headers. */
export function buildChoices(
  rows: SkillRow[],
): { name: string; value: string; checked?: boolean; disabled?: boolean }[] {
  const byStage = new Map<string, SkillRow[]>();
  for (const row of rows) {
    const list = byStage.get(row.entry.stage) ?? [];
    list.push(row);
    byStage.set(row.entry.stage, list);
  }

  // Ordered by the loop, not by the alphabet: a plain .sort() put Build
  // before Plan, which is not the order anyone works in.
  const stageRank = (stage: string): number => {
    const i = (VALID_STAGES as readonly string[]).indexOf(stage);
    return i === -1 ? VALID_STAGES.length : i;
  };
  const ordered = [...byStage.entries()].sort(
    ([a], [b]) => stageRank(a) - stageRank(b) || (a < b ? -1 : a > b ? 1 : 0),
  );

  const choices: { name: string; value: string; checked?: boolean; disabled?: boolean }[] = [];
  for (const [stage, stageRows] of ordered) {
    choices.push({ name: `── ${stageTitle(stage)} ──`, value: `__stage:${stage}`, disabled: true });
    for (const row of stageRows.sort((a, b) => a.entry.name.localeCompare(b.entry.name))) {
      // Pre-ticked: installing the whole loop is what almost everyone wants,
      // so the picker starts from "all" and you untick the exceptions. The
      // stage headers stay unticked — they are separators, not selections.
      choices.push({ name: rowLabel(row), value: row.entry.name, checked: true });
    }
  }
  return choices;
}

/**
 * The leading prompt: take the whole loop, or open the picker. "Everything"
 * comes first so the common answer is the one Enter already lands on, and
 * choosing it skips both the stage filter and the checkbox entirely.
 */
export function buildModeChoices(rows: SkillRow[]): { name: string; value: string }[] {
  const count = `${rows.length} skill${rows.length === 1 ? "" : "s"}`;
  return [
    { name: `Everything (${count})`, value: "everything" },
    { name: "Choose skills myself", value: "choose" },
  ];
}

export function normalizeStageFilter(value: string): StageFilter {
  if (value === "all") return "all";
  if (VALID_STAGES.includes(value as SkillStage)) return value as SkillStage;
  throw new UserError(`Unknown stage "${value}". Valid stages: ${["all", ...VALID_STAGES].join(", ")}.`);
}

export function filterRowsByStage(rows: SkillRow[], stage: StageFilter): SkillRow[] {
  if (stage === "all") return rows;
  return rows.filter((row) => row.entry.stage === stage);
}

export function buildStageChoices(rows: SkillRow[]): { name: string; value: string }[] {
  const counts = new Map<SkillStage, number>();
  for (const row of rows) {
    if (row.entry.stage && VALID_STAGES.includes(row.entry.stage)) {
      counts.set(row.entry.stage, (counts.get(row.entry.stage) ?? 0) + 1);
    }
  }

  return [
    { name: `All stages (${rows.length})`, value: "all" },
    ...VALID_STAGES.filter((stage) => (counts.get(stage) ?? 0) > 0).map((stage) => ({
      name: `${stageTitle(stage)} (${counts.get(stage) ?? 0})`,
      value: stage,
    })),
  ];
}

async function resolveStage(env: Env, rows: SkillRow[], requested?: string): Promise<StageFilter> {
  if (requested !== undefined) return normalizeStageFilter(requested);

  const selected = await env.prompter.select({
    message: "Which stage do you want to browse?",
    choices: buildStageChoices(rows),
  });
  return normalizeStageFilter(selected);
}

/** Install the given entries and report what happened, one line each. */
async function installAndReport(env: Env, entries: SkillRow["entry"][]): Promise<void> {
  const results = await installEntries(env, entries);
  for (const r of results) {
    const verb = r.action === "updated" ? "Updated" : "Installed";
    env.logger.info(`${verb} ${r.name}@${r.version}`);
  }
}

/**
 * The interactive `list` command (also the default no-arg command): offer the
 * whole loop first, and only render the grouped checkbox picker for someone
 * who says they want to choose.
 *
 * `all` (the `--all` flag) takes the same path without any prompt, so it works
 * where there is no TTY — CI, a piped shell, a one-line setup script. Passing
 * `stage` narrows what "everything" means rather than overriding it.
 */
export async function runList(env: Env, opts: { stage?: string; all?: boolean } = {}): Promise<void> {
  const rows = await computeRows(env);
  if (rows.length === 0) {
    env.logger.info("No installable skills in the catalog yet.");
    return;
  }

  if (opts.all) {
    const stage = opts.stage === undefined ? "all" : normalizeStageFilter(opts.stage);
    const scope = filterRowsByStage(rows, stage);
    if (scope.length === 0) {
      env.logger.info(`No installable skills in ${stage === "all" ? "all stages" : stageTitle(stage)}.`);
      return;
    }
    await installAndReport(env, scope.map((r) => r.entry));
    return;
  }

  // An explicit --stage is already a decision to browse, so it skips the
  // everything/choose prompt and goes straight to that stage's picker.
  if (opts.stage === undefined) {
    const mode = await env.prompter.select({
      message: "What do you want to install?",
      choices: buildModeChoices(rows),
    });
    if (mode === "everything") {
      await installAndReport(env, rows.map((r) => r.entry));
      return;
    }
  }

  const stage = await resolveStage(env, rows, opts.stage);
  const filteredRows = filterRowsByStage(rows, stage);
  if (filteredRows.length === 0) {
    env.logger.info(`No installable skills in ${stage === "all" ? "all stages" : stageTitle(stage)}.`);
    return;
  }

  const choices = buildChoices(filteredRows);
  const picked = await env.prompter.checkbox({
    message: "Select skills to install into ~/.claude (space to toggle, enter to confirm)",
    choices,
  });

  // Stage header pseudo-rows are filtered out.
  const names = picked.filter((value) => !value.startsWith("__stage:"));
  if (names.length === 0) {
    env.logger.info("Nothing selected.");
    return;
  }

  const byName = new Map(filteredRows.map((r) => [r.entry.name, r.entry]));
  const entries = names.map((n) => byName.get(n)!).filter(Boolean);
  await installAndReport(env, entries);
}

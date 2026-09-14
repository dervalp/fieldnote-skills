import { computeRows } from "../state.js";
import { installEntries } from "../installer.js";
import { CATEGORY_LABELS, VALID_CATEGORIES } from "../skill-rules.js";
import type { Env, SkillCategory, SkillRow } from "../types.js";
import { UserError } from "../types.js";

const SECTION_TITLES: Record<string, string> = {
  brand: "Brand",
  "product-knowledge": "Product Knowledge",
  "construction-knowledge": "Construction Knowledge",
  "engineering-standards": "Engineering Standards",
  "sales-messaging": "Sales Messaging",
  "customer-success": "Customer Success",
};

function sectionTitle(section: string): string {
  return SECTION_TITLES[section] ?? section;
}

type CategoryFilter = SkillCategory | "all";

function categoryTitle(category: SkillCategory): string {
  return CATEGORY_LABELS[category];
}

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

/** Build checkbox choices grouped by section, with non-selectable headers. */
export function buildChoices(
  rows: SkillRow[],
): { name: string; value: string; checked?: boolean; disabled?: boolean }[] {
  const bySection = new Map<string, SkillRow[]>();
  for (const row of rows) {
    const list = bySection.get(row.entry.section) ?? [];
    list.push(row);
    bySection.set(row.entry.section, list);
  }

  const choices: { name: string; value: string; checked?: boolean; disabled?: boolean }[] = [];
  for (const [section, sectionRows] of [...bySection.entries()].sort()) {
    choices.push({ name: `── ${sectionTitle(section)} ──`, value: `__section:${section}`, disabled: true });
    for (const row of sectionRows.sort((a, b) => a.entry.name.localeCompare(b.entry.name))) {
      choices.push({ name: rowLabel(row), value: row.entry.name });
    }
  }
  return choices;
}

export function normalizeCategoryFilter(value: string): CategoryFilter {
  if (value === "all") return "all";
  if (VALID_CATEGORIES.includes(value as SkillCategory)) return value as SkillCategory;
  throw new UserError(
    `Unknown category "${value}". Valid categories: ${["all", ...VALID_CATEGORIES].join(", ")}.`,
  );
}

export function filterRowsByCategory(rows: SkillRow[], category: CategoryFilter): SkillRow[] {
  if (category === "all") return rows;
  return rows.filter((row) => row.entry.category === category);
}

export function buildCategoryChoices(rows: SkillRow[]): { name: string; value: string }[] {
  const counts = new Map<SkillCategory, number>();
  for (const row of rows) {
    if (row.entry.category && VALID_CATEGORIES.includes(row.entry.category)) {
      counts.set(row.entry.category, (counts.get(row.entry.category) ?? 0) + 1);
    }
  }

  return [
    { name: `All categories (${rows.length})`, value: "all" },
    ...VALID_CATEGORIES.filter((category) => (counts.get(category) ?? 0) > 0).map((category) => ({
      name: `${categoryTitle(category)} (${counts.get(category) ?? 0})`,
      value: category,
    })),
  ];
}

async function resolveCategory(env: Env, rows: SkillRow[], requested?: string): Promise<CategoryFilter> {
  if (requested !== undefined) return normalizeCategoryFilter(requested);

  const selected = await env.prompter.select({
    message: "Which category do you want to browse?",
    choices: buildCategoryChoices(rows),
  });
  return normalizeCategoryFilter(selected);
}

/**
 * The interactive `list` command (also the default no-arg command): render the
 * installable catalog as a grouped checkbox picker, then install the ticks.
 */
export async function runList(env: Env, opts: { category?: string } = {}): Promise<void> {
  const rows = await computeRows(env);
  if (rows.length === 0) {
    env.logger.info("No installable skills in the catalog yet.");
    return;
  }

  const category = await resolveCategory(env, rows, opts.category);
  const filteredRows = filterRowsByCategory(rows, category);
  if (filteredRows.length === 0) {
    env.logger.info(`No installable skills in ${category === "all" ? "all categories" : categoryTitle(category)}.`);
    return;
  }

  const choices = buildChoices(filteredRows);
  const picked = await env.prompter.checkbox({
    message: "Select skills to install into ~/.claude (space to toggle, enter to confirm)",
    choices,
  });

  // Section header pseudo-rows are filtered out.
  const names = picked.filter((value) => !value.startsWith("__section:"));
  if (names.length === 0) {
    env.logger.info("Nothing selected.");
    return;
  }

  const byName = new Map(filteredRows.map((r) => [r.entry.name, r.entry]));
  const entries = names.map((n) => byName.get(n)!).filter(Boolean);
  const results = await installEntries(env, entries);
  for (const r of results) {
    const verb = r.action === "updated" ? "Updated" : "Installed";
    env.logger.info(`${verb} ${r.name}@${r.version}`);
  }
}

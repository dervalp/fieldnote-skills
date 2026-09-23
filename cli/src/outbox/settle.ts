/**
 * Settle an outbox item: a human answered it.
 *
 * `settled.md` is append-only — an entry is never edited, so the record of who
 * decided what can be trusted. The whole item is kept byte for byte beside the
 * answer, because the open file is deleted.
 */
import { appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { UserError } from "../types.js";
import { parseItem, type OutboxItem } from "./item.js";
import { SETTLED_FILE } from "./store.js";

export const VERDICTS = ["agreed", "drifted"] as const;
export type Verdict = (typeof VERDICTS)[number];

export function isVerdict(value: unknown): value is Verdict {
  return typeof value === "string" && (VERDICTS as readonly string[]).includes(value);
}

export function fenceFor(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  return "`".repeat(Math.max(3, longest + 1));
}

function fenced(text: string): string {
  const fence = fenceFor(text);
  const body = text.endsWith("\n") ? text : text + "\n";
  return `${fence}text\n${body}${fence}`;
}

export function settledHeader(prd: string): string {
  return `# Settled outbox items — ${prd}\n\nAppend-only. Never edit an entry; a new answer is a new entry.\n`;
}

export function renderSettledEntry(a: {
  item: OutboxItem;
  itemText: string;
  answer: string;
  verdict: Verdict;
  date: string;
}): string {
  return [
    "",
    `<!-- fieldnote-outbox-settled: ${a.item.id} -->`,
    `## ${a.item.id}`,
    "",
    `- Verdict: ${a.verdict}`,
    `- Settled: ${a.date}`,
    `- Closed: ${a.verdict === "agreed" ? "yes" : "no"}`,
    `- Rank: ${a.item.rank}`,
    "",
    "Answer:",
    "",
    fenced(a.answer),
    "",
    "Item:",
    "",
    fenced(a.itemText),
    `<!-- /fieldnote-outbox-settled: ${a.item.id} -->`,
    "",
  ].join("\n");
}

export function settleItem(a: {
  root: string;
  outboxDir: string;
  file: string;
  verdict: Verdict;
  answer: string;
  date: string;
}): { settled: string; removed: string } {
  const abs = resolve(a.root, a.file);
  const outboxAbs = resolve(a.root, a.outboxDir);
  if (!abs.startsWith(outboxAbs + sep)) {
    throw new UserError(`${a.file} is not inside ${a.outboxDir} — nothing settled.`);
  }
  if (basename(abs) === SETTLED_FILE) {
    throw new UserError(`${SETTLED_FILE} is the record, not an item — nothing settled.`);
  }
  if (!existsSync(abs)) throw new UserError(`${a.file} does not exist.`);
  if (!a.answer.trim()) throw new UserError("The answer is empty — nothing settled.");

  const itemText = readFileSync(abs, "utf8");
  const parsed = parseItem(itemText, abs);
  if (!parsed.ok) {
    throw new UserError(`${a.file} cannot be settled:\n  ${parsed.errors.join("\n  ")}`);
  }

  const settledAbs = join(dirname(abs), SETTLED_FILE);
  if (!existsSync(settledAbs)) writeFileSync(settledAbs, settledHeader(basename(dirname(abs))));
  appendFileSync(
    settledAbs,
    renderSettledEntry({ item: parsed.value, itemText, answer: a.answer, verdict: a.verdict, date: a.date }),
  );
  unlinkSync(abs);
  return { settled: relative(a.root, settledAbs), removed: relative(a.root, abs) };
}

/** The loop's files on disk. Paths in and out are relative to the repository root. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseItem, rankOrder, type Rank } from "./item.js";

export const SETTLED_FILE = "settled.md";

function markdownIn(root: string, dir: string): string[] {
  const abs = join(root, dir);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return [];
  return readdirSync(abs)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => join(dir, name));
}

export function inboxFilePaths(root: string, inboxDir: string): string[] {
  return markdownIn(root, inboxDir).filter((p) => !p.endsWith("/README.md"));
}

export function itemFilePaths(root: string, outboxDir: string, id?: string): string[] {
  const abs = join(root, outboxDir);
  if (!existsSync(abs)) return [];
  const ids = id ? [id] : readdirSync(abs).filter((n) => statSync(join(abs, n)).isDirectory()).sort();
  return ids
    .flatMap((i) => markdownIn(root, join(outboxDir, i)))
    .filter((p) => !p.endsWith(`/${SETTLED_FILE}`));
}

export interface OpenItem {
  id: string;
  rank: Rank | "unparseable";
  decision: string;
  file: string;
}

/** Every open item of one PRD, worst first. An unparseable file is open: a broken file never hides. */
export function openItems(root: string, outboxDir: string, id: string): OpenItem[] {
  const items = itemFilePaths(root, outboxDir, id).map((file): OpenItem => {
    const parsed = parseItem(readFileSync(join(root, file), "utf8"), file);
    return parsed.ok
      ? { id: parsed.value.id, rank: parsed.value.rank, decision: parsed.value.decision, file }
      : { id: file, rank: "unparseable", decision: parsed.errors[0]!, file };
  });
  const weight = (r: OpenItem["rank"]) => (r === "unparseable" ? 3 : rankOrder(r));
  return items.sort((a, b) => weight(b.rank) - weight(a.rank) || a.id.localeCompare(b.id));
}

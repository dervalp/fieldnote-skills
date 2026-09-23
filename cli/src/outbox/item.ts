/**
 * An outbox item: one decision a slice took without asking.
 *
 * The rules here are the whole contract. Skills call the CLI rather than
 * restating them, so a rule changes in one place.
 */
import { basename, dirname } from "node:path";
import { splitFrontMatter } from "./frontmatter.js";

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export const RANKS = ["human-action", "high", "medium"] as const;
export type Rank = (typeof RANKS)[number];

export const ITEM_FIELDS = ["id", "prd", "slice", "rank", "bears-on", "raised", "wave"] as const;

export const ITEM_SECTIONS = [
  "What I had to decide",
  "What I did meanwhile",
  "What it costs to change later",
  "What I could not know",
] as const;

export const AUTHOR_MARK = "(author)";

const ORDER: Record<Rank, number> = { medium: 0, high: 1, "human-action": 2 };

export function rankOrder(rank: Rank): number {
  return ORDER[rank];
}

export function isRank(value: string): value is Rank {
  return (RANKS as readonly string[]).includes(value);
}

/** Any written rule the item bears on makes it at least `high`. A rank only goes up. */
export function floorRank(bearsOn: string, proposed: Rank): Rank {
  const floor: Rank = bearsOn.trim().toLowerCase() === "none" ? "medium" : "high";
  return ORDER[proposed] >= ORDER[floor] ? proposed : floor;
}

export interface OutboxItem {
  id: string;
  prd: string;
  slice: string;
  rank: Rank;
  bearsOn: string;
  raised: string;
  wave: string;
  /** The text of "What I had to decide" — the one line a board shows. */
  decision: string;
}

/** `## Heading` sections of a body, in order. Text before the first heading is ignored. */
export function parseSections(body: string): { heading: string; text: string }[] {
  const sections: { heading: string; text: string }[] = [];
  for (const line of body.split("\n")) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      sections.push({ heading: heading[1]!, text: "" });
    } else if (sections.length > 0) {
      sections[sections.length - 1]!.text += line + "\n";
    }
  }
  return sections.map((s) => ({ heading: s.heading, text: s.text.trim() }));
}

/**
 * Where an item sits must agree with what it says: its folder is its prd, and
 * its id starts with its slice. Checked by `outbox check`, not by parseItem,
 * so a misplaced item still lists as open.
 */
export function placementErrors(item: OutboxItem, file: string): string[] {
  const errors: string[] = [];
  const folder = basename(dirname(file));
  if (item.prd !== folder) errors.push(`prd "${item.prd}" does not match its folder "${folder}"`);
  if (!item.id.startsWith(`${item.slice}-`)) {
    errors.push(`id "${item.id}" does not start with its slice "${item.slice}-"`);
  }
  return errors;
}

export function parseItem(text: string, file: string): Parsed<OutboxItem> {
  const fm = splitFrontMatter(text);
  if ("error" in fm) return { ok: false, errors: [fm.error] };
  const f = fm.fields;
  const errors: string[] = [];

  for (const field of ITEM_FIELDS) {
    if (!f[field]) errors.push(`missing front matter field "${field}"`);
  }
  const stem = basename(file, ".md");
  if (f.id && f.id !== stem) {
    errors.push(`id "${f.id}" does not match the file name "${stem}"`);
  }
  if (f.rank && !isRank(f.rank)) {
    errors.push(`rank "${f.rank}" is not one of ${RANKS.join(", ")}`);
  }
  if (f.raised && !/^\d{4}-\d{2}-\d{2}$/.test(f.raised)) {
    errors.push(`raised "${f.raised}" is not a YYYY-MM-DD date`);
  }
  if (f.rank && isRank(f.rank) && f["bears-on"] && floorRank(f["bears-on"], f.rank) !== f.rank) {
    errors.push(
      `rank "${f.rank}" is below the floor: bears-on "${f["bears-on"]}" makes it at least high`,
    );
  }

  const sections = parseSections(fm.body);
  const found = sections.map((s) => s.heading);
  if (found.join("\u0000") !== ITEM_SECTIONS.join("\u0000")) {
    const want = ITEM_SECTIONS.map((h) => `"## ${h}"`).join(", ");
    const got = found.length ? found.map((h) => `"## ${h}"`).join(", ") : "none";
    errors.push(`sections must be exactly, in order: ${want} — found ${got}`);
  } else {
    for (const s of sections) {
      if (!s.text) errors.push(`section "## ${s.heading}" is empty`);
    }
    const last = sections[sections.length - 1]!;
    if (last.text && !last.text.startsWith(AUTHOR_MARK)) {
      errors.push(`section "## ${last.heading}" must begin with ${AUTHOR_MARK}`);
    }
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id: f.id!,
      prd: f.prd!,
      slice: f.slice!,
      rank: f.rank as Rank,
      bearsOn: f["bears-on"]!,
      raised: f.raised!,
      wave: f.wave!,
      decision: sections[0]!.text,
    },
  };
}

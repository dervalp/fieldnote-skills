/**
 * An inbox file: the spec of one feature, written once by the brainstorm.
 *
 * It never carries a status. Status is derived from pull requests; a status
 * written into a file is stale the moment it is committed.
 */
import { basename } from "node:path";
import { splitFrontMatter } from "./frontmatter.js";
import type { Parsed } from "./item.js";

export const INBOX_FIELDS = ["id", "title", "blocked-by", "plan", "tracker"] as const;
export const FORBIDDEN_INBOX_FIELDS = ["status", "branch", "priority", "value"] as const;
export const TRACKERS = ["github", "file"] as const;

export interface InboxFile {
  id: string;
  title: string;
  blockedBy: string[];
  plan: string | null;
  tracker: (typeof TRACKERS)[number];
  file: string;
}

export function parseInbox(text: string, file: string): Parsed<InboxFile> {
  const fm = splitFrontMatter(text);
  if ("error" in fm) return { ok: false, errors: [fm.error] };
  const f = fm.fields;
  const errors: string[] = [];

  for (const field of INBOX_FIELDS) {
    if (!f[field]) errors.push(`missing front matter field "${field}"`);
  }
  for (const field of FORBIDDEN_INBOX_FIELDS) {
    if (field in f) {
      errors.push(`"${field}" is not allowed: status is derived from pull requests, never written`);
    }
  }
  if (f.id && !/^\d+$/.test(f.id)) errors.push(`id "${f.id}" is not a number`);
  if (f.id && !basename(file).startsWith(`${f.id}-`)) {
    errors.push(`file name "${basename(file)}" does not start with "${f.id}-"`);
  }

  let blockedBy: string[] = [];
  const raw = f["blocked-by"];
  if (raw && raw !== "none") {
    if (!/^\[\s*\d+(\s*,\s*\d+)*\s*\]$/.test(raw)) {
      errors.push(`blocked-by "${raw}" is neither "none" nor a list like [966, 970]`);
    } else {
      blockedBy = raw.slice(1, -1).split(",").map((s) => s.trim());
    }
  }
  if (f.tracker && !(TRACKERS as readonly string[]).includes(f.tracker)) {
    errors.push(`tracker "${f.tracker}" is not one of ${TRACKERS.join(", ")}`);
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id: f.id!,
      title: f.title!,
      blockedBy,
      plan: f.plan === "none" ? null : f.plan!,
      tracker: f.tracker as InboxFile["tracker"],
      file,
    },
  };
}

/** Rules that need the whole inbox: ids unique, blockers resolve, plans exist. */
export function checkInboxSet(files: InboxFile[], planExists: (path: string) => boolean): string[] {
  const errors: string[] = [];
  const byId = new Map<string, InboxFile[]>();
  for (const f of files) byId.set(f.id, [...(byId.get(f.id) ?? []), f]);

  for (const [id, group] of byId) {
    if (group.length > 1) {
      errors.push(`${group[1]!.file}: id ${id} is used by more than one inbox file`);
    }
  }
  for (const f of files) {
    for (const blocker of f.blockedBy) {
      if (!byId.has(blocker)) errors.push(`${f.file}: blocked-by ${blocker} names no inbox file`);
    }
    if (f.plan && !planExists(f.plan)) errors.push(`${f.file}: plan "${f.plan}" does not exist`);
  }
  return errors;
}

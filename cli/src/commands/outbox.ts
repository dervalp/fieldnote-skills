/**
 * `fieldnote-skills outbox <check|open|settle|comment>` — the inbox and
 * outbox mechanics, callable by an agent or a person. No CI ships: a
 * repository that wants a gate wires `outbox open <id>` into its own.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loopConfig, type LoopConfig } from "../outbox/config.js";
import { checkInboxSet, parseInbox, type InboxFile } from "../outbox/inbox.js";
import { parseItem } from "../outbox/item.js";
import { inboxFilePaths, itemFilePaths, openItems } from "../outbox/store.js";
import { findGitRoot } from "../paths.js";
import { loadProfile } from "../profile.js";
import type { Logger } from "../types.js";
import { UserError } from "../types.js";

export interface OutboxDeps {
  cwd: string;
  logger: Logger;
  readStdin: () => string;
  today: () => string;
  gh: (args: string[]) => string;
}

interface Context {
  root: string;
  config: LoopConfig;
  deps: OutboxDeps;
}

function context(deps: OutboxDeps): Context {
  const root = findGitRoot(deps.cwd);
  if (!root) throw new UserError("outbox: not inside a git repository.");
  const config = loopConfig(loadProfile(root));
  for (const note of config.notes) deps.logger.info(note);
  return { root, config, deps };
}

function requireId(positionals: string[], usage: string): string {
  const id = positionals[0];
  if (!id) throw new UserError(`Usage: fieldnote-skills outbox ${usage}`);
  return id;
}

function check({ root, config, deps }: Context, id: string | undefined): number {
  const errors: string[] = [];
  const inbox: InboxFile[] = [];
  for (const file of inboxFilePaths(root, config.inbox)) {
    const parsed = parseInbox(readFileSync(join(root, file), "utf8"), file);
    if (parsed.ok) inbox.push(parsed.value);
    else errors.push(...parsed.errors.map((e) => `${file}: ${e}`));
  }
  errors.push(...checkInboxSet(inbox, (plan) => existsSync(join(root, plan))));

  if (config.outbox) {
    for (const file of itemFilePaths(root, config.outbox, id)) {
      const parsed = parseItem(readFileSync(join(root, file), "utf8"), file);
      if (!parsed.ok) errors.push(...parsed.errors.map((e) => `${file}: ${e}`));
    }
  }

  for (const e of errors) deps.logger.error(e);
  if (errors.length) return 1;
  deps.logger.output("Inbox and outbox are well-formed.");
  return 0;
}

function open({ root, config, deps }: Context, id: string, json: boolean): number {
  if (!config.outbox) {
    deps.logger.output("The outbox is off in this repository — nothing can be open.");
    return 0;
  }
  const items = openItems(root, config.outbox, id);
  if (json) {
    deps.logger.output(JSON.stringify(items));
  } else if (items.length === 0) {
    deps.logger.output(`No open outbox items for ${id}.`);
  } else {
    for (const i of items) deps.logger.output(`- [${i.rank}] ${i.id} — ${i.decision.split("\n")[0]}`);
  }
  return items.length === 0 ? 0 : 1;
}

export async function runOutbox(
  sub: string | undefined,
  positionals: string[],
  flags: Record<string, string | boolean>,
  deps: OutboxDeps,
): Promise<number> {
  switch (sub) {
    case "check":
      return check(context(deps), positionals[0]);
    case "open": {
      const id = requireId(positionals, "open <id>");
      return open(context(deps), id, Boolean(flags.json));
    }
    default:
      throw new UserError(
        `Unknown outbox command "${sub ?? ""}". Use check, open, settle or comment.`,
      );
  }
}

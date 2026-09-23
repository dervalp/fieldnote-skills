/**
 * `fieldnote-skills outbox <check|open|settle|comment>` — the inbox and
 * outbox mechanics, callable by an agent or a person. No CI ships: a
 * repository that wants a gate wires `outbox open <id>` into its own.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { formatOutboxComment, ghIssueComments, upsertOutboxComment } from "../outbox/comment.js";
import { loopConfig, type LoopConfig } from "../outbox/config.js";
import { checkInboxSet, parseInbox, type InboxFile } from "../outbox/inbox.js";
import { parseItem, placementErrors } from "../outbox/item.js";
import { resolveVerdict, settleItem } from "../outbox/settle.js";
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

/**
 * With no id, every inbox file and every item. With an id, only that spec:
 * its inbox file(s) — whose blockers still resolve against every inbox file —
 * and its items, so another spec's broken file never reds this one.
 */
function check({ root, config, deps }: Context, id: string | undefined): number {
  const errors: string[] = [];
  const inbox: InboxFile[] = [];
  for (const file of inboxFilePaths(root, config.inbox)) {
    const parsed = parseInbox(readFileSync(join(root, file), "utf8"), file);
    if (parsed.ok) inbox.push(parsed.value);
    else if (id === undefined || basename(file).startsWith(`${id}-`)) {
      errors.push(...parsed.errors.map((e) => `${file}: ${e}`));
    }
  }
  errors.push(...checkInboxSet(inbox, (plan) => existsSync(join(root, plan)), id));

  if (config.outbox) {
    for (const file of itemFilePaths(root, config.outbox, id)) {
      const parsed = parseItem(readFileSync(join(root, file), "utf8"), file);
      const found = parsed.ok ? placementErrors(parsed.value, file) : parsed.errors;
      errors.push(...found.map((e) => `${file}: ${e}`));
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

function settle(
  { root, config, deps }: Context,
  file: string,
  flags: Record<string, string | boolean>,
): number {
  if (!config.outbox) throw new UserError("The outbox is off in this repository — nothing to settle.");
  if (typeof flags.answer !== "string" || !flags.answer) {
    throw new UserError("--answer <file|-> is required: the answer is kept verbatim.");
  }
  const answer = flags.answer === "-" ? deps.readStdin() : readAnswerFile(deps.cwd, flags.answer);
  const verdict = resolveVerdict(flags.verdict, answer);
  const relFile = isAbsolute(file) ? file : join(deps.cwd, file);
  const r = settleItem({
    root,
    outboxDir: config.outbox,
    file: relFile,
    verdict,
    answer,
    date: deps.today(),
  });
  const id = basename(r.removed, ".md");
  deps.logger.output(`Settled ${id} (${verdict}).`);
  deps.logger.output(`Appended to ${r.settled}, removed ${r.removed} — commit both in one commit.`);
  return 0;
}

function readAnswerFile(cwd: string, path: string): string {
  try {
    return readFileSync(isAbsolute(path) ? path : join(cwd, path), "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? "error";
    throw new UserError(`The answer file ${path} cannot be read (${code}) — nothing settled.`);
  }
}

/** gh, with its failure turned into a plain message instead of a stack trace. */
function plainGh(gh: OutboxDeps["gh"]): OutboxDeps["gh"] {
  return (args) => {
    try {
      return gh(args);
    } catch (err) {
      const message = err instanceof Error ? err.message.trim() : String(err);
      throw new UserError(`gh failed: ${message}`);
    }
  };
}

function comment({ root, config, deps }: Context, id: string): number {
  if (config.tracker.kind !== "github") {
    deps.logger.output("The tracker is not GitHub — the outbox lives in its files and the feature pull request.");
    return 0;
  }
  if (!config.outbox) {
    deps.logger.output("The outbox is off in this repository — no comment to keep.");
    return 0;
  }
  const gh = plainGh(deps.gh);
  const repoName =
    config.tracker.repo ?? gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]).trim();
  const body = formatOutboxComment(id, openItems(root, config.outbox, id));
  const result = upsertOutboxComment(ghIssueComments(gh, repoName, id), body);
  deps.logger.output(`Outbox comment on ${repoName}#${id}: ${result}.`);
  return 0;
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
    case "settle": {
      const file = requireId(positionals, "settle <item-file> --answer <file|-> [--verdict agreed|drifted]");
      return settle(context(deps), file, flags);
    }
    case "comment": {
      const id = requireId(positionals, "comment <id>");
      return comment(context(deps), id);
    }
    default:
      throw new UserError(
        `Unknown outbox command "${sub ?? ""}". Use check, open, settle or comment.`,
      );
  }
}

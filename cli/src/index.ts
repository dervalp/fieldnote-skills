#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseArgs } from "./args.js";
import { resolveEnv } from "./paths.js";
import { selectAgentHomes } from "./agent-homes.js";
import { InquirerPrompter } from "./prompter.js";
import { ConsoleLogger } from "./logger.js";
import { runList } from "./commands/list.js";
import { runInstall } from "./commands/install.js";
import { runUpdate, runSync } from "./commands/update.js";
import { runDoctor } from "./commands/doctor.js";
import { runInit } from "./commands/init.js";
import { runOutbox } from "./commands/outbox.js";
import { renderBanner } from "./banner.js";
import { UserError } from "./types.js";
import { chalkStderr } from "chalk";

const HELP = `fieldnote-skills — install the delivery-loop skills for your coding agent

Usage:
  fieldnote-skills [list]            Install everything, or pick (default)
  fieldnote-skills --all             Install every skill, no prompts
  fieldnote-skills install <name…>   Install named skills (non-interactive)
                  [--yes] [--json]
  fieldnote-skills update [name…]    Update installed skills (outdated pre-checked)
  fieldnote-skills sync [--json]     Update outdated + report newly available
  fieldnote-skills doctor            Report release drift per agent home
                  [--strict] [--json]
  fieldnote-skills init              Scaffold .fieldnote/profile.md from this repo
                  [--force] [--print]
  fieldnote-skills outbox check [<id>]         Validate inbox files and outbox items
                                               (with <id>: that spec only)
  fieldnote-skills outbox open <id> [--json]   List a PRD's open outbox items (exit 1 if any)
  fieldnote-skills outbox settle <item-file>   Settle one item with a human's answer
                  --answer <file|-> [--verdict agreed|drifted]
                  (the verdict: the answer's "Verdict: agreed|drifted"
                  line, the flag, or both when they agree)
  fieldnote-skills outbox comment <id>         Upsert the outbox comment on the PRD issue

Flags:
  --all         Install every skill without prompting (honours --stage)
  --stage       Filter list by setup, plan, build, review, or all
  --agent       Install for one agent only: claude or codex. Default: every
                agent home found (~/.claude, ~/.codex)
  --yes, -y     Skip confirmation prompts
  --json        Machine-readable output
  --force       Overwrite an existing .fieldnote/profile.md
  --print       Print the probed profile to stdout; write nothing
  --help, -h    Show this help

To author a skill, open a pull request against dervalp/fieldnote-skills.
`;

async function main(): Promise<number> {
  const { command, positionals, flags } = parseArgs(process.argv.slice(2));
  const logger = new ConsoleLogger();

  // Decorative banner → stderr only, and only on human-facing entry points
  // (help text and the default interactive picker). Never on --json, --all, or
  // the non-interactive install/update/sync paths, so machine output stays
  // clean — `--all` exists precisely to be run without a human watching.
  const showBanner = flags.help || (command === "list" && !flags.json && !flags.all);
  if (showBanner) {
    logger.info(renderBanner(chalkStderr));
  }

  if (flags.help) {
    logger.output(HELP);
    return 0;
  }

  if (command === "outbox") {
    const [sub, ...rest] = positionals;
    return await runOutbox(sub, rest, flags, {
      cwd: process.cwd(),
      logger,
      readStdin: () => readFileSync(0, "utf8"),
      today: () => new Date().toISOString().slice(0, 10),
      gh: (args) => execFileSync("gh", args, { encoding: "utf8" }),
    });
  }

  const base = resolveEnv({
    prompter: new InquirerPrompter(),
    logger,
  });
  // `--agent` narrows the run; without it every agent home found gets the
  // skills. agentDir follows, so the single-home helpers stay consistent.
  const agentHomes = selectAgentHomes(
    base.agentHomes,
    typeof flags.agent === "string" ? flags.agent : undefined,
  );
  const env = { ...base, agentHomes, agentDir: agentHomes[0]!.root };

  switch (command) {
    case "list":
      await runList(env, {
        stage: typeof flags.stage === "string" ? flags.stage : undefined,
        all: Boolean(flags.all),
      });
      return 0;
    case "install":
      await runInstall(env, positionals, { yes: Boolean(flags.yes), json: Boolean(flags.json) });
      return 0;
    case "update":
      await runUpdate(env, positionals);
      return 0;
    case "sync":
      await runSync(env, { json: Boolean(flags.json) });
      return 0;
    case "doctor":
      return await runDoctor(env, {
        strict: Boolean(flags.strict),
        json: Boolean(flags.json),
      });
    case "init":
      return await runInit(env, { force: Boolean(flags.force), print: Boolean(flags.print) });
    default:
      logger.error(`Unknown command "${command}".`);
      logger.output(HELP);
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    const logger = new ConsoleLogger();
    if (err instanceof UserError) {
      logger.error(err.message);
    } else {
      logger.error(`Unexpected error: ${(err as Error).stack ?? err}`);
    }
    process.exit(1);
  });

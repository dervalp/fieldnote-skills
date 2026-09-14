#!/usr/bin/env node
import { parseArgs } from "./args.js";
import { resolveEnv } from "./paths.js";
import { InquirerPrompter } from "./prompter.js";
import { ConsoleLogger } from "./logger.js";
import { runList } from "./commands/list.js";
import { runInstall } from "./commands/install.js";
import { runUpdate, runSync } from "./commands/update.js";
import { runDoctor } from "./commands/doctor.js";
import { runInit } from "./commands/init.js";
import { renderBanner } from "./banner.js";
import { UserError } from "./types.js";
import { chalkStderr } from "chalk";

const HELP = `fieldnote-skills — install shared Claude Code skills into ~/.claude

Usage:
  fieldnote-skills [list]            Interactive stage + checkbox picker (default)
  fieldnote-skills install <name…>   Install named skills (non-interactive)
                  [--yes] [--json]
  fieldnote-skills update [name…]    Update installed skills (outdated pre-checked)
  fieldnote-skills sync [--json]     Update outdated + report newly available
  fieldnote-skills doctor            Report release drift across all surfaces
                  [--strict] [--json]
  fieldnote-skills init              Scaffold .fieldnote/profile.md from this repo

Flags:
  --stage       Filter list by plan, build, review, or all
  --yes, -y     Skip confirmation prompts
  --json        Machine-readable output
  --help, -h    Show this help

To author a skill, open a pull request against dervalp/fieldnote-skills.
`;

async function main(): Promise<number> {
  const { command, positionals, flags } = parseArgs(process.argv.slice(2));
  const logger = new ConsoleLogger();

  // Decorative banner → stderr only, and only on human-facing entry points
  // (help text and the default interactive picker). Never on --json or the
  // non-interactive install/update/sync paths, so machine output stays clean.
  const showBanner = flags.help || (command === "list" && !flags.json);
  if (showBanner) {
    logger.info(renderBanner(chalkStderr));
  }

  if (flags.help) {
    logger.output(HELP);
    return 0;
  }

  const env = resolveEnv({
    prompter: new InquirerPrompter(),
    logger,
  });

  switch (command) {
    case "list":
      await runList(env, { stage: typeof flags.stage === "string" ? flags.stage : undefined });
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
      return await runInit(env, { force: Boolean(flags.force) });
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

#!/usr/bin/env node
import { parseArgs } from "./args.js";
import { resolveEnv } from "./paths.js";
import { InquirerPrompter } from "./prompter.js";
import { ConsoleLogger } from "./logger.js";
import { runList } from "./commands/list.js";
import { runInstall } from "./commands/install.js";
import { runUpdate, runSync } from "./commands/update.js";
import { runDoctor } from "./commands/doctor.js";
import { renderBanner } from "./banner.js";
import { UserError } from "./types.js";
import { chalkStderr } from "chalk";

const HELP = `vertuoza-skills — install shared Claude Code skills into ~/.claude

Usage:
  vertuoza-skills [list]            Interactive category + checkbox picker (default)
  vertuoza-skills install <name…>   Install named skills (non-interactive)
                  [--yes] [--json]
  vertuoza-skills update [name…]    Update installed skills (outdated pre-checked)
  vertuoza-skills sync [--json]     Update outdated + report newly available
  vertuoza-skills doctor            Report release drift across all surfaces
                  [--orchestrator <path>] [--strict] [--json]

Flags:
  --category    Filter list by product, engineer, qa, or all
  --yes, -y     Skip confirmation prompts
  --json        Machine-readable output
  --help, -h    Show this help

To author a new skill, open a PR against the vertuo-ai-os repo on GitHub.
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
      await runList(env, { category: typeof flags.category === "string" ? flags.category : undefined });
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
        orchestrator: typeof flags.orchestrator === "string" ? flags.orchestrator : undefined,
        strict: Boolean(flags.strict),
        json: Boolean(flags.json),
      });
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

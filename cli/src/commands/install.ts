import { loadCatalog, requireSkill } from "../catalog.js";
import { installEverywhere, type InstallResult } from "../installer.js";
import { join } from "node:path";
import type { Env } from "../types.js";
import { UserError } from "../types.js";

export interface InstallFlags {
  yes?: boolean;
  json?: boolean;
}

/** Non-interactive `install <name...>` — installs named skills without prompting. */
export async function runInstall(env: Env, names: string[], flags: InstallFlags): Promise<void> {
  if (names.length === 0) {
    throw new UserError("install requires at least one skill name. Try `fieldnote-skills list`.");
  }
  const catalog = await loadCatalog(env);
  const entries = names.map((name) => requireSkill(catalog, name));
  const results = await installEverywhere(env, entries);
  reportInstall(env, results, flags);
}

export function reportInstall(env: Env, results: InstallResult[], flags: InstallFlags): void {
  if (flags.json) {
    env.logger.output(JSON.stringify({ installed: results }, null, 2));
    return;
  }
  if (results.length === 0) {
    env.logger.info("Nothing to install.");
    return;
  }

  const line = (r: InstallResult): string =>
    `${r.action === "updated" ? "Updated" : "Installed"} ${r.name}@${r.version}`;

  // One agent on the machine is the ordinary case, and its output stays
  // exactly what it always was. Only a run that touched more than one agent
  // pays for the grouping.
  if (env.agentHomes.length === 1) {
    for (const r of results) env.logger.info(line(r));
    return;
  }
  for (const home of env.agentHomes) {
    const mine = results.filter((r) => r.agent === home.agent);
    if (mine.length === 0) continue;
    env.logger.info(`${home.agent} — ${join(home.root, "skills")}`);
    for (const r of mine) env.logger.info(`  ${line(r)}`);
  }
}

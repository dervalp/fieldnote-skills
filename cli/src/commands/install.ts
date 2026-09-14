import { loadCatalog, requireSkill } from "../catalog.js";
import { installEntries, type InstallResult } from "../installer.js";
import type { Env } from "../types.js";
import { UserError } from "../types.js";

export interface InstallFlags {
  yes?: boolean;
  json?: boolean;
}

/** Non-interactive `install <name...>` — installs named skills without prompting. */
export async function runInstall(env: Env, names: string[], flags: InstallFlags): Promise<void> {
  if (names.length === 0) {
    throw new UserError("install requires at least one skill name. Try `vertuoza-skills list`.");
  }
  const catalog = await loadCatalog(env);
  const entries = names.map((name) => requireSkill(catalog, name));
  const results = await installEntries(env, entries);
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
  for (const r of results) {
    const verb = r.action === "updated" ? "Updated" : "Installed";
    env.logger.info(`${verb} ${r.name}@${r.version}`);
  }
}

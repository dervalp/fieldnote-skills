import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Env, Logger, Prompter } from "./types.js";

/** Directory of the installed package (one level up from dist/ or src/). */
function packageDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

/**
 * Walk up from `start` looking for the root of THIS repo, identified by the
 * skills/ tree plus cli/package.json. Returns null when run outside a clone
 * (the normal case for an engineer running the published package).
 */
export function findRepoRoot(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 40; i++) {
    if (existsSync(join(dir, "skills")) && existsSync(join(dir, "cli", "package.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Resolve the runtime environment from the real filesystem. */
export function resolveEnv(deps: {
  prompter: Prompter;
  logger: Logger;
  cwd?: string;
}): Env {
  const cwd = deps.cwd ?? process.cwd();
  // Where the user is standing, recorded for anything that needs the clone the
  // user is working in. Note the catalog below deliberately does NOT come from
  // here.
  const repoRoot = findRepoRoot(cwd);

  // Where the executing code lives decides the catalog: running a clone's
  // own binary means developer mode (use the clone's catalog and skills);
  // an installed/npx package always uses what it bundled. Keying this off
  // cwd instead used to make `npx … sync` inside a stale clone silently
  // serve that clone's old catalog while claiming everything was current.
  const pkg = packageDir();
  const pkgRepoRoot = findRepoRoot(pkg);
  const catalogPath = pkgRepoRoot
    ? join(pkgRepoRoot, "catalog.json")
    : join(pkg, "catalog.json");
  const skillsSourceDir = pkgRepoRoot ? join(pkgRepoRoot, "skills") : join(pkg, "skills");

  const claudeDir = process.env.VERTUOZA_CLAUDE_DIR ?? join(homedir(), ".claude");

  return {
    claudeDir,
    catalogPath,
    skillsSourceDir,
    repoRoot,
    prompter: deps.prompter,
    logger: deps.logger,
  };
}

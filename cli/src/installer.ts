import { cp, mkdir, rm, rename, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type { Env, SkillEntry } from "./types.js";
import { UserError } from "./types.js";
import { readManifest, recordInstalled } from "./manifest.js";
import { shipsInSkill } from "./skill-model.js";
import { hashSkillDir, readRelease } from "./lock.js";

/** Where a skill's source files live: skills/<name>/. */
export function sourceDirFor(env: Env, entry: SkillEntry): string {
  return join(env.skillsSourceDir, entry.name);
}

/** Where a skill is installed: ~/.claude/skills/<name>/. */
export function targetDirFor(env: Env, name: string): string {
  return join(env.claudeDir, "skills", name);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Install one skill into ~/.claude atomically.
 *
 * Files are staged in a sibling temp dir and only swapped into place once the
 * full copy succeeds. If anything fails the previous version is restored, so a
 * failed install never leaves a half-written skill behind. Whole folders
 * (including commands/agents/hooks) are copied, so multi-folder code skills
 * install with the same guarantee. Dev-only folders (tests/) never install —
 * they matter only when running from a repo clone, since the npm bundle
 * already excludes them at pack time.
 */
export async function installSkill(env: Env, entry: SkillEntry): Promise<void> {
  const source = sourceDirFor(env, entry);
  if (!(await exists(source))) {
    throw new UserError(
      `Skill source for "${entry.name}" not found at ${source}. ` +
        `The package bundle may be incomplete.`,
    );
  }

  const target = targetDirFor(env, entry.name);
  const skillsRoot = join(env.claudeDir, "skills");
  await mkdir(skillsRoot, { recursive: true });

  const suffix = `${process.pid}-${Date.now()}`;
  const staging = join(skillsRoot, `.staging-${entry.name}-${suffix}`);
  const backup = join(skillsRoot, `.backup-${entry.name}-${suffix}`);

  let movedToBackup = false;
  try {
    await cp(source, staging, {
      recursive: true,
      filter: (src) => shipsInSkill(relative(source, src)),
    });

    if (await exists(target)) {
      await rename(target, backup);
      movedToBackup = true;
    }
    await rename(staging, target);
  } catch (err) {
    // Roll back: drop the partial staging copy and restore any prior version.
    await rm(staging, { recursive: true, force: true });
    if (movedToBackup && !(await exists(target))) {
      await rename(backup, target).catch(() => undefined);
    }
    throw new UserError(
      `Failed to install "${entry.name}": ${(err as Error).message}. No changes were left behind.`,
    );
  } finally {
    await rm(backup, { recursive: true, force: true }).catch(() => undefined);
    await rm(staging, { recursive: true, force: true }).catch(() => undefined);
  }

  // Hash the installed copy, not the source: that is what `doctor` compares
  // against, so a file lost in the copy shows up as modified rather than ok.
  // release.json sits beside the catalog in both modes (repo clone and bundled
  // package), which is the same anchor doctor uses to find the lock.
  const { coreHash } = hashSkillDir(target);
  await recordInstalled(env, entry, { release: readRelease(dirname(env.catalogPath)), coreHash });
}

export interface InstallResult {
  name: string;
  version: string;
  action: "installed" | "updated";
}

/**
 * Install a set of catalog entries into ~/.claude, one atomically at a time.
 * Returns a per-skill result (installed vs updated). Shared core behind the
 * interactive picker and the non-interactive `install` command.
 */
export async function installEntries(env: Env, entries: SkillEntry[]): Promise<InstallResult[]> {
  const before = await readManifest(env);
  const results: InstallResult[] = [];
  for (const entry of entries) {
    const wasInstalled = Boolean(before.skills[entry.name]);
    await installSkill(env, entry);
    results.push({
      name: entry.name,
      version: entry.version,
      action: wasInstalled ? "updated" : "installed",
    });
  }
  return results;
}

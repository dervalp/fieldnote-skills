/**
 * Reading the engineer's ~/.claude/skills tree — the one directory this CLI
 * does not own. It holds skills installed by hand, symlinks into repos that
 * have since moved, and whatever else a developer put there, so every step
 * here is defensive: one broken entry must degrade to "unreadable" for that
 * one skill, never abort the command.
 *
 * Shared by `doctor` (which reports drift) and `sync` (which acts on it), so
 * the two can never disagree about what is on disk.
 */
import { lstat, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { hashSkillDirSafe } from "./lock.js";
import type { Env } from "./types.js";

export interface InstalledTree {
  /** Absolute path of the skills root that was scanned. */
  root: string;
  /** Directory name -> coreHash, for every skill folder we could hash fully. */
  coreHash: Map<string, string>;
  /** Skill folders present but not fully hashable (permissions, dangling symlink). */
  unreadable: Map<string, string[]>;
  /** Every skill directory name on disk, hashable or not, sorted. */
  names: string[];
}

/**
 * Hash every skill folder under ~/.claude/skills as it sits right now.
 *
 * A skill whose tree could not be read completely lands in `unreadable` and
 * NOT in `coreHash`: a partially-computed hash would compare as `modified`,
 * blaming the engineer for an edit they never made.
 */
export async function scanInstalledSkills(env: Env): Promise<InstalledTree> {
  const root = join(env.claudeDir, "skills");
  const tree: InstalledTree = { root, coreHash: new Map(), unreadable: new Map(), names: [] };

  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return tree; // nothing installed yet, or no ~/.claude at all
  }

  for (const name of entries.sort()) {
    if (name.startsWith(".")) continue; // .vertuoza-skills.json and friends
    const path = join(root, name);

    let isSymlink = false;
    try {
      isSymlink = (await lstat(path)).isSymbolicLink();
    } catch {
      // Vanished between readdir and lstat, or unreadable: report, don't guess.
      tree.names.push(name);
      tree.unreadable.set(name, ["."]);
      continue;
    }

    let isDirectory: boolean;
    try {
      isDirectory = (await stat(path)).isDirectory();
    } catch {
      // A symlink whose target is gone — the everyday result of symlinking a
      // skill out of a repo that moved. Say so instead of skipping silently.
      if (isSymlink) {
        tree.names.push(name);
        tree.unreadable.set(name, ["(dangling symlink)"]);
      }
      continue;
    }
    if (!isDirectory) continue; // a loose file in the skills root is not a skill

    tree.names.push(name);
    let result: ReturnType<typeof hashSkillDirSafe>;
    try {
      result = hashSkillDirSafe(path);
    } catch {
      tree.unreadable.set(name, ["."]);
      continue;
    }
    if (result.unreadable.length > 0) tree.unreadable.set(name, result.unreadable);
    else tree.coreHash.set(name, result.coreHash);
  }

  return tree;
}

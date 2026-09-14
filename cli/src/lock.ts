/**
 * skills.lock.json — the machine half of the parity contract (ADR-0010).
 *
 * Per skill: its version, its provenance when vendored, a per-file hash map
 * tagged with the file's role, and a coreHash over the `prompt` files only.
 * coreHash deliberately excludes `tooling` files (scripts/) so that any system
 * that vendors prompt content only can match a Claude Code install exactly,
 * instead of differing by design.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, type Dirent } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import type { FileRole, Skill } from "./skill-model.js";
import { fileRole, shipsInSkill } from "./skill-model.js";

export interface FileHash {
  role: FileRole;
  hash: string;
}

export interface LockEntry {
  name: string;
  version: string;
  vendored?: Record<string, string>;
  /** From the vendored block: the upstream body hash *before* our rewrite. */
  upstreamBodyHash?: string;
  /** Hash of the shipped body, *after* the reference rewrite. */
  bodyHash?: string;
  coreHash: string;
  files: Record<string, FileHash>;
  /** Unmanaged skill folder names this skill replaces (ADR-0009). */
  supersedes?: string[];
}

export interface Lock {
  release: string;
  skills: LockEntry[];
}

export function sha256(input: string | Buffer): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

/** Everything after the closing frontmatter fence; the input itself if none. */
export function bodyOf(text: string): string {
  if (!text.startsWith("---")) return text;
  const end = text.indexOf("---", 3);
  if (end === -1) return text;
  return text.slice(end + 3);
}

/**
 * Every shipping file under a skill folder, as sorted forward-slash paths.
 *
 * `unreadable` decides the failure mode. Omit it — the generation path, where
 * a broken repo skill must fail `npm run catalog` loudly — and any I/O error
 * propagates. Pass it — the read-the-user's-machine path — and each failing
 * entry is recorded and skipped, so one dangling symlink under ~/.claude
 * cannot abort a whole `doctor` run. Callers must treat a non-empty
 * `unreadable` as "cannot compare", never as a hash: a silently partial hash
 * would read as `modified`, which is a different and worse lie.
 */
function walk(dir: string, base = dir, unreadable?: string[]): string[] {
  const relOf = (abs: string): string => relative(base, abs).split(sep).join("/") || ".";
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (unreadable === undefined) throw err;
    unreadable.push(relOf(dir));
    return [];
  }

  const out: string[] = [];
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    const rel = relOf(abs);
    if (!shipsInSkill(rel)) continue;
    try {
      if (entry.isDirectory()) out.push(...walk(abs, base, unreadable));
      // statSync (not entry.isFile()) so a symlink to a real file still counts;
      // it is also what throws on a dangling one.
      else if (statSync(abs).isFile()) out.push(rel);
    } catch (err) {
      if (unreadable === undefined) throw err;
      unreadable.push(rel);
    }
  }
  return out.sort();
}

function hashDir(
  skillDir: string,
  unreadable?: string[],
): { files: Record<string, FileHash>; coreHash: string } {
  const files: Record<string, FileHash> = {};
  const coreParts: string[] = [];
  for (const rel of walk(skillDir, skillDir, unreadable)) {
    const role = fileRole(rel);
    let hash: string;
    try {
      hash = sha256(readFileSync(join(skillDir, rel)));
    } catch (err) {
      if (unreadable === undefined) throw err;
      unreadable.push(rel);
      continue;
    }
    files[rel] = { role, hash };
    if (role === "prompt") coreParts.push(`${rel} ${hash}`);
  }
  return { files, coreHash: sha256(coreParts.join("\n")) };
}

/**
 * Hash every shipping file under a skill folder, and the prompt subset.
 * Strict: any unreadable file or directory throws. Used when generating the
 * lock and when recording a just-written install, where silence would ship a
 * wrong hash.
 */
export function hashSkillDir(skillDir: string): { files: Record<string, FileHash>; coreHash: string } {
  return hashDir(skillDir);
}

/**
 * The same hash, computed defensively for a directory we do not control (a
 * user's ~/.claude/skills). `unreadable` lists the entries that could not be
 * read; when it is non-empty the hashes are partial and the skill must be
 * reported as unreadable rather than compared.
 */
export function hashSkillDirSafe(
  skillDir: string,
): { files: Record<string, FileHash>; coreHash: string; unreadable: string[] } {
  const unreadable: string[] = [];
  const { files, coreHash } = hashDir(skillDir, unreadable);
  return { files, coreHash, unreadable };
}

export function computeLockEntry(skill: Skill): LockEntry {
  const { files, coreHash } = hashSkillDir(dirname(skill.path));

  const entry: LockEntry = {
    name: skill.name || skill.folderName,
    version: skill.version,
    coreHash,
    files,
  };

  const vendored = skill.vendored;
  if (vendored !== null) {
    entry.vendored = vendored;
    const upstreamBodyHash = vendored["upstreamBodyHash"];
    if (upstreamBodyHash !== undefined) entry.upstreamBodyHash = upstreamBodyHash;
    entry.bodyHash = sha256(bodyOf(readFileSync(skill.path, "utf8")));
  }
  if (skill.supersedes.length > 0) entry.supersedes = skill.supersedes;
  return entry;
}

/** Build the whole lock from discovered skills plus the current release. */
export function buildLock(skills: Skill[], release: string): Lock {
  return { release, skills: skills.map(computeLockEntry) };
}

/** Read the tracked, non-generated release string (release.json). */
export function readRelease(repoRoot: string): string {
  try {
    const parsed = JSON.parse(readFileSync(join(repoRoot, "release.json"), "utf8")) as { release?: string };
    return typeof parsed.release === "string" && parsed.release !== "" ? parsed.release : "unreleased";
  } catch {
    return "unreleased";
  }
}

export function renderLock(lock: Lock): string {
  const skills = [...lock.skills].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return JSON.stringify({ release: lock.release, skills }, null, 2) + "\n";
}

export function readLock(path: string): Lock | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Lock;
    return Array.isArray(parsed.skills) ? parsed : null;
  } catch {
    return null;
  }
}

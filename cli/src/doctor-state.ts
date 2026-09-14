/**
 * Pure classification of what is installed against what the release says
 * should be. No filesystem, no printing — the command layer
 * gathers the inputs and renders the output, so every state is testable.
 *
 * This module is also the single definition of "orphan", shared by `doctor`
 * (which reports) and `sync` (which acts): the two used to disagree, and the
 * one that acts was the one that was wrong.
 */
import type { Lock } from "./lock.js";
import type { Manifest } from "./types.js";

/**
 * - `ok` — recorded release matches the lock, and the bytes match its coreHash.
 * - `behind` — recorded release is not the lock's release.
 * - `divergent` — recorded release *is* the lock's release, but the content
 *   hash is not. The label says current, the bytes disagree. This is the case
 *   per-skill content hashes exist to catch, and it is deliberately not
 *   folded into `behind`: printing "behind skills-v1.0.0" next to a recorded
 *   release of skills-v1.0.0 contradicts itself on screen, and the remedy
 *   message differs.
 * - `modified` — on-disk bytes differ from what this CLI recorded at install
 *   time, i.e. someone edited the copy. Outranks the two above: reinstalling
 *   would silently discard their work.
 * - `unreadable` — the tree could not be read in full, so no comparison is
 *   possible. Never silently hashed as partial, which would read as `modified`.
 * - `orphaned` — installed (or simply present) but absent from the catalog.
 */
export type SkillState = "ok" | "behind" | "divergent" | "modified" | "unreadable" | "orphaned";

export interface DoctorRow {
  name: string;
  installedVersion: string | null;
  installedRelease: string | null;
  state: SkillState;
  /** For an orphan, the vendored skill that replaced it, when known. */
  supersededBy?: string;
  /** Extra context for the state (e.g. which files could not be read). */
  detail?: string;
  /**
   * Whether `sync` may delete this directory: true only for a skill this CLI
   * installed (it has a manifest entry) or one a `supersedes:` entry claims
   * by name. Anything else on disk was put there by a human and is reported
   * but left alone.
   */
  removable?: boolean;
}

/** Invert every skill's `supersedes` list: old name -> its replacement. */
export function supersedesMap(lock: Lock): Map<string, string> {
  const map = new Map<string, string>();
  for (const skill of lock.skills) {
    for (const old of skill.supersedes ?? []) map.set(old, skill.name);
  }
  return map;
}

/**
 * The names the current release ships: the lock, plus the catalog when the
 * caller has it. Both commands derive their `known` set here so neither can
 * quietly widen or narrow what counts as an orphan.
 */
export function knownSkillNames(lock: Lock | null, catalogNames: Iterable<string> = []): Set<string> {
  const known = new Set<string>();
  for (const skill of lock?.skills ?? []) known.add(skill.name);
  for (const name of catalogNames) known.add(name);
  return known;
}

/** A skill directory the current release does not know about. */
export interface OrphanSkill {
  name: string;
  /** The vendored skill that replaced it, when a `supersedes:` claims the name. */
  supersededBy?: string;
  /** True when this CLI installed it, or a `supersedes:` entry claims the name. */
  removable: boolean;
}

/**
 * Every skill directory the release no longer knows about: manifest entries
 * that dropped out of the catalog, plus directories on disk this CLI never
 * installed (a Pocock skill copied in by hand, a symlink into someone's repo).
 *
 * `removable` is the safety boundary. A real developer machine holds ~25
 * unmanaged directories, some installed deliberately; `sync` follows this list
 * with `rm -rf`, so only entries we can prove are ours — a manifest entry, or
 * a name a vendored skill explicitly `supersedes` — may be offered for
 * removal. Everything else is reported and left where it is.
 */
export function findOrphans(args: {
  manifest: Manifest;
  known: ReadonlySet<string>;
  supersedes: ReadonlyMap<string, string>;
  onDiskNames?: Iterable<string>;
}): OrphanSkill[] {
  const { manifest, known, supersedes, onDiskNames = [] } = args;
  const orphans = new Map<string, OrphanSkill>();

  const add = (name: string, tracked: boolean): void => {
    if (known.has(name)) return;
    const supersededBy = supersedes.get(name);
    const existing = orphans.get(name);
    const removable = tracked || supersededBy !== undefined;
    if (existing !== undefined) {
      existing.removable = existing.removable || removable;
      return;
    }
    const orphan: OrphanSkill = { name, removable };
    if (supersededBy !== undefined) orphan.supersededBy = supersededBy;
    orphans.set(name, orphan);
  };

  for (const name of Object.keys(manifest.skills)) add(name, true);
  for (const name of onDiskNames) add(name, false);

  return [...orphans.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export function classifyInstalled(args: {
  lock: Lock;
  manifest: Manifest;
  /** Hash of each installed skill folder as it sits on disk right now. */
  onDiskCoreHash: Map<string, string>;
  supersedes: Map<string, string>;
  /**
   * Skill directory names actually present on disk right now, whether or
   * not the manifest tracks them — e.g. a Pocock skill installed by hand,
   * never through this CLI. Each one that is in neither the manifest nor
   * the lock is an unmanaged orphan the manifest loop below would never see.
   */
  onDiskNames?: Iterable<string>;
  /** Skill folders that could not be hashed in full, and why. */
  unreadable?: ReadonlyMap<string, string[]>;
  /** Names the release ships; defaults to the lock's. See knownSkillNames. */
  known?: ReadonlySet<string>;
}): DoctorRow[] {
  const { lock, manifest, onDiskCoreHash, supersedes, onDiskNames = [], unreadable } = args;
  const byName = new Map(lock.skills.map((s) => [s.name, s]));
  const known = args.known ?? new Set(byName.keys());
  const orphans = new Map(
    findOrphans({ manifest, known, supersedes, onDiskNames }).map((o) => [o.name, o]),
  );
  const rows: DoctorRow[] = [];

  for (const [name, installed] of Object.entries(manifest.skills)) {
    const row: DoctorRow = {
      name,
      installedVersion: installed.version ?? null,
      installedRelease: installed.release ?? null,
      state: "ok",
    };

    const orphan = orphans.get(name);
    if (orphan !== undefined) {
      row.state = "orphaned";
      if (orphan.supersededBy !== undefined) row.supersededBy = orphan.supersededBy;
      row.removable = orphan.removable;
      rows.push(row);
      continue;
    }

    const locked = byName.get(name);
    const onDisk = onDiskCoreHash.get(name);
    const couldNotRead = unreadable?.get(name);

    if (couldNotRead !== undefined) {
      // No comparison is possible, and pretending otherwise would blame the
      // engineer for an edit they never made.
      row.state = "unreadable";
      row.detail = couldNotRead.join(", ");
    } else if (
      installed.coreHash !== undefined &&
      onDisk !== undefined &&
      onDisk !== installed.coreHash
    ) {
      // Modified outranks the rest: an edited file is a different problem from
      // an old one, and telling someone to `sync` would silently discard it.
      row.state = "modified";
    } else if (installed.release !== lock.release) {
      row.state = "behind";
    } else if (locked !== undefined) {
      // Same label — now make the label mean something. Prefer the bytes on
      // disk; fall back to what was recorded when the folder is not readable
      // as a hash (e.g. nothing scanned it).
      const actual = onDisk ?? installed.coreHash;
      if (actual !== undefined && locked.coreHash !== undefined && actual !== locked.coreHash) {
        row.state = "divergent";
      }
    }
    rows.push(row);
  }

  // Unmanaged directories: never installed through this CLI (no manifest
  // entry) and not a name the release ships either. Reported with no known
  // version/release — the renderer prints "—" for both.
  for (const orphan of orphans.values()) {
    if (manifest.skills[orphan.name] !== undefined) continue;
    const row: DoctorRow = {
      name: orphan.name,
      installedVersion: null,
      installedRelease: null,
      state: "orphaned",
      removable: orphan.removable,
    };
    if (orphan.supersededBy !== undefined) row.supersededBy = orphan.supersededBy;
    rows.push(row);
  }

  return rows.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

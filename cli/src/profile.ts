/**
 * Read `.fieldnote/profile.md` — the repository's own facts.
 *
 * The profile carries FACTS, never PROCEDURE: where the definition of done
 * lives, which command runs mutation testing, what a ready-for-agent issue is
 * labelled. The opinion stays in the skill. A skill that reads a procedure out
 * of here is a bug in the skill.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Profile {
  tracker: Record<string, string>;
  labels: Record<string, string>;
  commands: Record<string, string>;
  docs: Record<string, string>;
  architecture: string[];
  parallelism: Record<string, string>;
  mergePolicy: Record<string, string>;
  localization: Record<string, string>;
  git: Record<string, string>;
  /**
   * Dotted keys whose value was the `(none)` marker — `commands.mutation` for
   * a key, a bare section name like `localization` for a whole section.
   *
   * The value itself is deliberately NOT kept in the records above: a skill
   * reading `profile.commands.mutation` gets `undefined` and cannot run the
   * literal string "(none)" as a command. This set is how a skill that wants
   * the distinction gets it back.
   */
  declaredAbsent: Set<string>;
}

/** `## Merge policy` -> `mergePolicy`. */
function sectionKey(heading: string): string {
  const words = heading.trim().toLowerCase().split(/\s+/);
  return words
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
}

/** `- **key** — value` (em dash, en dash or hyphen separator). */
const PAIR_RE = /^-\s+\*\*(.+?)\*\*\s*[—–-]\s*(.*)$/;
/** A bare `- value` bullet. */
const ITEM_RE = /^-\s+(.*)$/;

/** Marks a key or section the repository has decided it does not have. */
export const NONE_MARKER = "(none)";

function isNone(value: string): boolean {
  return value.trim().toLowerCase() === NONE_MARKER;
}

export function parseProfile(markdown: string): Profile {
  const profile: Profile = {
    tracker: {},
    labels: {},
    commands: {},
    docs: {},
    architecture: [],
    parallelism: {},
    mergePolicy: {},
    localization: {},
    git: {},
    declaredAbsent: new Set<string>(),
  };

  let current = "";
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();

    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      // Capture group 1 always exists when the regex matches.
      current = sectionKey(heading[1]!);
      continue;
    }

    if (current === "architecture") {
      const item = ITEM_RE.exec(line);
      if (!item) continue;
      const value = item[1]!.trim();
      if (isNone(value)) {
        profile.declaredAbsent.add("architecture");
        continue;
      }
      profile.architecture.push(value);
      continue;
    }

    const pair = PAIR_RE.exec(line);
    if (!pair) {
      // A bare `- (none)` under a key/value section declares the whole
      // section absent (e.g. a repository with no localization at all).
      const item = ITEM_RE.exec(line);
      if (item && isNone(item[1]!) && current) profile.declaredAbsent.add(current);
      continue;
    }
    const bucket = (profile as unknown as Record<string, Record<string, string>>)[current];
    if (bucket && typeof bucket === "object" && !Array.isArray(bucket)) {
      const key = pair[1]!.trim();
      const value = pair[2]!.trim();
      if (isNone(value)) {
        profile.declaredAbsent.add(`${current}.${key}`);
        continue;
      }
      bucket[key] = value;
    }
  }

  return profile;
}

/** The profile path for a repository, or null when it has none. */
export function findProfile(repoRoot: string): string | null {
  const path = join(repoRoot, ".fieldnote", "profile.md");
  return existsSync(path) ? path : null;
}

/** Read and parse a repository's profile, or null when absent. */
export function loadProfile(repoRoot: string): Profile | null {
  const path = findProfile(repoRoot);
  return path === null ? null : parseProfile(readFileSync(path, "utf8"));
}

/** True when the profile explicitly declared this key or section absent. */
export function isDeclaredAbsent(profile: Profile, dottedKey: string): boolean {
  return profile.declaredAbsent.has(dottedKey);
}

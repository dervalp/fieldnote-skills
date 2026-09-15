import { join } from "node:path";
import { UserError } from "./types.js";

/** A coding agent this CLI knows how to install skills for. */
export type AgentName = "claude" | "codex";

/** One agent's home directory — the folder its `skills/` tree lives under. */
export interface AgentHome {
  agent: AgentName;
  root: string;
}

/** Home-directory name per agent, in the order results are reported. */
const HOME_DIR: ReadonlyArray<readonly [AgentName, string]> = [
  ["claude", ".claude"],
  ["codex", ".codex"],
];

/**
 * Work out which agents' skill trees this run should write to.
 *
 * An agent counts as present when its home directory exists — not when a
 * `skills/` folder exists inside it, because a fresh agent install has the
 * home and no skills folder yet, and the installer creates that itself.
 *
 * With no home found at all we still return Claude: that is the pre-Codex
 * behaviour, and the installer creates the directory on the way past.
 *
 * An override (FIELDNOTE_CLAUDE_DIR, FIELDNOTE_CODEX_DIR) turns detection OFF
 * entirely — the targets are then exactly the ones named. That is not a
 * convenience: every test in this suite points FIELDNOTE_CLAUDE_DIR at a temp
 * directory, and detection running alongside would find the developer's real
 * ~/.codex and write the fixtures into it.
 */
export function resolveAgentHomes(opts: {
  home: string;
  overrides?: Partial<Record<AgentName, string>>;
  exists: (path: string) => boolean;
}): AgentHome[] {
  const overrides = opts.overrides ?? {};
  const pinned = HOME_DIR.flatMap(([agent]) => {
    const root = overrides[agent];
    return root === undefined ? [] : [{ agent, root }];
  });
  if (pinned.length > 0) return pinned;

  const detected: AgentHome[] = [];
  for (const [agent, dir] of HOME_DIR) {
    const root = join(opts.home, dir);
    if (opts.exists(root)) detected.push({ agent, root });
  }
  if (detected.length > 0) return detected;
  return [{ agent: "claude", root: join(opts.home, ".claude") }];
}

/**
 * Narrow a detected home list to the one `--agent` asked for.
 *
 * Without the flag every home stays in play — installing into both agents on
 * a machine that runs both is the point. The flag exists for the person who
 * has a ~/.codex for other reasons and does not want fieldnote in it.
 */
export function selectAgentHomes(homes: AgentHome[], requested: string | undefined): AgentHome[] {
  if (requested === undefined) return homes;

  const known = HOME_DIR.map(([agent]) => agent);
  if (!known.includes(requested as AgentName)) {
    throw new UserError(
      `Unknown agent "${requested}". This CLI installs for: ${known.join(", ")}.`,
    );
  }

  const picked = homes.filter((h) => h.agent === requested);
  if (picked.length === 0) {
    throw new UserError(
      `No ${requested} home found on this machine. ` +
        `Agents detected: ${homes.map((h) => `${h.agent} (${h.root})`).join(", ")}.`,
    );
  }
  return picked;
}

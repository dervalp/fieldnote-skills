/**
 * `doctor` — one screen answering "is what I have installed the release this
 * catalog ships?" Every release carries one number to quote and per-skill
 * content hashes to prove it. It warns and returns 0; --strict returns 1 so a
 * CI job can opt into gating later without a redesign.
 *
 * The claude.ai section deliberately reports that it cannot be inspected
 * rather than guessing: a false green on the one unenforceable surface would
 * be worse than no check at all. The same rule governs every other row — a
 * skill folder we could not read in full is reported unreadable rather than
 * hashed partially.
 */
import { dirname, join } from "node:path";
import { loadCatalog } from "../catalog.js";
import { classifyConcerns, concernPath, findConcerns, type ConcernRow } from "../concerns.js";
import {
  classifyInstalled,
  knownSkillNames,
  supersedesMap,
  type DoctorRow,
} from "../doctor-state.js";
import { scanInstalledSkills } from "../installed-tree.js";
import { readLock, type Lock } from "../lock.js";
import { readManifest } from "../manifest.js";
import type { AgentName } from "../agent-homes.js";
import type { Catalog, Env } from "../types.js";

/** One agent's skills tree, classified on its own manifest and its own files. */
interface AgentReport {
  agent: AgentName;
  root: string;
  /** Names the manifest in that home claims, used to scope the concern rows. */
  installedNames: Set<string>;
  skills: DoctorRow[];
}

export interface DoctorFlags {
  strict?: boolean;
  json?: boolean;
}

const MARK: Record<DoctorRow["state"], string> = {
  ok: "✔",
  behind: "⚠",
  divergent: "⚠",
  modified: "⚠",
  unreadable: "⚠",
  orphaned: "⚠",
};

/** Column widths sized to the rows actually being printed (never truncating). */
interface Columns {
  name: number;
  version: number;
  release: number;
}

function columnsFor(rows: DoctorRow[]): Columns {
  const width = (values: string[], min: number): number => Math.max(min, ...values.map((v) => v.length));
  return {
    name: width(rows.map((r) => r.name), 12),
    version: width(rows.map((r) => r.installedVersion ?? "—"), 7),
    release: width(rows.map((r) => r.installedRelease ?? "—"), 13),
  };
}

function describe(row: DoctorRow, release: string, cols: Columns): string {
  const version = (row.installedVersion ?? "—").padEnd(cols.version);
  const stamp = (row.installedRelease ?? "—").padEnd(cols.release);
  const base = `  ${MARK[row.state]} ${row.name.padEnd(cols.name)} ${version} ${stamp}`;
  switch (row.state) {
    case "behind":
      return `${base}   behind ${release} — run \`sync\``;
    case "divergent":
      // Not "behind": the recorded release IS the current one. The bytes are
      // what disagree, which is the case the lock's content hashes exist to catch.
      return `${base}   content differs from ${release} despite the label — run \`sync\``;
    case "modified":
      // `sync` holds this state (`HELD` in commands/update.ts), so promising an
      // overwrite here would send the reader to copy files out for nothing —
      // and hide the one command that does overwrite.
      return `${base}   modified on disk — \`sync\` leaves it; \`update ${row.name}\` overwrites`;
    case "unreadable":
      return `${base}   unreadable on disk (${row.detail ?? "?"}) — cannot compare`;
    case "orphaned":
      if (row.supersededBy !== undefined) return `${base}   orphaned — superseded by ${row.supersededBy}`;
      // Nothing in the catalog claims this name and this CLI never installed
      // it, so `sync` reports it but will not delete it.
      if (row.removable === false) return `${base}   not in the catalog — installed by hand, left alone`;
      return `${base}   orphaned — not in the catalog`;
    default:
      return base;
  }
}

/** One upstream pin as the lock records it, with how many skills carry it. */
export interface UpstreamPin {
  repo: string;
  ref: string;
  skills: number;
}

/** github.com/owner/repo(.git) -> owner/repo; anything else is left as-is. */
function repoShorthand(upstream: string): string {
  return upstream
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/^github\.com\//i, "")
    .replace(/\.git$/i, "");
}

/**
 * The upstream pins this release vendors, derived from the lock — no network
 * call, so `doctor` stays offline and instant. More than one pin for the same
 * repo means a half-finished re-sync, which is itself a finding.
 */
export function upstreamPins(lock: Lock): UpstreamPin[] {
  const counts = new Map<string, UpstreamPin>();
  for (const skill of lock.skills) {
    const upstream = skill.vendored?.["upstream"];
    if (upstream === undefined) continue;
    const repo = repoShorthand(upstream);
    const ref = skill.vendored?.["ref"] ?? "unrecorded";
    const key = `${repo} ${ref}`;
    const existing = counts.get(key);
    if (existing === undefined) counts.set(key, { repo, ref, skills: 1 });
    else existing.skills += 1;
  }
  return [...counts.values()].sort((a, b) => (a.repo + a.ref < b.repo + b.ref ? -1 : 1));
}

function upstreamSection(pins: UpstreamPin[]): string[] {
  if (pins.length === 0) return ["Upstream  none — this release vendors no upstream skills"];
  const repos = [...new Set(pins.map((p) => p.repo))];
  const lines = [`Upstream  ${repos.join(", ")}`];
  for (const repo of repos) {
    const forRepo = pins.filter((p) => p.repo === repo);
    if (forRepo.length === 1) {
      lines.push(`  pinned ${forRepo[0]!.ref} across ${forRepo[0]!.skills} vendored skill(s)`);
    } else {
      lines.push(
        `  ⚠ ${repo}: vendored skills disagree on the pin — ` +
          forRepo.map((p) => `${p.ref} (${p.skills} skill(s))`).join(", "),
      );
    }
  }
  // Deliberately offline: doctor never reaches the network, so it says what it
  // did not do rather than implying the pin is current.
  lines.push("  latest not checked — `doctor` makes no network call; compare against upstream's tags by hand");
  return lines;
}

/**
 * The single-line pin summary for the header, or null when nothing is vendored.
 *
 * Only two refs for the *same* repo are a finding — that is the half-finished
 * re-sync `upstreamPins` describes. Since vendoring went multi-upstream, one
 * ref per repo across several repos is the ordinary healthy state, and calling
 * it a disagreement made every run of `doctor` cry wolf.
 */
function headerPin(pins: UpstreamPin[]): string | null {
  if (pins.length === 0) return null;
  const repos = [...new Set(pins.map((p) => p.repo))];
  const refsFor = (repo: string): string[] => pins.filter((p) => p.repo === repo).map((p) => p.ref);
  const split = repos.filter((repo) => refsFor(repo).length > 1);
  if (split.length > 0) {
    // Name only the repos that actually disagree; the others are fine and
    // saying so keeps the reader looking at the right one.
    return `upstream pins disagree (${split.map((repo) => `${repo} ${refsFor(repo).join(" + ")}`).join(", ")})`;
  }
  if (pins.length === 1) return `upstream pin ${pins[0]!.repo} ${pins[0]!.ref}`;
  return `upstream pins ${pins.map((p) => `${p.repo} ${p.ref}`).join(", ")}`;
}

/**
 * The repository section. Only skills that are actually installed are asked
 * about: a file the reader has no skill to read is not a gap.
 */
function concernRows(env: Env, catalog: Catalog, installed: Set<string>): ConcernRow[] {
  if (env.repoRoot === null) return [];
  const declaredBy = new Map<string, string[]>();
  for (const skill of catalog.skills) {
    if (!installed.has(skill.name)) continue;
    if (skill.concerns !== undefined && skill.concerns.length > 0) declaredBy.set(skill.name, skill.concerns);
  }
  return classifyConcerns({ present: findConcerns(env.repoRoot), declaredBy });
}

function concernSection(rows: ConcernRow[], repoRoot: string): string[] {
  const lines = [`This repository  ${repoRoot}`];
  if (rows.length === 0) {
    lines.push("  no .fieldnote/concerns/ — skills fall back to general practice");
    lines.push("  `fieldnote-setup-profile` can draft them; see docs/concerns.md");
    return lines;
  }
  for (const row of rows) {
    const mark = row.present ? "✔" : "⚠";
    const who = row.wantedBy.length === 0 ? "read by nothing installed" : `read by ${row.wantedBy.join(", ")}`;
    const state = row.present ? who : `${who} — not present`;
    lines.push(`  ${mark} ${concernPath(row.name)}   ${state}`);
  }
  return lines;
}

export async function runDoctor(env: Env, flags: DoctorFlags): Promise<number> {
  const lock = readLock(join(dirname(env.catalogPath), "skills.lock.json"));
  if (lock === null) {
    env.logger.warn("No skills.lock.json beside the catalog — this build predates release parity.");
    return flags.strict === true ? 1 : 0;
  }

  const catalog = await loadCatalog(env);

  // One report per agent home. Each home has its own manifest and its own
  // tree, so each is classified on its own: a skill edited in ~/.codex must
  // show as modified there and stay `ok` under ~/.claude.
  const agents: AgentReport[] = [];
  for (const home of env.agentHomes) {
    const scoped = { ...env, agentDir: home.root };
    const manifest = await readManifest(scoped);
    const tree = await scanInstalledSkills(scoped);
    agents.push({
      agent: home.agent,
      root: home.root,
      installedNames: new Set(Object.keys(manifest.skills)),
      skills: classifyInstalled({
        lock,
        manifest,
        onDiskCoreHash: tree.coreHash,
        unreadable: tree.unreadable,
        supersedes: supersedesMap(lock),
        onDiskNames: tree.names,
        known: knownSkillNames(lock, catalog.skills.map((s) => s.name)),
      }),
    });
  }

  // Concerns are a property of the repository, not of any one agent, so they
  // are asked once — against every skill installed anywhere.
  const installedAnywhere = new Set(agents.flatMap((a) => [...a.installedNames]));
  const concerns = concernRows(env, catalog, installedAnywhere);

  // Only desktop/both skills are ever packaged into a claude.ai zip (see
  // build-catalog / CI); a code-only skill has a SKILL.md too, so that field
  // can't distinguish them. The catalog's `surface` is the source of truth.
  const expectedZips = catalog.skills
    .filter((s) => s.surface === "desktop" || s.surface === "both")
    .map((s) => `${s.name}-${lock.release}.zip`)
    .sort();

  const pins = upstreamPins(lock);
  const drift = agents.some((a) => a.skills.some((r) => r.state !== "ok"));

  if (flags.json === true) {
    env.logger.output(
      JSON.stringify(
        {
          release: lock.release,
          // One entry per agent home, replacing the old single `claudeCode`
          // list: with two agents on the machine that key could only ever
          // describe one of them, and would quietly hide drift in the other.
          agents: agents.map(({ agent, root, skills }) => ({ agent, root, skills })),
          // Named explicitly rather than omitted: a machine consumer must be
          // able to tell "no drift here" from "this surface cannot be read".
          claudeAi: { inspectable: false, expected: expectedZips },
          upstream: { pins, latestChecked: false },
          // Named explicitly even outside a repository (root: null, concerns:
          // []) rather than omitted, for the same reason as claudeAi above: a
          // machine consumer must be able to tell "not in a repository" from
          // "this CLI version has no such field".
          repository: { root: env.repoRoot, concerns },
        },
        null,
        2,
      ),
    );
    return flags.strict === true && drift ? 1 : 0;
  }

  const pinLabel = headerPin(pins);
  env.logger.info(
    `fieldnote skills · latest release ${lock.release}${pinLabel === null ? "" : ` · ${pinLabel}`}`,
  );
  for (const { agent, root, skills } of agents) {
    env.logger.info("");
    env.logger.info(`${agent}  ${join(root, "skills")}`);
    if (skills.length === 0) env.logger.info("  (nothing installed)");
    const cols = columnsFor(skills);
    for (const row of skills) env.logger.info(describe(row, lock.release, cols));
  }

  if (env.repoRoot !== null) {
    env.logger.info("");
    for (const line of concernSection(concerns, env.repoRoot)) env.logger.info(line);
  }

  env.logger.info("");
  env.logger.info("claude.ai  cannot be inspected");
  env.logger.info(`  expected: ${expectedZips.join(", ")}`);
  env.logger.info("  ask a skill its release to confirm what is actually loaded");

  env.logger.info("");
  for (const line of upstreamSection(pins)) env.logger.info(line);

  return flags.strict === true && drift ? 1 : 0;
}

/**
 * `doctor` — one screen answering "are all three surfaces on the same
 * release?" (ADR-0010). It warns and returns 0; --strict returns 1 so a CI
 * job can opt into gating later without a redesign.
 *
 * The claude.ai section deliberately reports that it cannot be inspected
 * rather than guessing: a false green on the one unenforceable surface would
 * be worse than no check at all. The same rule governs every other row —
 * Mastra's tick is printed only after its recorded hashes have actually been
 * compared against the lock, and a skill folder we could not read in full is
 * reported unreadable rather than hashed partially.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadCatalog } from "../catalog.js";
import {
  classifyInstalled,
  knownSkillNames,
  supersedesMap,
  type DoctorRow,
} from "../doctor-state.js";
import { scanInstalledSkills } from "../installed-tree.js";
import { readLock, type Lock } from "../lock.js";
import { readManifest } from "../manifest.js";
import type { Env } from "../types.js";

export interface DoctorFlags {
  orchestrator?: string;
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
      // what disagree, which is the case ADR-0010's hashes exist to catch.
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

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * What we can honestly say about a vendored Mastra bundle. Every field is
 * optional on purpose: an older bundle carries fewer of them, and the report
 * degrades to "cannot verify" rather than inventing a schema.
 */
interface MastraManifest {
  release?: string;
  skills?: { name?: string; version?: string; coreHash?: string }[];
}
interface SkillsPin {
  release?: string;
  skills?: string[];
}

export interface MastraReport {
  checked: boolean;
  path?: string;
  manifestRelease?: string | null;
  pinRelease?: string | null;
  skills?: number;
  /** How many of those skills carried a coreHash we could compare. */
  hashed?: number;
  hashesVerified?: boolean;
  mismatched?: string[];
  notInRelease?: string[];
  lines: string[];
}

/** The Mastra rows: opt-in by path, honest about not having looked. */
async function mastraReport(orchestrator: string | undefined, lock: Lock): Promise<MastraReport> {
  if (orchestrator === undefined) {
    return { checked: false, lines: ["  not checked — pass --orchestrator <path to vertuo-orchestrator>"] };
  }
  const appDir = join(orchestrator, "apps", "orchestrator");
  const manifestPath = join(appDir, "src", "mastra", "public", "knowledge", "manifest.json");
  const pin = await readJson<SkillsPin>(join(appDir, "skills.pin.json"));
  const pinRelease = pin === null ? null : pin.release ?? "unrecorded";

  const pinLines = (manifestRelease: string | null): string[] => {
    if (pinRelease === null) return ["  no skills.pin.json beside the bundle — it records no pin"];
    const lines: string[] = [];
    if (pinRelease !== lock.release) {
      lines.push(`  ⚠ pin is ${pinRelease}, latest is ${lock.release} — bump apps/orchestrator/skills.pin.json`);
    } else {
      lines.push(`  pin ${pinRelease}`);
    }
    if (manifestRelease !== null && pinRelease !== manifestRelease) {
      lines.push(`  ⚠ pin (${pinRelease}) and vendored manifest (${manifestRelease}) disagree`);
    }
    return lines;
  };

  const manifest = await readJson<MastraManifest>(manifestPath);
  if (manifest === null) {
    return {
      checked: true,
      path: manifestPath,
      manifestRelease: null,
      pinRelease,
      lines: [`  ⚠ no vendored manifest at ${manifestPath}`, ...pinLines(null)],
    };
  }

  const release = manifest.release ?? "unrecorded";
  const skills = manifest.skills ?? [];
  const locked = new Map(lock.skills.map((s) => [s.name, s]));
  const hashed = skills.filter((s) => typeof s.coreHash === "string");
  const mismatched = hashed
    .filter((s) => locked.get(s.name ?? "")?.coreHash !== s.coreHash)
    .map((s) => s.name ?? "(unnamed)");
  const notInRelease = skills.filter((s) => s.name === undefined || !locked.has(s.name)).map((s) => s.name ?? "(unnamed)");

  const report: MastraReport = {
    checked: true,
    path: manifestPath,
    manifestRelease: release,
    pinRelease,
    skills: skills.length,
    hashed: hashed.length,
    hashesVerified: hashed.length === skills.length && skills.length > 0 && mismatched.length === 0,
    mismatched,
    notInRelease,
    lines: [],
  };

  if (release !== lock.release) {
    report.lines.push(`  ⚠ manifest is on ${release}, latest is ${lock.release} — re-run its sync-knowledge`);
  } else if (skills.length === 0) {
    report.lines.push(`  ⚠ manifest says ${release} but lists no skills — nothing to verify`);
  } else if (hashed.length === 0) {
    // The old code printed a tick here, on string equality alone.
    report.lines.push(
      `  ⚠ manifest says ${release}, ${skills.length} skill(s), but carries no coreHash — ` +
        `cannot verify (bundle predates hash recording; re-run its sync-knowledge)`,
    );
  } else if (mismatched.length > 0) {
    report.lines.push(
      `  ⚠ manifest says ${release}, ${skills.length} skill(s), but ${mismatched.length} hash(es) ` +
        `differ from the lock: ${mismatched.sort().join(", ")}`,
    );
  } else if (hashed.length < skills.length) {
    report.lines.push(
      `  ⚠ manifest matches ${release}, ${hashed.length}/${skills.length} skill(s) hash-verified — ` +
        `the rest carry no coreHash`,
    );
  } else {
    report.lines.push(`  ✔ manifest matches ${release}, ${skills.length} skill(s), hashes verified`);
  }

  const unverifiableNames = notInRelease.filter((name) => !mismatched.includes(name));
  if (unverifiableNames.length > 0) {
    report.lines.push(`  ⚠ vendors skill(s) this release does not ship: ${unverifiableNames.sort().join(", ")}`);
  }
  report.lines.push(...pinLines(release));
  return report;
}

export async function runDoctor(env: Env, flags: DoctorFlags): Promise<number> {
  const lock = readLock(join(dirname(env.catalogPath), "skills.lock.json"));
  if (lock === null) {
    env.logger.warn("No skills.lock.json beside the catalog — this build predates release parity.");
    return flags.strict === true ? 1 : 0;
  }

  const catalog = await loadCatalog(env);
  const manifest = await readManifest(env);
  const tree = await scanInstalledSkills(env);
  const rows = classifyInstalled({
    lock,
    manifest,
    onDiskCoreHash: tree.coreHash,
    unreadable: tree.unreadable,
    supersedes: supersedesMap(lock),
    onDiskNames: tree.names,
    known: knownSkillNames(lock, catalog.skills.map((s) => s.name)),
  });

  // Only desktop/both skills are ever packaged into a claude.ai zip (see
  // build-catalog / CI); a code-only skill has a SKILL.md too, so that field
  // can't distinguish them. The catalog's `surface` is the source of truth.
  const expectedZips = catalog.skills
    .filter((s) => s.surface === "desktop" || s.surface === "both")
    .map((s) => `${s.name}-${lock.release}.zip`)
    .sort();

  const pins = upstreamPins(lock);
  const mastra = await mastraReport(flags.orchestrator, lock);
  const drift = rows.some((r) => r.state !== "ok");

  if (flags.json === true) {
    const { lines, ...mastraJson } = mastra;
    env.logger.output(
      JSON.stringify(
        {
          release: lock.release,
          claudeCode: rows,
          mastra: mastraJson,
          // Named explicitly rather than omitted: a machine consumer must be
          // able to tell "no drift here" from "this surface cannot be read".
          claudeAi: { inspectable: false, expected: expectedZips },
          upstream: { pins, latestChecked: false },
        },
        null,
        2,
      ),
    );
    return flags.strict === true && drift ? 1 : 0;
  }

  const pinLabel = headerPin(pins);
  env.logger.info(
    `Vertuo AI OS · latest release ${lock.release}${pinLabel === null ? "" : ` · ${pinLabel}`}`,
  );
  env.logger.info("");
  env.logger.info(`Claude Code  ${tree.root}`);
  if (rows.length === 0) env.logger.info("  (nothing installed)");
  const cols = columnsFor(rows);
  for (const row of rows) env.logger.info(describe(row, lock.release, cols));

  env.logger.info("");
  env.logger.info(`Mastra${mastra.path === undefined ? "" : `  ${flags.orchestrator ?? ""}`}`);
  for (const line of mastra.lines) env.logger.info(line);

  env.logger.info("");
  env.logger.info("claude.ai  cannot be inspected");
  env.logger.info(`  expected: ${expectedZips.join(", ")}`);
  env.logger.info("  ask a skill its release to confirm what is actually loaded");

  env.logger.info("");
  for (const line of upstreamSection(pins)) env.logger.info(line);

  return flags.strict === true && drift ? 1 : 0;
}

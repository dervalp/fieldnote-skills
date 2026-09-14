import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadCatalog, requireSkill } from "../catalog.js";
import { installEntries, targetDirFor } from "../installer.js";
import { readLock } from "../lock.js";
import {
  classifyInstalled,
  findOrphans,
  knownSkillNames,
  supersedesMap,
  type SkillState,
} from "../doctor-state.js";
import { scanInstalledSkills } from "../installed-tree.js";
import { forgetInstalled, readManifest } from "../manifest.js";
import { computeRows } from "../state.js";
import type { Env, SkillRow } from "../types.js";
import { UserError } from "../types.js";

function updateChoice(row: SkillRow): { name: string; value: string; checked?: boolean } {
  const state = row.outdated
    ? `⬆ ${row.installedVersion} → ${row.entry.version}`
    : `✓ up to date (v${row.entry.version})`;
  return {
    name: `${row.entry.name}  ·  ${state}`,
    value: row.entry.name,
    checked: row.outdated,
  };
}

/**
 * `update` — bring installed skills current.
 * With names: update those skills directly. Without names: interactive picker
 * of installed skills with outdated ones pre-checked.
 */
export async function runUpdate(env: Env, names: string[]): Promise<void> {
  const catalog = await loadCatalog(env);

  if (names.length > 0) {
    const entries = names.map((name) => requireSkill(catalog, name));
    const results = await installEntries(env, entries);
    for (const r of results) env.logger.info(`Updated ${r.name}@${r.version}`);
    return;
  }

  const rows = await computeRows(env, catalog);
  const installed = rows.filter((r) => r.installed);
  if (installed.length === 0) {
    env.logger.info("No skills installed yet. Run `vertuoza-skills list` to install some.");
    return;
  }

  const picked = await env.prompter.checkbox({
    message: "Update installed skills (outdated pre-selected, enter to confirm)",
    choices: installed.map(updateChoice),
  });
  if (picked.length === 0) {
    env.logger.info("Nothing to update.");
    return;
  }

  const byName = new Map(rows.map((r) => [r.entry.name, r.entry]));
  const entries = picked.map((n) => byName.get(n)!).filter(Boolean);
  const results = await installEntries(env, entries);
  for (const r of results) env.logger.info(`Updated ${r.name}@${r.version}`);
}

export interface SyncFlags {
  json?: boolean;
}

/** States where reinstalling would destroy something, so `sync` must not. */
const HELD: ReadonlySet<SkillState> = new Set<SkillState>(["modified", "unreadable"]);

/**
 * `sync` — reconcile everything installed against the latest package: update
 * what the current release has moved on from, and report what is new
 * (available but not installed).
 *
 * "Moved on from" is deliberately broader than per-skill semver. A release is
 * catalog-level: cutting `skills-v1.0.1` usually leaves most skills' `version:`
 * untouched, so a version-only comparison would report every one of them
 * `behind` in `doctor` while `sync` claimed everything was up to date. The
 * recorded release — and, at the same release, the recorded content hash — are
 * inputs here too, which is what makes `doctor`'s "run `sync`" advice true.
 */
export async function runSync(env: Env, flags: SyncFlags): Promise<void> {
  const catalog = await loadCatalog(env);
  const rows = await computeRows(env, catalog);
  const available = rows.filter((r) => !r.installed);

  const lock = readLock(join(dirname(env.catalogPath), "skills.lock.json"));
  const manifest = await readManifest(env);
  const tree = await scanInstalledSkills(env);
  const supersedes = lock === null ? new Map<string, string>() : supersedesMap(lock);

  // One orphan definition, shared with `doctor`: manifest entries the release
  // dropped, plus directories on disk this CLI never installed. `doctor` was
  // already right about this; `sync` used to walk the manifest only and so
  // missed every hand-installed Pocock skill — the case the design exists for.
  const orphans = findOrphans({
    manifest,
    known: knownSkillNames(lock, catalog.skills.map((s) => s.name)),
    supersedes,
    onDiskNames: tree.names,
  });
  // The removal boundary. `rm -rf` below may only ever see entries we can
  // prove are ours: a manifest entry, or a name a vendored skill explicitly
  // supersedes. A developer machine holds ~25 unmanaged directories, some
  // installed deliberately; those are reported and left exactly where they are.
  const removable = orphans.filter((o) => o.removable);
  const unmanaged = orphans.filter((o) => !o.removable);

  const states = new Map<string, SkillState>(
    lock === null
      ? []
      : classifyInstalled({
          lock,
          manifest,
          onDiskCoreHash: tree.coreHash,
          unreadable: tree.unreadable,
          supersedes,
          onDiskNames: tree.names,
          known: knownSkillNames(lock, catalog.skills.map((s) => s.name)),
        }).map((r) => [r.name, r.state]),
  );

  // With no lock (a pre-parity bundle) `states` is empty, `staleRelease` is
  // always false, and this collapses to the original per-skill-version
  // behaviour.
  const installed = rows.filter((r) => r.installed);
  // Read from the manifest, not from the classification: `modified` outranks
  // `behind`, so asking for the state would hide the staleness of exactly the
  // copies we most need to talk about.
  const staleRelease = (name: string): boolean =>
    lock !== null && manifest.skills[name]?.release !== lock.release;

  // Held back first, so a skill that is both stale and edited is reported
  // rather than reinstalled over.
  const held = installed.filter((r) => HELD.has(states.get(r.entry.name) ?? "ok"));
  const heldNames = new Set(held.map((r) => r.entry.name));
  const toUpdate = installed.filter(
    (r) =>
      !heldNames.has(r.entry.name) &&
      (r.outdated || staleRelease(r.entry.name) || states.get(r.entry.name) === "divergent"),
  );

  const results = await installEntries(env, toUpdate.map((r) => r.entry));
  const skipped = held.map((r) => ({ name: r.entry.name, state: states.get(r.entry.name)! }));

  if (flags.json) {
    env.logger.output(
      JSON.stringify(
        {
          updated: results,
          available: available.map((r) => ({ name: r.entry.name, version: r.entry.version })),
          skipped,
          orphaned: removable.map(({ name, supersededBy }) =>
            supersededBy === undefined ? { name } : { name, supersededBy },
          ),
          unmanaged: unmanaged.map(({ name, supersededBy }) =>
            supersededBy === undefined ? { name } : { name, supersededBy },
          ),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (results.length === 0) {
    env.logger.info("Everything installed is up to date.");
  } else {
    env.logger.info(`Updated ${results.length} skill(s):`);
    for (const r of results) env.logger.info(`  ${r.name} → v${r.version}`);
  }
  if (skipped.length > 0) {
    env.logger.info(
      `${skipped.length} skill(s) left alone because your copy differs from the bundle ` +
        `(run \`vertuoza-skills update <name>\` to overwrite):`,
    );
    for (const s of skipped) env.logger.info(`  ${s.name} — ${s.state} on disk`);
  }
  if (available.length > 0) {
    env.logger.info(
      `${available.length} new skill(s) available (run \`vertuoza-skills list\` to install): ` +
        available.map((r) => r.entry.name).join(", "),
    );
  }
  if (unmanaged.length > 0) {
    env.logger.info(
      `${unmanaged.length} skill folder(s) in ${tree.root} were not installed by this CLI ` +
        `and nothing in the catalog claims them — reported, left alone:`,
    );
    for (const o of unmanaged) env.logger.info(`  ${o.name}`);
  }
  if (removable.length > 0) {
    env.logger.info(`${removable.length} installed skill(s) are no longer in the catalog:`);
    for (const o of removable) {
      env.logger.info(`  ${o.name}${o.supersededBy === undefined ? "" : ` → superseded by ${o.supersededBy}`}`);
    }
    const remove = await env.prompter.confirm({
      message: `Remove those ${removable.length} from ${tree.root}?`,
      default: false,
    });
    if (remove) {
      for (const o of removable) {
        await rm(targetDirFor(env, o.name), { recursive: true, force: true });
        await forgetInstalled(env, o.name);
        env.logger.info(`  removed ${o.name}`);
      }
    }
  }
}

import { installableSkills, loadCatalog } from "./catalog.js";
import { readManifest } from "./manifest.js";
import type { Catalog, Env, SkillRow } from "./types.js";
import { isNewer } from "./version.js";

/**
 * Join the catalog with the local manifest into install-aware rows: which
 * installable skills exist, which are installed, and which have a newer
 * bundled version than what is on disk.
 */
export async function computeRows(env: Env, catalog?: Catalog): Promise<SkillRow[]> {
  const cat = catalog ?? (await loadCatalog(env));
  const manifest = await readManifest(env);

  return installableSkills(cat).map((entry) => {
    const installedEntry = manifest.skills[entry.name];
    const installedVersion = installedEntry?.version ?? null;
    return {
      entry,
      installed: installedVersion !== null,
      installedVersion,
      outdated: installedVersion !== null && isNewer(entry.version, installedVersion),
    };
  });
}

/** Rows whose bundled version is newer than what is installed. */
export function outdatedRows(rows: SkillRow[]): SkillRow[] {
  return rows.filter((r) => r.outdated);
}

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Env, Manifest, ManifestEntry, SkillEntry } from "./types.js";

const MANIFEST_VERSION = 1;

/** The manifest lives beside installed skills, inside ~/.claude. */
export function manifestPath(env: Env): string {
  return join(env.claudeDir, "skills", ".vertuoza-skills.json");
}

/** Read the installed-skill manifest, returning an empty one if absent. */
export async function readManifest(env: Env): Promise<Manifest> {
  let raw: string;
  try {
    raw = await readFile(manifestPath(env), "utf8");
  } catch {
    return { version: MANIFEST_VERSION, skills: {} };
  }
  try {
    const parsed = JSON.parse(raw) as Manifest;
    if (!parsed.skills || typeof parsed.skills !== "object") {
      return { version: MANIFEST_VERSION, skills: {} };
    }
    return { version: parsed.version ?? MANIFEST_VERSION, skills: parsed.skills };
  } catch {
    // A corrupt manifest should not block reinstalling; start fresh.
    return { version: MANIFEST_VERSION, skills: {} };
  }
}

export async function writeManifest(env: Env, manifest: Manifest): Promise<void> {
  const path = manifestPath(env);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

/** Record (or refresh) one skill's installed version in the manifest. */
export async function recordInstalled(
  env: Env,
  entry: SkillEntry,
  extra: { release?: string; coreHash?: string } = {},
): Promise<void> {
  const manifest = await readManifest(env);
  const record: ManifestEntry = {
    version: entry.version,
    section: entry.section,
    surface: entry.surface,
  };
  if (extra.release !== undefined) record.release = extra.release;
  if (extra.coreHash !== undefined) record.coreHash = extra.coreHash;
  manifest.skills[entry.name] = record;
  await writeManifest(env, manifest);
}

/** Remove a skill from the manifest (used on uninstall/rollback bookkeeping). */
export async function forgetInstalled(env: Env, name: string): Promise<void> {
  const manifest = await readManifest(env);
  delete manifest.skills[name];
  await writeManifest(env, manifest);
}

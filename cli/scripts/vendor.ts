#!/usr/bin/env node
/**
 * Import (or re-sync) vendored skills from their pinned upstream tags.
 * Run from the repo root: npm run vendor [-- <manifest> ...]
 *
 * One manifest per upstream in cli/vendor/*.json; with no argument every one
 * of them is imported. For each: clone the pin shallowly into a temp dir,
 * verify the tag still resolves to the pinned commit, import every skill the
 * manifest names, and report any reference pointing at an upstream skill we
 * did not vendor. That report is the guard that keeps a suite's internal
 * wiring intact as upstream adds cross-references.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readRelease } from "../src/lock.js";
import { importSkill, vendoredNameFor, type VendorManifest } from "../src/vendor-import.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const vendorDir = join(repoRoot, "cli", "vendor");
const release = readRelease(repoRoot);

/** Manifest file names, filtered by any names passed on the command line. */
function manifestFiles(): string[] {
  const all = readdirSync(vendorDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const wanted = process.argv.slice(2);
  if (wanted.length === 0) return all;

  const selected = all.filter((f) => wanted.includes(f) || wanted.includes(basename(f, ".json")));
  const unknown = wanted.filter(
    (w) => !all.some((f) => f === w || basename(f, ".json") === w),
  );
  if (unknown.length > 0) {
    console.error(`❌ no such vendor manifest: ${unknown.join(", ")} (have: ${all.map((f) => basename(f, ".json")).join(", ")})`);
    process.exit(1);
  }
  return selected;
}

/**
 * Every skill folder the upstream ships, so an unresolved reference can be
 * told apart from an ordinary token. `nested` upstreams group skills a level
 * down (`skills/<category>/<skill>/`); `flat` ones do not.
 */
function upstreamSkillNames(upstreamRoot: string, layout: VendorManifest["layout"]): Set<string> {
  const names = new Set<string>();
  const skillsDir = join(upstreamRoot, "skills");
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (layout === "flat") {
      names.add(entry.name);
      continue;
    }
    for (const skill of readdirSync(join(skillsDir, entry.name), { withFileTypes: true })) {
      if (skill.isDirectory()) names.add(skill.name);
    }
  }
  return names;
}

function vendorOne(manifestFile: string): { count: number; dangling: Map<string, string[]> } {
  const manifest = JSON.parse(readFileSync(join(vendorDir, manifestFile), "utf8")) as VendorManifest;
  const tmp = mkdtempSync(join(tmpdir(), "vz-vendor-"));
  try {
    console.log(`Cloning ${manifest.upstream} at ${manifest.ref} …`);
    // Cloning an annotated tag (e.g. v1.2.3) makes git print a routine notice
    // that the tag itself isn't a commit and HEAD is now detached at the commit
    // it points to. That's expected — not an error — and isn't checked here.
    execFileSync("git", ["clone", "--depth", "1", "--branch", manifest.ref, "-q", `${manifest.upstream}.git`, tmp], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: tmp }).toString().trim();

    // The pin may be an abbreviated SHA (git log's default, 7+ hex chars) or the
    // full 40-char form; either is accepted as a prefix match. Anything shorter
    // than 7 chars is too easily ambiguous to trust as a pin at all.
    if (!/^[0-9a-f]{7,}$/i.test(manifest.commit)) {
      console.error(
        `❌ ${manifestFile}: the commit pin "${manifest.commit}" is too short to be trustworthy — ` +
          "lengthen it to at least 7 hex characters (the full 40-character SHA is safest).",
      );
      process.exit(1);
    }
    if (!commit.toLowerCase().startsWith(manifest.commit.toLowerCase())) {
      console.error(`❌ ${manifest.ref} resolves to ${commit}, but ${manifestFile} pins ${manifest.commit}.`);
      console.error("   A moved tag is a supply-chain signal, not a routine update. Investigate before re-pinning.");
      process.exit(1);
    }

    const allUpstream = upstreamSkillNames(tmp, manifest.layout);
    const vendoredNames = new Set(manifest.skills.map((s) => basename(s.upstreamPath)));
    const dangling = new Map<string, string[]>();

    for (const skill of manifest.skills) {
      const name = vendoredNameFor(skill.upstreamPath, manifest.prefix);
      const { unresolved } = importSkill({
        upstreamRoot: tmp,
        destDir: join(repoRoot, "skills", manifest.section, name),
        name,
        release,
        skill,
        common: manifest,
        vendoredNames,
        allUpstreamNames: allUpstream,
        refStyle: manifest.refStyle,
      });
      if (unresolved.length > 0) dangling.set(name, unresolved);
      console.log(`  vendored ${name} <- ${skill.upstreamPath}`);
    }

    const licenseDest = join(repoRoot, manifest.licenseFile);
    mkdirSync(dirname(licenseDest), { recursive: true });
    copyFileSync(join(tmp, "LICENSE"), licenseDest);

    console.log(`✅ vendored ${manifest.skills.length} skill(s) from ${manifest.ref} (${commit}).`);
    return { count: manifest.skills.length, dangling };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

let total = 0;
const allDangling = new Map<string, string[]>();
for (const file of manifestFiles()) {
  const { count, dangling } = vendorOne(file);
  total += count;
  for (const [name, refs] of dangling) allDangling.set(name, refs);
}

console.log(`✅ ${total} skill(s) vendored in total.`);
if (allDangling.size > 0) {
  console.warn(`⚠ ${allDangling.size} skill(s) reference upstream skills that were not vendored:`);
  for (const [name, refs] of allDangling) console.warn(`  ${name} -> ${refs.join(", ")}`);
}

/**
 * Import mechanics for vendored skills (ADR-0009). Editorial choices — our
 * description, surface, category, version, supersedes — come from the tracked
 * import manifest (cli/vendor/<upstream>.json), never from this code, so a
 * re-sync never re-litigates them.
 *
 * agents/ is deliberately NOT copied: Claude Code reads a skill's agents/ as
 * subagent definitions, and upstream's holds another harness's metadata.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { bodyOf, sha256 } from "./lock.js";
import { rewriteReferences, type ReferenceStyle } from "./rewrite.js";
import { fileRole, parseFrontmatter } from "./skill-model.js";
import { vendorPrefixList, vendorPrefixOf } from "./vendor-model.js";

const SKIPPED_UPSTREAM_DIRS: ReadonlySet<string> = new Set(["agents"]);

export interface VendorManifestSkill {
  upstreamPath: string;
  surface: "code" | "both";
  category: "product" | "engineer" | "qa";
  version: string;
  supersedes: string[];
  description: string;
}

export interface VendorCommon {
  upstream: string;
  ref: string;
  commit: string;
  license: string;
  licenseFile: string;
  section: string;
}

export interface VendorManifest extends VendorCommon {
  prefix: string;
  /**
   * How the upstream lays its skills out under `skills/`: `nested` is
   * `skills/<category>/<skill>/` (Pocock), `flat` is `skills/<skill>/` (obra).
   * Only the enumeration of "every skill upstream ships" depends on it, which
   * is what tells a dangling reference apart from an ordinary word.
   */
  layout: "flat" | "nested";
  /** How this upstream's skills reference each other. See `ReferenceStyle`. */
  refStyle: ReferenceStyle;
  skills: VendorManifestSkill[];
}

/** Our name for an upstream path: the prefix plus its folder name. */
export function vendoredNameFor(upstreamPath: string, prefix: string): string {
  return `${prefix}${basename(upstreamPath)}`;
}

/**
 * Round-trip the just-rendered frontmatter through the same parser that
 * reads it back everywhere else, and throw if any field does not come back
 * intact. `parseFrontmatter` (like `bodyOf`) finds the closing fence with a
 * bare `indexOf("---", 3)`, so a description containing a literal `---`
 * truncates the whole block, and a description that happens to start with
 * `[` and end with `]` is misread as a list instead of a string. Both are
 * silent corruptions of the `vendored:` provenance block — the one thing
 * this whole mechanism exists to keep intact — so this must fail loudly at
 * render time rather than ship a corrupt SKILL.md.
 */
function assertRoundTrips(
  md: string,
  expected: {
    name: string;
    release: string;
    skill: VendorManifestSkill;
    common: VendorCommon;
    description: string;
    upstreamBodyHash: string;
  },
): void {
  const { name, release, skill, common, description, upstreamBodyHash } = expected;

  const fail = (field: string): never => {
    throw new Error(
      `vendored skill "${name}": frontmatter failed to round-trip on field "${field}" — ` +
        `a description containing "---" or wrapped in "[ ]" is the usual cause.`,
    );
  };

  const fm = parseFrontmatter(md);
  if (fm === null) return fail("(entire frontmatter block)");

  if (fm["name"] !== name) return fail("name");
  if (fm["description"] !== description) return fail("description");
  if (fm["version"] !== skill.version) return fail("version");
  if (fm["release"] !== release) return fail("release");
  if (fm["section"] !== common.section) return fail("section");
  if (fm["surface"] !== skill.surface) return fail("surface");
  if (fm["category"] !== skill.category) return fail("category");

  const supersedes = fm["supersedes"];
  if (!Array.isArray(supersedes) || supersedes.length !== skill.supersedes.length) return fail("supersedes");

  const vendored = fm["vendored"];
  if (typeof vendored !== "object" || vendored === null || Array.isArray(vendored)) return fail("vendored");
  const vendoredExpected: Record<string, string> = {
    upstream: common.upstream,
    ref: common.ref,
    commit: common.commit,
    path: skill.upstreamPath,
    license: common.license,
    licenseFile: common.licenseFile,
    upstreamBodyHash,
  };
  for (const [key, value] of Object.entries(vendoredExpected)) {
    if ((vendored as Record<string, string>)[key] !== value) return fail(`vendored.${key}`);
  }
}

export function renderVendoredSkillMd(args: {
  name: string;
  release: string;
  skill: VendorManifestSkill;
  common: VendorCommon;
  body: string;
  upstreamBodyHash: string;
}): string {
  const { name, release, skill, common, body, upstreamBodyHash } = args;
  // Collapsed to one line: the frontmatter parser has no folded scalars.
  const description = skill.description.replace(/\s+/g, " ").trim();
  const lines = [
    "---",
    `name: ${name}`,
    `description: ${description}`,
    `version: ${skill.version}`,
    `release: ${release}`,
    `section: ${common.section}`,
    `surface: ${skill.surface}`,
    `category: ${skill.category}`,
    `supersedes: [${skill.supersedes.join(", ")}]`,
    "vendored:",
    `  upstream: ${common.upstream}`,
    `  ref: ${common.ref}`,
    `  commit: ${common.commit}`,
    `  path: ${skill.upstreamPath}`,
    `  license: ${common.license}`,
    `  licenseFile: ${common.licenseFile}`,
    `  upstreamBodyHash: ${upstreamBodyHash}`,
    "---",
  ];
  const md = `${lines.join("\n")}${body.startsWith("\n") ? "" : "\n"}${body}`;

  assertRoundTrips(md, { name, release, skill, common, description, upstreamBodyHash });

  return md;
}

/**
 * Copy every sibling of SKILL.md into destDir, walking nested directories.
 * A copied `.md` file is prompt content exactly like SKILL.md itself — an
 * agent reads `domain.md`'s "see /domain-modeling" the same way it reads
 * SKILL.md's — so it gets the same reference rewrite, wherever it sits in
 * the tree. Anything under `scripts/` (tooling, per `fileRole`) and any
 * non-`.md` file is copied byte-for-byte: a `/word` there is far more likely
 * to be a real shell path than a cross-skill reference, and rewriting a
 * non-text file would simply corrupt it. Every rewritten file's unresolved
 * names are folded into the one `unresolved` set the caller collects.
 */
function copySiblings(
  sourceDir: string,
  destDir: string,
  relDir: string,
  vendoredNames: ReadonlySet<string>,
  allUpstreamNames: ReadonlySet<string>,
  unresolved: Set<string>,
  prefix: string,
  refStyle: ReferenceStyle,
): void {
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (relDir === "" && entry.name === "SKILL.md") continue; // rendered separately
    const relPath = relDir === "" ? entry.name : `${relDir}/${entry.name}`;
    const srcPath = join(sourceDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      if (relDir === "" && SKIPPED_UPSTREAM_DIRS.has(entry.name)) continue;
      mkdirSync(destPath, { recursive: true });
      copySiblings(srcPath, destPath, relPath, vendoredNames, allUpstreamNames, unresolved, prefix, refStyle);
      continue;
    }

    if (relPath.endsWith(".md") && fileRole(relPath) === "prompt") {
      const rewritten = rewriteReferences(
        readFileSync(srcPath, "utf8"),
        vendoredNames,
        allUpstreamNames,
        prefix,
        refStyle,
      );
      for (const unresolvedName of rewritten.unresolved) unresolved.add(unresolvedName);
      writeFileSync(destPath, rewritten.text, "utf8");
    } else {
      cpSync(srcPath, destPath);
    }
  }
}

export function importSkill(args: {
  upstreamRoot: string;
  destDir: string;
  name: string;
  release: string;
  skill: VendorManifestSkill;
  common: VendorCommon;
  vendoredNames: ReadonlySet<string>;
  allUpstreamNames: ReadonlySet<string>;
  refStyle: ReferenceStyle;
}): { unresolved: string[] } {
  const { upstreamRoot, destDir, name, release, skill, common, vendoredNames, allUpstreamNames, refStyle } = args;

  // Everything below hinges on a full `rmSync(destDir)`. If the computed name
  // is not a vendored name — an empty `prefix`, or an `upstreamPath` whose
  // basename collapses — destDir is not a skill folder at all but its parent
  // section directory, and the wipe would take every skill in it. Refuse
  // before touching the filesystem rather than trusting the caller's arithmetic.
  // The prefix is read back off the name rather than taken as an argument:
  // a name that carries no known vendor prefix is exactly the case this guard
  // exists to refuse, so there is nothing to disagree about.
  const prefix = vendorPrefixOf(name);
  if (prefix === undefined) {
    throw new Error(
      `refusing to vendor into "${name}": not one of ${vendorPrefixList()}. ` +
        `Check the import manifest's prefix — the destination wipe would hit a section directory.`,
    );
  }
  if (basename(destDir) !== name) {
    throw new Error(
      `refusing to vendor "${name}" into ${destDir}: the destination's folder name must equal the skill name, ` +
        `or the destination wipe would delete a directory holding other skills.`,
    );
  }

  const sourceDir = join(upstreamRoot, skill.upstreamPath);
  const upstreamBody = bodyOf(readFileSync(join(sourceDir, "SKILL.md"), "utf8"));
  const rewritten = rewriteReferences(upstreamBody, vendoredNames, allUpstreamNames, prefix, refStyle);
  const unresolved = new Set(rewritten.unresolved);

  // ADR-0009 puts every bit of Vertuoza adaptation (vertuoza-context.md) inside
  // the vendored skill's own references/ directory, so the full wipe below
  // would otherwise destroy it on every re-sync. Snapshot it to a temp dir
  // *outside* destDir first — anything inside destDir is what rmSync is about
  // to delete — then restore it before copySiblings runs. The snapshot is
  // restored FIRST, so if upstream ever starts shipping its own references/
  // (it doesn't today: upstream uses flat sibling .md files, never a
  // references/ directory), copySiblings below overwrites same-named files
  // with upstream's copy — upstream wins for anything it ships, and our own
  // files (e.g. vertuoza-context.md, which upstream has no file to overwrite)
  // survive untouched.
  const existingReferences = join(destDir, "references");
  let referencesSnapshot: string | null = null;

  try {
    if (existsSync(existingReferences)) {
      // Assign before the cpSync that populates it, so a throw mid-copy still
      // leaves `referencesSnapshot` pointing at whatever got created and the
      // `finally` below cleans it up rather than leaking a temp dir.
      referencesSnapshot = mkdtempSync(join(tmpdir(), "vz-vendor-refs-"));
      cpSync(existingReferences, referencesSnapshot, { recursive: true });
    }

    // Full replace: a re-sync must not leave behind a file upstream deleted.
    rmSync(destDir, { recursive: true, force: true });
    mkdirSync(destDir, { recursive: true });

    if (referencesSnapshot !== null) {
      mkdirSync(existingReferences, { recursive: true });
      cpSync(referencesSnapshot, existingReferences, { recursive: true });
    }

    copySiblings(sourceDir, destDir, "", vendoredNames, allUpstreamNames, unresolved, prefix, refStyle);

    writeFileSync(
      join(destDir, "SKILL.md"),
      renderVendoredSkillMd({
        name,
        release,
        skill,
        common,
        body: rewritten.text,
        upstreamBodyHash: sha256(upstreamBody),
      }),
      "utf8",
    );
  } finally {
    if (referencesSnapshot !== null) rmSync(referencesSnapshot, { recursive: true, force: true });
  }

  return { unresolved: [...unresolved].sort() };
}

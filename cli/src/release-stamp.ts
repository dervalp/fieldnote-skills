/**
 * Stamping the catalog release into every SKILL.md (ADR-0010). This is the
 * only way a claude.ai copy of a skill can state which release it belongs to,
 * since a manifest does not travel with an uploaded zip.
 */
const BARE_SEMVER = /^\d+\.\d+\.\d+$/;

export function releaseTagFor(version: string): string {
  if (!BARE_SEMVER.test(version)) {
    throw new Error(`Expected a bare semver like 1.0.0, got '${version}' (no leading v, three parts).`);
  }
  return `skills-v${version}`;
}

/** Set `release:` inside the frontmatter only, leaving the body untouched. */
export function stampRelease(text: string, release: string): string {
  if (!text.startsWith("---")) return text;
  const end = text.indexOf("---", 3);
  if (end === -1) return text;

  const head = text.slice(3, end);
  const rest = text.slice(end);
  const line = `release: ${release}`;

  if (/^release:.*$/m.test(head)) {
    return `---${head.replace(/^release:.*$/m, line)}${rest}`;
  }
  // Placed after version: so provenance reads version-then-release; falls back
  // to the end of the frontmatter for a skill that somehow lacks a version.
  if (/^version:.*$/m.test(head)) {
    return `---${head.replace(/^(version:.*)$/m, `$1\n${line}`)}${rest}`;
  }
  return `---${head.replace(/\n?$/, `\n${line}\n`)}${rest}`;
}

/**
 * Upstream suites wire themselves together by name — Pocock's `implement`
 * hands off to `/code-review`, obra's `writing-plans` defers to
 * `superpowers:executing-plans`. Prefixing the folders would point those at
 * nothing, so the vendor script rewrites them mechanically (ADR-0009). The
 * pre-rewrite body hash in the lock is what keeps this auditable rather than
 * "we edited their prose".
 *
 * Each upstream declares which syntax it uses in its import manifest; there is
 * no default, because guessing wrong rewrites nothing and reports nothing.
 */

/**
 * How an upstream names its sibling skills.
 * - `slash` — `/code-review`, rewritten to `/fieldnote-matt-code-review`.
 * - `namespace` — `superpowers:executing-plans`, rewritten to the bare skill
 *   name `fieldnote-superpowers-executing-plans`: the upstream namespace is a
 *   plugin's, and it does not exist once we install the skill under our own.
 *   This style also rewrites `skills/<name>/<file>` paths, which are how obra's
 *   skills point at their own bundled files, into paths that resolve from an
 *   installed skill folder.
 */
export type ReferenceStyle = { kind: "slash" } | { kind: "namespace"; namespace: string };

export interface RewriteResult {
  text: string;
  /** Upstream skill names referenced but not vendored — their refs will dangle. */
  unresolved: string[];
}

// A slash reference is a whole token, guarded on BOTH sides. The lookbehind
// keeps the final segment of a path or URL out (`docs/tdd.md`,
// `https://x.com/tdd`); the lookahead keeps a non-final segment and a longer
// word out (`/tmp/out.md`, `/wizardry`). Losing either guard silently
// corrupts links in the upstream prose this runs over.
const SLASH_REF = /(?<![\w\-/.:])\/([a-z][a-z0-9-]*)(?![a-z0-9-/])/g;

const namespaceRef = (namespace: string): RegExp =>
  new RegExp(`(?<![\\w\\-/.:])${namespace}:([a-z][a-z0-9-]*)(?![a-z0-9-/])`, "g");

// `skills/writing-plans/plan-document-reviewer-prompt.md` — an upstream repo
// path to a file bundled inside a skill. The trailing `/` is required: a bare
// `skills/writing-plans` is prose about the folder, not a file reference.
const skillPathRef = /(?<![\w\-/.:])skills\/([a-z][a-z0-9-]*)\//g;

/**
 * Point every reference to a vendored sibling at its prefixed name, and report
 * the ones we cannot resolve. A reference to an upstream skill we did not
 * vendor is left exactly as written — a wrong guess is worse than a dangling
 * pointer someone can see in the vendor script's warning.
 */
export function rewriteReferences(
  text: string,
  vendored: ReadonlySet<string>,
  allUpstream: ReadonlySet<string>,
  prefix: string,
  style: ReferenceStyle,
): RewriteResult {
  const unresolved = new Set<string>();

  /** Decide one matched name: our name for it, or null to leave it alone. */
  const resolve = (name: string): string | null => {
    if (name.startsWith(prefix)) return null; // already rewritten
    if (vendored.has(name)) return `${prefix}${name}`;
    if (allUpstream.has(name)) unresolved.add(name);
    return null;
  };

  if (style.kind === "slash") {
    const out = text.replace(SLASH_REF, (match, name: string) => {
      const ours = resolve(name);
      return ours === null ? match : `/${ours}`;
    });
    return { text: out, unresolved: [...unresolved].sort() };
  }

  let out = text.replace(namespaceRef(style.namespace), (match, name: string) => {
    const ours = resolve(name);
    return ours === null ? match : ours;
  });

  // `skills/<name>/file.md` -> `../<our-name>/file.md`. Relative to the skill
  // folder the reader is in, which is where an installed skill's own files sit
  // one level up and back down — correct for a self-reference too.
  out = out.replace(skillPathRef, (match, name: string) => {
    const ours = resolve(name);
    return ours === null ? match : `../${ours}/`;
  });

  return { text: out, unresolved: [...unresolved].sort() };
}

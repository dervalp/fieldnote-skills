/**
 * The guard that keeps a published skill portable.
 *
 * A skill in this repository may not name a coordinate that exists in only
 * one repository. It cites `.fieldnote/profile.md` instead. This runs in CI,
 * so the rule is a build failure rather than a review promise.
 *
 * What this catches: a hardcoded reference to the "vertuo" brand, an ADR
 * citation (in its common spellings), and a `libs/`, `apps/`, `packages/`,
 * or `docs/agents/` path — the coordinate classes that actually leaked
 * during this migration.
 *
 * What this does NOT catch, by design: this is a denylist of known leaks,
 * not a general coupling detector. It will miss a hardcoded GitHub org or
 * repo name, a Jira/Linear issue key, an absolute filesystem path, an
 * internal URL or hostname, an env var name specific to one deployment, or
 * any other private coordinate that isn't "vertuo", an ADR, or one of the
 * four path prefixes above. Broadening this into a general-purpose detector
 * is a design project (it risks false positives that block legitimate
 * content) — extend the rule list deliberately, one known leak at a time,
 * the way this file was built, rather than assuming it is comprehensive.
 *
 * The `libs/`/`apps/`/`packages/` rule is also known to be conservative: it
 * cannot distinguish a reference to a private monorepo layout from a
 * generic example using the same path prefix. See CONTRIBUTING.md's note on
 * this rule for what to do when it flags legitimate content, and
 * decoupling.test.ts for the tests that pin this as deliberate, not
 * accidental.
 */

interface Rule {
  re: RegExp;
  say: (hit: string) => string;
}

const RULES: Rule[] = [
  {
    re: /vertuo[a-z-]*/gi,
    say: (hit) => `names "${hit}" — a private repository; remove the reference or rewrite it to be repository-agnostic`,
  },
  {
    re: /\bADR[ -]?\d{1,4}\b/gi,
    say: (hit) => `cites "${hit}" — an ADR the reader does not have; cite the matching field in .fieldnote/profile.md instead`,
  },
  {
    re: /\b(?:libs|apps|packages)\/[A-Za-z0-9._*-]+(?:\/[A-Za-z0-9._*-]+)*/g,
    say: (hit) =>
      `names the path "${hit}" — specific to one repository; remove it or replace it with a repository-agnostic example (see CONTRIBUTING.md if this is a generic example, not a private reference)`,
  },
  {
    re: /\bdocs\/agents\/[A-Za-z0-9._-]+/g,
    say: (hit) => `names the path "${hit}" — cite the profile's Docs section instead`,
  },
];

/** Human-readable violations, empty when the skill is portable. */
export function findCouplingViolations(name: string, body: string): string[] {
  const out: string[] = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    for (const match of body.matchAll(rule.re)) {
      out.push(`${name}: ${rule.say(match[0])}`);
    }
  }
  return out;
}

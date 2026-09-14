/**
 * The guard that keeps a published skill portable.
 *
 * A skill in this repository may not name a coordinate that exists in only
 * one repository. It cites `.fieldnote/profile.md` instead. This runs in CI,
 * so the rule is a build failure rather than a review promise.
 */

interface Rule {
  re: RegExp;
  say: (hit: string) => string;
}

const RULES: Rule[] = [
  {
    re: /vertuo[a-z-]*/gi,
    say: (hit) => `names "${hit}" — a private repository`,
  },
  {
    re: /\bADR ?\d{4}\b/g,
    say: (hit) => `cites "${hit}" — an ADR the reader does not have`,
  },
  {
    re: /\b(?:libs|apps|packages)\/[A-Za-z0-9._*-]+(?:\/[A-Za-z0-9._*-]+)*/g,
    say: (hit) => `names the path "${hit}" — specific to one repository`,
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

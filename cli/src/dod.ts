/**
 * The definition-of-done convention.
 *
 * A repository's definition of done is one document with five FIXED headings,
 * so a skill can locate its own section instead of reading the whole document
 * and hoping. The headings are the stages work passes through, in order, which
 * is what makes the document writable: "when is a slice done?" is unanswerable
 * until you have named the stages.
 *
 * The names live here, in code, because the documentation, the template, and
 * (later) the skill all have to agree on them. A test pins each of those
 * against this list.
 */
export const DOD_SECTIONS = [
  "Always",
  "PRD",
  "Do work",
  "Pull request",
  "Deployment",
] as const;

export type DodSection = (typeof DOD_SECTIONS)[number];

/** Where the convention puts the document: beside `.fieldnote/profile.md`. */
export const DOD_CONVENTION_PATH = ".fieldnote/definition-of-done.md";

/**
 * The basename to look for anywhere else in the repository, for a repository
 * that already had a definition of done before it met this convention.
 */
export const DOD_FILENAME = "definition-of-done.md";

/** `## <heading>` — exactly two hashes and a space, matching the profile's own rule. */
const HEADING_RE = /^##[ \t]+(.+?)[ \t]*$/;

const KNOWN = new Set<string>(DOD_SECTIONS);

/** The convention's sections present in `markdown`, in document order. */
export function findDodSections(markdown: string): string[] {
  const found: string[] = [];
  for (const raw of markdown.split("\n")) {
    const match = HEADING_RE.exec(raw.trim());
    if (!match) continue;
    const heading = match[1]!;
    if (KNOWN.has(heading) && !found.includes(heading)) found.push(heading);
  }
  return found;
}

/** The convention's sections absent from `markdown`, in convention order. */
export function missingDodSections(markdown: string): string[] {
  const present = new Set(findDodSections(markdown));
  return DOD_SECTIONS.filter((section) => !present.has(section));
}

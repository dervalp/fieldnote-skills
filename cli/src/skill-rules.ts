/**
 * Interactive authoring checks for the `new` command, built on the shared
 * skill model in skill-model.ts — the same source the validator uses, so the
 * rules can never drift.
 */
export {
  CATEGORY_LABELS,
  MIN_DESCRIPTION_WORDS,
  NAME_RE,
  VALID_CATEGORIES,
  VALID_SECTIONS,
  VALID_SURFACES,
} from "./skill-model.js";
import { MIN_DESCRIPTION_WORDS, NAME_RE } from "./skill-model.js";

/** Validate a folder/skill name. Returns true or a human-readable reason. */
export function validateName(name: string): true | string {
  if (!NAME_RE.test(name)) {
    return "Name must look like vertuo-<verb>-<noun> (lowercase kebab-case), e.g. vertuo-review-proposal.";
  }
  return true;
}

/**
 * Validate a description against the repo rule: >= 15 words and a "use when"
 * trigger clause. The synonyms guidance is advisory (surfaced in the prompt).
 */
export function validateDescription(desc: string): true | string {
  const words = desc.trim().split(/\s+/).filter(Boolean);
  if (words.length < MIN_DESCRIPTION_WORDS) {
    return `Description has ${words.length} words; needs >= ${MIN_DESCRIPTION_WORDS}. Write it for someone who doesn't know the skill exists, with real synonyms they'd type.`;
  }
  if (!desc.toLowerCase().includes("use when")) {
    return 'Description must contain a "use when …" trigger clause.';
  }
  return true;
}

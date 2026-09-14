/**
 * Render CATALOG.md and catalog.json from discovered skills.
 *
 * - CATALOG.md is what employees read in the Drive folder to learn what's
 *   possible. It is auto-generated — never hand-edit it.
 * - catalog.json is the machine-readable single source of truth the
 *   `fieldnote-skills` CLI consumes to list and install Claude Code skills.
 *
 * Both are built from the same shared skill model, so they can never disagree
 * about a skill's surface or version.
 */
import type { Skill } from "./skill-model.js";
import { stageLabel, VARIANCE_LABELS } from "./skill-model.js";

/**
 * Rendering order of the delivery-loop stages. The display label for each key
 * comes from `stageLabel()` (skill-model.ts) rather than being repeated here,
 * so the labels have exactly one source of truth.
 */
const STAGE_ORDER: readonly string[] = ["plan", "build", "review"];

const byCodepoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function renderMarkdown(skills: Skill[]): string {
  const byStage = new Map<string, Skill[]>();
  for (const key of STAGE_ORDER) byStage.set(key, []);
  for (const skill of skills) {
    const bucket = byStage.get(skill.stage);
    if (bucket) bucket.push(skill);
  }

  const lines = [
    "# fieldnote skills — catalog",
    "",
    "> Auto-generated. Do not edit by hand — run `npm run catalog`.",
    "",
    "Install them all with `/plugin marketplace add dervalp/fieldnote-skills`,",
    "or pick individually with `npx github:dervalp/fieldnote-skills`.",
    "",
  ];

  let total = 0;
  for (const key of STAGE_ORDER) {
    const stageSkills = [...(byStage.get(key) ?? [])].sort((a, b) => byCodepoint(a.name, b.name));
    lines.push(`## ${stageLabel(key) ?? key}`, "");
    if (stageSkills.length === 0) {
      lines.push("_No skills yet._", "");
      continue;
    }
    for (const skill of stageSkills) {
      total += 1;
      const name = skill.name || "(unnamed)";
      const version = skill.version || "?";
      let metadata = `v${version}`;
      const variance = VARIANCE_LABELS[skill.variance as keyof typeof VARIANCE_LABELS];
      if (variance !== undefined) metadata += `, ${variance.toLowerCase()}`;
      lines.push(`- **${name}** (${metadata}) — ${skill.description}`);
    }
    lines.push("");
  }

  const flow = renderArtifactFlow(skills);
  if (flow.length > 0) lines.push(...flow);

  lines.push(`_Total: ${total} skill(s)._`, "");
  return lines.join("\n");
}

/**
 * The typed-artifact dependency graph (ADR-0006), derived from each skill's
 * produces/consumes frontmatter. Empty when no skill declares any artifact.
 */
function renderArtifactFlow(skills: Skill[]): string[] {
  const graph = new Map<string, { producers: string[]; consumers: string[] }>();
  const bucket = (artifact: string): { producers: string[]; consumers: string[] } => {
    let entry = graph.get(artifact);
    if (!entry) {
      entry = { producers: [], consumers: [] };
      graph.set(artifact, entry);
    }
    return entry;
  };
  for (const skill of skills) {
    for (const artifact of skill.produces) bucket(artifact).producers.push(skill.name);
    for (const artifact of skill.consumes) bucket(artifact).consumers.push(skill.name);
  }
  if (graph.size === 0) return [];

  const lines = [
    "## Artifact flow",
    "",
    "Typed artifacts passed between skills. Each artifact's schema ships under `schemas/`.",
    "",
  ];
  for (const artifact of [...graph.keys()].sort(byCodepoint)) {
    const { producers, consumers } = graph.get(artifact)!;
    const parts: string[] = [];
    if (producers.length > 0)
      parts.push(`produced by ${producers.sort(byCodepoint).map((n) => `\`${n}\``).join(", ")}`);
    if (consumers.length > 0)
      parts.push(`consumed by ${consumers.sort(byCodepoint).map((n) => `\`${n}\``).join(", ")}`);
    lines.push(`- **${artifact}** — ${parts.join(" → ")}`);
  }
  lines.push("");
  return lines;
}

export function renderCatalogJson(skills: Skill[]): string {
  const entries = [...skills]
    .sort((a, b) => byCodepoint(a.stage, b.stage) || byCodepoint(a.name, b.name))
    .map((skill) => skill.toCatalogEntry());
  return JSON.stringify({ version: 1, skills: entries }, null, 2) + "\n";
}

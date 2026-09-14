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
import { categoryLabel } from "./skill-model.js";

const SECTION_ORDER: ReadonlyArray<readonly [string, string]> = [
  ["brand", "Brand"],
  ["product-knowledge", "Product Knowledge"],
  ["construction-knowledge", "Construction Knowledge"],
  ["engineering-standards", "Engineering Standards"],
  ["sales-messaging", "Sales Messaging"],
  ["customer-success", "Customer Success"],
];

const byCodepoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function renderMarkdown(skills: Skill[]): string {
  const bySection = new Map<string, Skill[]>();
  for (const [key] of SECTION_ORDER) bySection.set(key, []);
  for (const skill of skills) {
    const bucket = bySection.get(skill.section);
    if (bucket) bucket.push(skill);
  }

  const lines = [
    "# Vertuo AI Playbook — Skill Catalog",
    "",
    "> Auto-generated. Do not edit by hand — run `npm run catalog`.",
    "",
    "These skills load automatically in Claude Desktop when your request matches.",
    "You don't call them — just describe what you want.",
    "",
  ];

  let total = 0;
  for (const [key, title] of SECTION_ORDER) {
    const sectionSkills = [...(bySection.get(key) ?? [])].sort((a, b) => byCodepoint(a.name, b.name));
    lines.push(`## ${title}`, "");
    if (sectionSkills.length === 0) {
      lines.push("_No skills yet._", "");
      continue;
    }
    for (const skill of sectionSkills) {
      total += 1;
      const name = skill.name || "(unnamed)";
      const version = skill.version || "?";
      const category = categoryLabel(skill.category);
      let metadata = `v${version}`;
      if (category !== undefined) metadata += `, ${category}`;
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
    .sort((a, b) => byCodepoint(a.section, b.section) || byCodepoint(a.name, b.name))
    .map((skill) => skill.toCatalogEntry());
  return JSON.stringify({ version: 1, skills: entries }, null, 2) + "\n";
}

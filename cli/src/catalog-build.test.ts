import { strict as assert } from "node:assert";
import { rmSync } from "node:fs";
import { dirname } from "node:path";
import { test } from "node:test";
import { renderCatalogJson, renderMarkdown } from "./catalog-build.js";
import { baseFm, makeSkillsDir, writeSkill } from "./skill-fixtures.js";
import { discover } from "./skill-model.js";

function withSkillsDir(fn: (skillsDir: string) => void): void {
  const skillsDir = makeSkillsDir();
  try {
    fn(skillsDir);
  } finally {
    rmSync(dirname(skillsDir), { recursive: true, force: true });
  }
}

test("catalog.json contains required fields and surface defaulting", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing"));
    writeSkill(
      d,
      "fieldnote-do-work",
      baseFm("fieldnote-do-work", { surface: "code", variance: "configured", mcp: "[jira]" }),
    );

    const catalog = JSON.parse(renderCatalogJson(discover(d)));
    assert.equal(catalog.version, 1);

    const byName = Object.fromEntries(catalog.skills.map((s: { name: string }) => [s.name, s]));
    assert.deepEqual(Object.keys(byName).sort(), ["fieldnote-do-thing", "fieldnote-do-work"]);
    assert.deepEqual(
      Object.keys(byName["fieldnote-do-thing"]).sort(),
      ["description", "mcp", "name", "stage", "surface", "variance", "version"],
    );
    assert.deepEqual(
      Object.keys(byName["fieldnote-do-work"]).sort(),
      ["description", "mcp", "name", "stage", "surface", "variance", "version"],
    );
    assert.equal(byName["fieldnote-do-thing"].surface, "code");
    assert.equal(byName["fieldnote-do-work"].surface, "code");
    assert.equal(byName["fieldnote-do-work"].variance, "configured");
    assert.deepEqual(byName["fieldnote-do-work"].mcp, ["jira"]);
  });
});

test("markdown carries the fieldnote header and install instructions", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing"));
    const md = renderMarkdown(discover(d));
    assert.ok(md.startsWith("# fieldnote skills — catalog\n"), md);
    assert.ok(md.includes("> Auto-generated. Do not edit by hand — run `npm run catalog`."), md);
    assert.ok(md.includes("/plugin marketplace add dervalp/fieldnote-skills"), md);
    assert.ok(md.includes("npx github:dervalp/fieldnote-skills"), md);
    assert.ok(!md.includes("Vertuo AI Playbook"), md);
  });
});

test("markdown groups skills by stage, in plan/build/review order", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-review-thing", baseFm("fieldnote-review-thing", { stage: "review" }));
    writeSkill(d, "fieldnote-plan-thing", baseFm("fieldnote-plan-thing", { stage: "plan" }));
    writeSkill(d, "fieldnote-do-work", baseFm("fieldnote-do-work", { stage: "build", variance: "configured" }));

    const md = renderMarkdown(discover(d));
    assert.ok(md.includes("## Plan"), md);
    assert.ok(md.includes("## Build"), md);
    assert.ok(md.includes("## Review"), md);
    const planIdx = md.indexOf("## Plan");
    const buildIdx = md.indexOf("## Build");
    const reviewIdx = md.indexOf("## Review");
    assert.ok(planIdx < buildIdx && buildIdx < reviewIdx, md);
    assert.ok(md.includes("fieldnote-plan-thing"));
    assert.ok(md.includes("fieldnote-do-work"));
    assert.ok(md.includes("fieldnote-review-thing"));
  });
});

test("markdown lists every skill with version and lowercased variance metadata", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing"));
    writeSkill(d, "fieldnote-do-work", baseFm("fieldnote-do-work", { surface: "code", variance: "configured" }));

    const md = renderMarkdown(discover(d));
    assert.ok(md.includes("fieldnote-do-thing"));
    assert.ok(md.includes("fieldnote-do-work"));
    assert.ok(md.includes("(v1.0.0, configured)"));
    assert.ok(md.includes("_Total: 2 skill(s)._"));
    assert.ok(md.includes("_No skills yet._")); // empty stages still render
  });
});

test("catalog.json carries produces/consumes and markdown renders the artifact flow", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-to-prd", baseFm("fieldnote-to-prd", { surface: "code", produces: "[prd]" }));
    writeSkill(d, "fieldnote-to-issues", baseFm("fieldnote-to-issues", { surface: "code", consumes: "[prd]" }));

    const catalog = JSON.parse(renderCatalogJson(discover(d)));
    const byName = Object.fromEntries(catalog.skills.map((s: { name: string }) => [s.name, s]));
    assert.deepEqual(byName["fieldnote-to-prd"].produces, ["prd"]);
    assert.deepEqual(byName["fieldnote-to-issues"].consumes, ["prd"]);

    const md = renderMarkdown(discover(d));
    assert.ok(md.includes("## Artifact flow"), md);
    assert.ok(md.includes("- **prd** — produced by `fieldnote-to-prd` → consumed by `fieldnote-to-issues`"), md);
  });
});

test("markdown omits the artifact flow section when nothing is declared", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing"));
    const md = renderMarkdown(discover(d));
    assert.ok(!md.includes("## Artifact flow"), md);
  });
});

test("a skill with an unknown stage throws instead of silently vanishing from CATALOG.md", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-bogus-thing", baseFm("fieldnote-bogus-thing", { stage: "bogus" }));
    const skills = discover(d);
    assert.equal(skills[0]!.stage, "bogus", "discover() does not itself reject an unknown stage");
    assert.throws(() => renderMarkdown(skills), /fieldnote-bogus-thing/);
    assert.throws(() => renderMarkdown(skills), /bogus/);
  });
});

test("CATALOG.md renders the setup stage first", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-setup-profile", baseFm("fieldnote-setup-profile", { stage: "setup" }));
    writeSkill(d, "fieldnote-do-work", baseFm("fieldnote-do-work", { stage: "build" }));
    const md = renderMarkdown(discover(d));
    assert.ok(md.indexOf("## Setup") < md.indexOf("## Build"), "Setup precedes Build");
    assert.ok(md.includes("fieldnote-setup-profile"));
  });
});

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
    writeSkill(d, "vertuo-do-thing", baseFm("vertuo-do-thing"));
    writeSkill(d, "vertuo-do-work", baseFm("vertuo-do-work", { surface: "code", variance: "configured", mcp: "[jira]" }));

    const catalog = JSON.parse(renderCatalogJson(discover(d)));
    assert.equal(catalog.version, 1);

    const byName = Object.fromEntries(catalog.skills.map((s: { name: string }) => [s.name, s]));
    assert.deepEqual(Object.keys(byName).sort(), ["vertuo-do-thing", "vertuo-do-work"]);
    assert.deepEqual(
      Object.keys(byName["vertuo-do-thing"]).sort(),
      ["description", "mcp", "name", "stage", "surface", "variance", "version"],
    );
    assert.deepEqual(
      Object.keys(byName["vertuo-do-work"]).sort(),
      ["description", "mcp", "name", "stage", "surface", "variance", "version"],
    );
    assert.equal(byName["vertuo-do-thing"].surface, "code");
    assert.equal(byName["vertuo-do-work"].surface, "code");
    assert.equal(byName["vertuo-do-work"].variance, "configured");
    assert.deepEqual(byName["vertuo-do-work"].mcp, ["jira"]);
  });
});

test("markdown lists every skill with version and variance metadata", () => {
  withSkillsDir((d) => {
    writeSkill(d, "vertuo-do-thing", baseFm("vertuo-do-thing"));
    writeSkill(d, "vertuo-do-work", baseFm("vertuo-do-work", { surface: "code", variance: "configured" }));

    const md = renderMarkdown(discover(d));
    assert.ok(md.includes("vertuo-do-thing"));
    assert.ok(md.includes("vertuo-do-work"));
    assert.ok(md.includes("(v1.0.0, Configured)"));
    assert.ok(md.includes("_Total: 2 skill(s)._"));
    assert.ok(md.includes("_No skills yet._")); // empty stages still render
  });
});

test("catalog.json carries produces/consumes and markdown renders the artifact flow", () => {
  withSkillsDir((d) => {
    writeSkill(d, "vertuo-to-prd", baseFm("vertuo-to-prd", { surface: "code", produces: "[prd]" }));
    writeSkill(d, "vertuo-to-issues", baseFm("vertuo-to-issues", { surface: "code", consumes: "[prd]" }));

    const catalog = JSON.parse(renderCatalogJson(discover(d)));
    const byName = Object.fromEntries(catalog.skills.map((s: { name: string }) => [s.name, s]));
    assert.deepEqual(byName["vertuo-to-prd"].produces, ["prd"]);
    assert.deepEqual(byName["vertuo-to-issues"].consumes, ["prd"]);

    const md = renderMarkdown(discover(d));
    assert.ok(md.includes("## Artifact flow"), md);
    assert.ok(md.includes("- **prd** — produced by `vertuo-to-prd` → consumed by `vertuo-to-issues`"), md);
  });
});

test("markdown omits the artifact flow section when nothing is declared", () => {
  withSkillsDir((d) => {
    writeSkill(d, "vertuo-do-thing", baseFm("vertuo-do-thing"));
    const md = renderMarkdown(discover(d));
    assert.ok(!md.includes("## Artifact flow"), md);
  });
});

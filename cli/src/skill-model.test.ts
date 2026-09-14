import { strict as assert } from "node:assert";
import { rmSync } from "node:fs";
import { dirname } from "node:path";
import { test } from "node:test";
import { baseFm, makeSkillsDir, writeSkill } from "./skill-fixtures.js";
import { discover, fileRole, frontmatterLineErrors, parseFrontmatter } from "./skill-model.js";

function withSkillsDir(fn: (skillsDir: string) => void): void {
  const skillsDir = makeSkillsDir();
  try {
    fn(skillsDir);
  } finally {
    rmSync(dirname(skillsDir), { recursive: true, force: true });
  }
}

test("parseFrontmatter returns null without a leading ---", () => {
  assert.equal(parseFrontmatter("# just a doc"), null);
  assert.equal(parseFrontmatter("---\nname: x"), null); // unterminated block
});

test("parseFrontmatter reads scalars, strips quotes, parses inline lists", () => {
  const fm = parseFrontmatter(
    '---\nname: vertuo-do-thing\nversion: "1.0.0"\nmcp: [jira, "slack"]\nempty: []\n---\nbody',
  );
  assert.deepEqual(fm, {
    name: "vertuo-do-thing",
    version: "1.0.0",
    mcp: ["jira", "slack"],
    empty: [],
  });
});

test("absent surface defaults to desktop", () => {
  withSkillsDir((skillsDir) => {
    writeSkill(skillsDir, "brand", "vertuo-do-thing", baseFm("vertuo-do-thing"));
    assert.equal(discover(skillsDir)[0].surface, "desktop");
  });
});

test("mcp scalar frontmatter still yields a list from the accessor", () => {
  withSkillsDir((skillsDir) => {
    writeSkill(skillsDir, "brand", "vertuo-do-thing", baseFm("vertuo-do-thing", "brand", { mcp: "jira" }));
    assert.deepEqual(discover(skillsDir)[0].mcp, ["jira"]);
  });
});

test("codeSubdirsPresent reports only existing subfolders", () => {
  withSkillsDir((skillsDir) => {
    writeSkill(
      skillsDir,
      "engineering-standards",
      "vertuo-do-work",
      baseFm("vertuo-do-work", "engineering-standards", { surface: "code", category: "engineer" }),
      ["commands", "hooks"],
    );
    assert.deepEqual(discover(skillsDir)[0].codeSubdirsPresent, ["commands", "hooks"]);
  });
});

test("toCatalogEntry includes category only when present", () => {
  withSkillsDir((skillsDir) => {
    writeSkill(skillsDir, "brand", "vertuo-do-thing", baseFm("vertuo-do-thing"));
    const entry = discover(skillsDir)[0].toCatalogEntry();
    assert.deepEqual(Object.keys(entry), ["name", "section", "description", "surface", "version", "mcp"]);
    assert.equal(entry.surface, "desktop");
  });
});

test("produces/consumes inline lists parse via the accessors", () => {
  withSkillsDir((skillsDir) => {
    writeSkill(
      skillsDir,
      "engineering-standards",
      "vertuo-do-work",
      baseFm("vertuo-do-work", "engineering-standards", {
        surface: "code",
        category: "engineer",
        produces: "[prd]",
        consumes: "[prd]",
      }),
    );
    const skill = discover(skillsDir)[0];
    assert.deepEqual(skill.produces, ["prd"]);
    assert.deepEqual(skill.consumes, ["prd"]);
  });
});

test("toCatalogEntry includes produces/consumes only when declared", () => {
  withSkillsDir((skillsDir) => {
    writeSkill(skillsDir, "brand", "vertuo-do-thing", baseFm("vertuo-do-thing"));
    writeSkill(
      skillsDir,
      "engineering-standards",
      "vertuo-do-work",
      baseFm("vertuo-do-work", "engineering-standards", {
        surface: "code",
        category: "engineer",
        produces: "[prd]",
      }),
    );
    const entries = discover(skillsDir).map((s) => s.toCatalogEntry());
    const plain = entries.find((e) => e.name === "vertuo-do-thing")!;
    const producer = entries.find((e) => e.name === "vertuo-do-work")!;
    assert.deepEqual(Object.keys(plain), ["name", "section", "description", "surface", "version", "mcp"]);
    assert.deepEqual(producer.produces, ["prd"]);
    assert.equal(producer.consumes, undefined);
  });
});

test("parses a nested vendored block into a record", () => {
  const fm = parseFrontmatter(
    ["---", "name: vertuo-matt-tdd", "vendored:", "  ref: v1.2.3", "  commit: abc123", "---", "", "# body"].join("\n"),
  );
  assert.deepEqual(fm?.["vendored"], { ref: "v1.2.3", commit: "abc123" });
  assert.equal(fm?.["name"], "vertuo-matt-tdd");
});

test("a bare key that is not an allow-listed block stays a string", () => {
  const fm = parseFrontmatter(["---", "mcp:", "name: vertuo-do-thing", "---", ""].join("\n"));
  assert.equal(fm?.["mcp"], "");
  assert.equal(fm?.["name"], "vertuo-do-thing");
});

test("a wrapped value is reported as a line error", () => {
  const raw = ["name: vertuo-do-thing", "description: Use when the user wants a thing", "  and it wrapped"].join("\n");
  const errors = frontmatterLineErrors(raw);
  assert.equal(errors.length, 1);
  assert.match(errors[0]!, /block key/);
});

test("a non-indented line with no colon is reported", () => {
  const errors = frontmatterLineErrors(["name: vertuo-do-thing", "just prose"].join("\n"));
  assert.equal(errors.length, 1);
  assert.match(errors[0]!, /single line/);
});

test("scripts/ is tooling, everything else is prompt", () => {
  assert.equal(fileRole("scripts/hitl-loop.template.sh"), "tooling");
  assert.equal(fileRole("SKILL.md"), "prompt");
  assert.equal(fileRole("references/fieldnote-context.md"), "prompt");
});

// The spec's role split is `agents/** and scripts/** are tooling`. agents/
// holds another harness's subagent metadata (upstream's agents/openai.yaml),
// which must never reach coreHash or Mastra's prompt bundle.
test("agents/ is tooling too, at any depth", () => {
  assert.equal(fileRole("agents/openai.yaml"), "tooling");
  assert.equal(fileRole("agents/nested/reviewer.md"), "tooling");
  assert.equal(fileRole("agents-guide.md"), "prompt");
});

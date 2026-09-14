import { strict as assert } from "node:assert";
import { rmSync } from "node:fs";
import { dirname } from "node:path";
import { test } from "node:test";
import { baseFm, makeSkillsDir, writeSkill } from "./skill-fixtures.js";
import { NAME_RE, VALID_STAGES, VALID_VARIANCES, discover, fileRole, frontmatterLineErrors, parseFrontmatter } from "./skill-model.js";

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
    '---\nname: fieldnote-do-thing\nversion: "1.0.0"\nmcp: [jira, "slack"]\nempty: []\n---\nbody',
  );
  assert.deepEqual(fm, {
    name: "fieldnote-do-thing",
    version: "1.0.0",
    mcp: ["jira", "slack"],
    empty: [],
  });
});

test("absent surface defaults to code", () => {
  withSkillsDir((skillsDir) => {
    writeSkill(skillsDir, "fieldnote-do-thing", baseFm("fieldnote-do-thing"));
    assert.equal(discover(skillsDir)[0].surface, "code");
  });
});

test("mcp scalar frontmatter still yields a list from the accessor", () => {
  withSkillsDir((skillsDir) => {
    writeSkill(skillsDir, "fieldnote-do-thing", baseFm("fieldnote-do-thing", { mcp: "jira" }));
    assert.deepEqual(discover(skillsDir)[0].mcp, ["jira"]);
  });
});

test("codeSubdirsPresent reports only existing subfolders", () => {
  withSkillsDir((skillsDir) => {
    writeSkill(
      skillsDir,
      "fieldnote-do-work",
      baseFm("fieldnote-do-work", { surface: "code" }),
      ["commands", "hooks"],
    );
    assert.deepEqual(discover(skillsDir)[0].codeSubdirsPresent, ["commands", "hooks"]);
  });
});

test("toCatalogEntry always carries stage and variance", () => {
  withSkillsDir((skillsDir) => {
    writeSkill(skillsDir, "fieldnote-do-thing", baseFm("fieldnote-do-thing"));
    const entry = discover(skillsDir)[0].toCatalogEntry();
    assert.deepEqual(Object.keys(entry).sort(), ["description", "mcp", "name", "stage", "surface", "variance", "version"]);
    assert.equal(entry.stage, "build");
    assert.equal(entry.variance, "universal");
  });
});

test("produces/consumes inline lists parse via the accessors", () => {
  withSkillsDir((skillsDir) => {
    writeSkill(
      skillsDir,
      "fieldnote-do-work",
      baseFm("fieldnote-do-work", {
        surface: "code",
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
    writeSkill(skillsDir, "fieldnote-do-thing", baseFm("fieldnote-do-thing"));
    writeSkill(
      skillsDir,
      "fieldnote-do-work",
      baseFm("fieldnote-do-work", {
        surface: "code",
        produces: "[prd]",
      }),
    );
    const entries = discover(skillsDir).map((s) => s.toCatalogEntry());
    const plain = entries.find((e) => e.name === "fieldnote-do-thing")!;
    const producer = entries.find((e) => e.name === "fieldnote-do-work")!;
    assert.equal(plain.produces, undefined);
    assert.deepEqual(producer.produces, ["prd"]);
    assert.equal(producer.consumes, undefined);
  });
});

test("parses a nested vendored block into a record", () => {
  const fm = parseFrontmatter(
    ["---", "name: fieldnote-matt-tdd", "vendored:", "  ref: v1.2.3", "  commit: abc123", "---", "", "# body"].join(
      "\n",
    ),
  );
  assert.deepEqual(fm?.["vendored"], { ref: "v1.2.3", commit: "abc123" });
  assert.equal(fm?.["name"], "fieldnote-matt-tdd");
});

test("a bare key that is not an allow-listed block stays a string", () => {
  const fm = parseFrontmatter(["---", "mcp:", "name: fieldnote-do-thing", "---", ""].join("\n"));
  assert.equal(fm?.["mcp"], "");
  assert.equal(fm?.["name"], "fieldnote-do-thing");
});

test("a wrapped value is reported as a line error", () => {
  const raw = ["name: fieldnote-do-thing", "description: Use when the user wants a thing", "  and it wrapped"].join(
    "\n",
  );
  const errors = frontmatterLineErrors(raw);
  assert.equal(errors.length, 1);
  assert.match(errors[0]!, /block key/);
});

test("a non-indented line with no colon is reported", () => {
  const errors = frontmatterLineErrors(["name: fieldnote-do-thing", "just prose"].join("\n"));
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

// --- stage/variance (Task 3): the flat tree carries both in frontmatter ----

test("skill names must carry the fieldnote prefix", () => {
  assert.ok(NAME_RE.test("fieldnote-do-work"));
  assert.ok(NAME_RE.test("fieldnote-prd-to-plan"));
  assert.ok(!NAME_RE.test("vertuo-do-work"));
  assert.ok(!NAME_RE.test("do-work"));
});

test("stage and variance are closed sets", () => {
  assert.deepEqual([...VALID_STAGES], ["plan", "build", "review"]);
  assert.deepEqual([...VALID_VARIANCES], ["universal", "configured", "templated"]);
});

test("stage and variance are read from frontmatter, not the directory", () => {
  withSkillsDir((skillsDir) => {
    writeSkill(
      skillsDir,
      "fieldnote-parallel-wave",
      baseFm("fieldnote-parallel-wave", {
        description:
          "Implement a set of mutually independent ready-for-agent issues concurrently, one isolated worktree subagent per issue, each ending in its own pull request.",
        stage: "build",
        variance: "universal",
        version: "0.1.0",
      }),
    );
    const skill = discover(skillsDir)[0]!;
    assert.equal(skill.stage, "build");
    assert.equal(skill.variance, "universal");
    // Not derived from the folder name — there is no parent folder anymore.
    assert.equal(skill.folderName, "fieldnote-parallel-wave");
  });
});

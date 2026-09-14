import { strict as assert } from "node:assert";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { test } from "node:test";
import { baseFm, makeSkillsDir, writeSkill } from "./skill-fixtures.js";
import { discover } from "./skill-model.js";
import { collectErrors } from "./skill-validate.js";

function withSkillsDir(fn: (skillsDir: string) => void): void {
  const skillsDir = makeSkillsDir();
  try {
    fn(skillsDir);
  } finally {
    rmSync(dirname(skillsDir), { recursive: true, force: true });
  }
}

const ENG = "engineering-standards";

const VENDOR_FM = [
  "vendored:",
  "  upstream: https://github.com/mattpocock/skills",
  "  ref: v1.2.3",
  "  commit: 6acc160e",
  "  path: skills/engineering/tdd",
  "  license: MIT",
  "  licenseFile: skills/_vendor/mattpocock/LICENSE",
  "  upstreamBodyHash: sha256:abc",
].join("\n");

/** Splice extra frontmatter lines in just before the closing fence. */
function addFrontmatter(md: string, block: string): void {
  const text = readFileSync(md, "utf8");
  const end = text.indexOf("---", 3);
  writeFileSync(md, `${text.slice(0, end)}${block}\n${text.slice(end)}`, "utf8");
}

test("absent surface defaults to desktop and validates clean", () => {
  withSkillsDir((d) => {
    writeSkill(d, "brand", "vertuo-do-thing", baseFm("vertuo-do-thing"));
    assert.deepEqual(collectErrors(d), []);
    assert.equal(discover(d)[0].surface, "desktop");
  });
});

test("code skill may ship commands/agents/hooks", () => {
  withSkillsDir((d) => {
    writeSkill(d, ENG, "vertuo-do-work", baseFm("vertuo-do-work", ENG, { surface: "code", category: "engineer" }), [
      "commands",
      "agents",
      "hooks",
    ]);
    assert.deepEqual(collectErrors(d), []);
  });
});

test("desktop skill with commands/ is rejected", () => {
  withSkillsDir((d) => {
    writeSkill(d, "brand", "vertuo-do-thing", baseFm("vertuo-do-thing"), ["commands"]);
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("commands")), errors.join("\n"));
  });
});

test("invalid surface value is rejected", () => {
  withSkillsDir((d) => {
    writeSkill(d, "brand", "vertuo-do-thing", baseFm("vertuo-do-thing", "brand", { surface: "mobile" }));
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("surface 'mobile' is invalid")), errors.join("\n"));
  });
});

test("both surface is valid", () => {
  withSkillsDir((d) => {
    writeSkill(d, ENG, "vertuo-do-work", baseFm("vertuo-do-work", ENG, { surface: "both", category: "engineer" }), [
      "hooks",
    ]);
    assert.deepEqual(collectErrors(d), []);
  });
});

test("code skill requires category", () => {
  withSkillsDir((d) => {
    writeSkill(d, ENG, "vertuo-do-work", baseFm("vertuo-do-work", ENG, { surface: "code" }));
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("missing required field 'category'")), errors.join("\n"));
  });
});

test("desktop skill may omit category", () => {
  withSkillsDir((d) => {
    writeSkill(d, "brand", "vertuo-do-thing", baseFm("vertuo-do-thing"));
    assert.deepEqual(collectErrors(d), []);
  });
});

test("invalid category value is rejected", () => {
  withSkillsDir((d) => {
    writeSkill(d, ENG, "vertuo-do-work", baseFm("vertuo-do-work", ENG, { surface: "code", category: "operations" }));
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("category 'operations' is invalid")), errors.join("\n"));
  });
});

test("mcp inline list is accepted and parsed", () => {
  withSkillsDir((d) => {
    writeSkill(d, ENG, "vertuo-do-work", baseFm("vertuo-do-work", ENG, { surface: "code", category: "engineer", mcp: "[jira, slack]" }));
    assert.deepEqual(collectErrors(d), []);
    assert.deepEqual(discover(d)[0].mcp, ["jira", "slack"]);
  });
});

test("mcp scalar is rejected", () => {
  withSkillsDir((d) => {
    writeSkill(d, ENG, "vertuo-do-work", baseFm("vertuo-do-work", ENG, { surface: "code", category: "engineer", mcp: "jira" }));
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("mcp must be an inline list")), errors.join("\n"));
  });
});

test("short description is rejected", () => {
  withSkillsDir((d) => {
    writeSkill(d, ENG, "vertuo-do-work", baseFm("vertuo-do-work", ENG, { surface: "code", category: "engineer", description: "Use when too short." }));
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("words")), errors.join("\n"));
  });
});

test("missing use-when trigger is rejected", () => {
  withSkillsDir((d) => {
    const noTrigger =
      "This rewrites things with plenty of words and several synonyms but it is " +
      "missing the required trigger clause entirely so it should fail validation.";
    writeSkill(d, ENG, "vertuo-do-work", baseFm("vertuo-do-work", ENG, { surface: "code", category: "engineer", description: noTrigger }));
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("use when")), errors.join("\n"));
  });
});

test("produces/consumes inline lists with known artifacts validate clean", () => {
  withSkillsDir((d) => {
    writeSkill(d, ENG, "vertuo-do-work", baseFm("vertuo-do-work", ENG, { surface: "code", category: "engineer", produces: "[prd]", consumes: "[prd]" }));
    assert.deepEqual(collectErrors(d), []);
  });
});

test("produces scalar is rejected", () => {
  withSkillsDir((d) => {
    writeSkill(d, ENG, "vertuo-do-work", baseFm("vertuo-do-work", ENG, { surface: "code", category: "engineer", produces: "prd" }));
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("produces must be an inline list")), errors.join("\n"));
  });
});

test("consumes entry outside VALID_ARTIFACTS is rejected", () => {
  withSkillsDir((d) => {
    writeSkill(d, ENG, "vertuo-do-work", baseFm("vertuo-do-work", ENG, { surface: "code", category: "engineer", consumes: "[nonsense]" }));
    const errors = collectErrors(d);
    assert.ok(
      errors.some((e) => e.includes("consumes entry 'nonsense' is not a known artifact type")),
      errors.join("\n"),
    );
  });
});

test("a complete vendored skill validates clean", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, ENG, "vertuo-matt-tdd", baseFm("vertuo-matt-tdd", ENG, { surface: "both", category: "engineer" }));
    addFrontmatter(md, `supersedes: [tdd]\n${VENDOR_FM}`);
    assert.deepEqual(collectErrors(d), []);
  });
});

test("a vertuo-matt-* skill without a vendored block is rejected", () => {
  withSkillsDir((d) => {
    writeSkill(d, ENG, "vertuo-matt-tdd", baseFm("vertuo-matt-tdd", ENG, { surface: "code", category: "engineer" }));
    const errors = collectErrors(d);
    assert.ok(
      errors.some((e) => e.includes("must declare a 'vendored:' block")),
      errors.join("\n"),
    );
  });
});

test("an explicitly empty supersedes: [] is accepted on a vendored skill", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, ENG, "vertuo-matt-tdd", baseFm("vertuo-matt-tdd", ENG, { surface: "both", category: "engineer" }));
    addFrontmatter(md, `supersedes: []\n${VENDOR_FM}`);
    assert.deepEqual(collectErrors(d), []);
  });
});

test("an incomplete vendored block names the missing fields", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, ENG, "vertuo-matt-tdd", baseFm("vertuo-matt-tdd", ENG, { surface: "code", category: "engineer" }));
    addFrontmatter(md, "supersedes: [tdd]\nvendored:\n  ref: v1.2.3");
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("upstreamBodyHash")), errors.join("\n"));
  });
});

test("a vendored skill without supersedes is rejected", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, ENG, "vertuo-matt-tdd", baseFm("vertuo-matt-tdd", ENG, { surface: "code", category: "engineer" }));
    addFrontmatter(md, VENDOR_FM);
    assert.ok(collectErrors(d).some((e) => e.includes("supersedes")));
  });
});

test("a first-party skill with a vendored block is rejected", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, ENG, "vertuo-do-thing", baseFm("vertuo-do-thing", ENG, { surface: "code", category: "engineer" }));
    addFrontmatter(md, VENDOR_FM);
    assert.ok(collectErrors(d).some((e) => e.includes("only valid on")));
  });
});

test("a wrapped description is rejected", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, "brand", "vertuo-do-thing", baseFm("vertuo-do-thing"));
    addFrontmatter(md, "  a wrapped tail with no key");
    assert.ok(collectErrors(d).some((e) => e.includes("block key")));
  });
});

test("a release: disagreeing with the expected release is rejected", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, "brand", "vertuo-do-thing", baseFm("vertuo-do-thing"));
    addFrontmatter(md, "release: skills-v0.9.0");
    const errors = collectErrors(d, "skills-v1.0.0");
    assert.ok(errors.some((e) => e.includes("skills-v1.0.0")), errors.join("\n"));
  });
});

test("a missing release: is rejected once a release is expected", () => {
  withSkillsDir((d) => {
    writeSkill(d, "brand", "vertuo-do-thing", baseFm("vertuo-do-thing"));
    assert.ok(collectErrors(d, "skills-v1.0.0").some((e) => e.includes("release")));
  });
});

test("release is not checked before the first release", () => {
  withSkillsDir((d) => {
    writeSkill(d, "brand", "vertuo-do-thing", baseFm("vertuo-do-thing"));
    assert.deepEqual(collectErrors(d, "unreleased"), []);
  });
});

test("two skills claiming the same superseded name is rejected", () => {
  withSkillsDir((d) => {
    for (const name of ["vertuo-matt-tdd", "vertuo-matt-implement"]) {
      const md = writeSkill(d, ENG, name, baseFm(name, ENG, { surface: "code", category: "engineer" }));
      addFrontmatter(md, `supersedes: [tdd]\n${VENDOR_FM}`);
    }
    assert.ok(collectErrors(d).some((e) => e.includes("supersedes 'tdd'")));
  });
});

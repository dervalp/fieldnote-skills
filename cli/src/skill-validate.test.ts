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

test("absent surface defaults to code and validates clean", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing"));
    assert.deepEqual(collectErrors(d), []);
    assert.equal(discover(d)[0].surface, "code");
  });
});

test("code skill may ship commands/agents/hooks", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-work", baseFm("fieldnote-do-work", { surface: "code", variance: "configured" }), [
      "commands",
      "agents",
      "hooks",
    ]);
    assert.deepEqual(collectErrors(d), []);
  });
});

test("desktop skill with commands/ is rejected", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing", { surface: "desktop" }), ["commands"]);
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("commands")), errors.join("\n"));
  });
});

test("invalid surface value is rejected", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing", { surface: "mobile" }));
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("surface 'mobile' is invalid")), errors.join("\n"));
  });
});

test("both surface is valid", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-work", baseFm("fieldnote-do-work", { surface: "both", variance: "configured" }), [
      "hooks",
    ]);
    assert.deepEqual(collectErrors(d), []);
  });
});

test("code skill requires variance", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-work", baseFm("fieldnote-do-work", { surface: "code", variance: "" }));
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("missing required field 'variance'")), errors.join("\n"));
  });
});

test("desktop skill may omit variance", () => {
  withSkillsDir((d) => {
    const fm = baseFm("fieldnote-do-thing", { surface: "desktop" });
    delete fm["variance"];
    writeSkill(d, "fieldnote-do-thing", fm);
    assert.deepEqual(collectErrors(d), []);
  });
});

test("invalid variance value is rejected", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-work", baseFm("fieldnote-do-work", { surface: "code", variance: "operations" }));
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("variance 'operations' is invalid")), errors.join("\n"));
  });
});

test("an unknown variance is rejected, naming the allowed values", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-work", baseFm("fieldnote-do-work", { surface: "code", variance: "bespoke" }));
    const errors = collectErrors(d);
    assert.ok(
      errors.some((e) => e.includes("universal") && e.includes("templated")),
      errors.join("\n"),
    );
  });
});

test("a missing stage is rejected", () => {
  withSkillsDir((d) => {
    const fm = baseFm("fieldnote-do-thing");
    delete fm["stage"];
    writeSkill(d, "fieldnote-do-thing", fm);
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("stage")), errors.join("\n"));
  });
});

test("an unknown stage is rejected, naming the allowed values", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing", { stage: "deploy" }));
    const errors = collectErrors(d);
    assert.ok(
      errors.some((e) => e.includes("plan") && e.includes("build") && e.includes("review")),
      errors.join("\n"),
    );
  });
});

test("a skill with a valid stage and variance has no errors", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing", { stage: "build", variance: "universal" }));
    assert.deepEqual(collectErrors(d), []);
  });
});

test("mcp inline list is accepted and parsed", () => {
  withSkillsDir((d) => {
    writeSkill(
      d,
      "fieldnote-do-work",
      baseFm("fieldnote-do-work", { surface: "code", variance: "configured", mcp: "[jira, slack]" }),
    );
    assert.deepEqual(collectErrors(d), []);
    assert.deepEqual(discover(d)[0].mcp, ["jira", "slack"]);
  });
});

test("mcp scalar is rejected", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-work", baseFm("fieldnote-do-work", { surface: "code", variance: "configured", mcp: "jira" }));
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("mcp must be an inline list")), errors.join("\n"));
  });
});

test("short description is rejected", () => {
  withSkillsDir((d) => {
    writeSkill(
      d,
      "fieldnote-do-work",
      baseFm("fieldnote-do-work", { surface: "code", variance: "configured", description: "Use when too short." }),
    );
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("words")), errors.join("\n"));
  });
});

test("missing use-when trigger is rejected", () => {
  withSkillsDir((d) => {
    const noTrigger =
      "This rewrites things with plenty of words and several synonyms but it is " +
      "missing the required trigger clause entirely so it should fail validation.";
    writeSkill(
      d,
      "fieldnote-do-work",
      baseFm("fieldnote-do-work", { surface: "code", variance: "configured", description: noTrigger }),
    );
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("use when")), errors.join("\n"));
  });
});

test("produces/consumes inline lists with known artifacts validate clean", () => {
  withSkillsDir((d) => {
    writeSkill(
      d,
      "fieldnote-do-work",
      baseFm("fieldnote-do-work", { surface: "code", variance: "configured", produces: "[prd]", consumes: "[prd]" }),
    );
    assert.deepEqual(collectErrors(d), []);
  });
});

test("produces scalar is rejected", () => {
  withSkillsDir((d) => {
    writeSkill(
      d,
      "fieldnote-do-work",
      baseFm("fieldnote-do-work", { surface: "code", variance: "configured", produces: "prd" }),
    );
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("produces must be an inline list")), errors.join("\n"));
  });
});

test("consumes entry outside VALID_ARTIFACTS is rejected", () => {
  withSkillsDir((d) => {
    writeSkill(
      d,
      "fieldnote-do-work",
      baseFm("fieldnote-do-work", { surface: "code", variance: "configured", consumes: "[nonsense]" }),
    );
    const errors = collectErrors(d);
    assert.ok(
      errors.some((e) => e.includes("consumes entry 'nonsense' is not a known artifact type")),
      errors.join("\n"),
    );
  });
});

test("a complete vendored skill validates clean", () => {
  withSkillsDir((d) => {
    const md = writeSkill(
      d,
      "fieldnote-matt-tdd",
      baseFm("fieldnote-matt-tdd", { surface: "both", variance: "configured" }),
    );
    addFrontmatter(md, `supersedes: [tdd]\n${VENDOR_FM}`);
    assert.deepEqual(collectErrors(d), []);
  });
});

test("a fieldnote-matt-* skill without a vendored block is rejected", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-matt-tdd", baseFm("fieldnote-matt-tdd", { surface: "code", variance: "configured" }));
    const errors = collectErrors(d);
    assert.ok(
      errors.some((e) => e.includes("must declare a 'vendored:' block")),
      errors.join("\n"),
    );
  });
});

test("an explicitly empty supersedes: [] is accepted on a vendored skill", () => {
  withSkillsDir((d) => {
    const md = writeSkill(
      d,
      "fieldnote-matt-tdd",
      baseFm("fieldnote-matt-tdd", { surface: "both", variance: "configured" }),
    );
    addFrontmatter(md, `supersedes: []\n${VENDOR_FM}`);
    assert.deepEqual(collectErrors(d), []);
  });
});

test("an incomplete vendored block names the missing fields", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, "fieldnote-matt-tdd", baseFm("fieldnote-matt-tdd", { surface: "code", variance: "configured" }));
    addFrontmatter(md, "supersedes: [tdd]\nvendored:\n  ref: v1.2.3");
    const errors = collectErrors(d);
    assert.ok(errors.some((e) => e.includes("upstreamBodyHash")), errors.join("\n"));
  });
});

test("a vendored skill without supersedes is rejected", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, "fieldnote-matt-tdd", baseFm("fieldnote-matt-tdd", { surface: "code", variance: "configured" }));
    addFrontmatter(md, VENDOR_FM);
    assert.ok(collectErrors(d).some((e) => e.includes("supersedes")));
  });
});

test("a first-party skill with a vendored block is rejected", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing", { surface: "code", variance: "configured" }));
    addFrontmatter(md, VENDOR_FM);
    assert.ok(collectErrors(d).some((e) => e.includes("only valid on")));
  });
});

test("a wrapped description is rejected", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing"));
    addFrontmatter(md, "  a wrapped tail with no key");
    assert.ok(collectErrors(d).some((e) => e.includes("block key")));
  });
});

test("a release: disagreeing with the expected release is rejected", () => {
  withSkillsDir((d) => {
    const md = writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing"));
    addFrontmatter(md, "release: skills-v0.9.0");
    const errors = collectErrors(d, "skills-v1.0.0");
    assert.ok(errors.some((e) => e.includes("skills-v1.0.0")), errors.join("\n"));
  });
});

test("a missing release: is rejected once a release is expected", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing"));
    assert.ok(collectErrors(d, "skills-v1.0.0").some((e) => e.includes("release")));
  });
});

test("release is not checked before the first release", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing"));
    assert.deepEqual(collectErrors(d, "unreleased"), []);
  });
});

test("two skills claiming the same superseded name is rejected", () => {
  withSkillsDir((d) => {
    for (const name of ["fieldnote-matt-tdd", "fieldnote-matt-implement"]) {
      const md = writeSkill(d, name, baseFm(name, { surface: "code", variance: "configured" }));
      addFrontmatter(md, `supersedes: [tdd]\n${VENDOR_FM}`);
    }
    assert.ok(collectErrors(d).some((e) => e.includes("supersedes 'tdd'")));
  });
});

test("a templated skill must declare the concerns it reads", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", baseFm("fieldnote-do-thing", { variance: "templated" }));
    const errors = collectErrors(d);
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /variance 'templated' requires a non-empty 'concerns:' list/);
  });
});

test("a templated skill declaring concerns validates clean", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", {
      ...baseFm("fieldnote-do-thing", { variance: "templated" }),
      concerns: "[shared, qa]",
    });
    assert.deepEqual(collectErrors(d), []);
  });
});

test("a concern name outside the advised six is accepted in silence", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", {
      ...baseFm("fieldnote-do-thing", { variance: "templated" }),
      concerns: "[shared, prompts]",
    });
    assert.deepEqual(collectErrors(d), []);
  });
});

test("only a templated skill may declare concerns", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", {
      ...baseFm("fieldnote-do-thing", { variance: "configured" }),
      concerns: "[shared]",
    });
    const errors = collectErrors(d);
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /'concerns:' is only valid on a 'templated' skill/);
  });
});

test("a concern entry must be a kebab-case file stem", () => {
  withSkillsDir((d) => {
    writeSkill(d, "fieldnote-do-thing", {
      ...baseFm("fieldnote-do-thing", { variance: "templated" }),
      concerns: "[Front_End]",
    });
    const errors = collectErrors(d);
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /concerns entry 'Front_End' must be a kebab-case file name/);
  });
});

import { strict as assert } from "node:assert";
import { rmSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { unzipSync } from "fflate";
import { baseFm, makeSkillsDir, writeSkill } from "./skill-fixtures.js";
import { zipSkillDir } from "./skill-package.js";

test("zips the skill with its folder as archive root, excluding .gitkeep", () => {
  const skillsDir = makeSkillsDir();
  try {
    const skillMd = writeSkill(skillsDir, "fieldnote-do-thing", baseFm("fieldnote-do-thing"));
    const skillDir = dirname(skillMd);
    mkdirSync(join(skillDir, "references"), { recursive: true });
    writeFileSync(join(skillDir, "references", "notes.md"), "# notes\n", "utf8");
    writeFileSync(join(skillDir, "references", ".gitkeep"), "", "utf8");

    const entries = unzipSync(zipSkillDir(skillDir));
    assert.deepEqual(Object.keys(entries).sort(), [
      "fieldnote-do-thing/SKILL.md",
      "fieldnote-do-thing/references/notes.md",
    ]);
    assert.equal(Buffer.from(entries["fieldnote-do-thing/references/notes.md"]).toString("utf8"), "# notes\n");
  } finally {
    rmSync(dirname(skillsDir), { recursive: true, force: true });
  }
});

test("dev-only tests/ folders are excluded from the Desktop zip", () => {
  const skillsDir = makeSkillsDir();
  try {
    const skillMd = writeSkill(skillsDir, "fieldnote-do-thing", baseFm("fieldnote-do-thing"));
    const skillDir = dirname(skillMd);
    mkdirSync(join(skillDir, "tests", "fixtures"), { recursive: true });
    writeFileSync(join(skillDir, "tests", "fake-runner.ts"), "export const x = 1;\n", "utf8");
    writeFileSync(join(skillDir, "tests", "fixtures", "a.json"), "{}\n", "utf8");
    mkdirSync(join(skillDir, "scripts"), { recursive: true });
    writeFileSync(join(skillDir, "scripts", "run.sh"), "echo hi\n", "utf8");

    const entries = unzipSync(zipSkillDir(skillDir));
    assert.deepEqual(Object.keys(entries).sort(), [
      "fieldnote-do-thing/SKILL.md",
      "fieldnote-do-thing/scripts/run.sh",
    ]);
  } finally {
    rmSync(dirname(skillsDir), { recursive: true, force: true });
  }
});

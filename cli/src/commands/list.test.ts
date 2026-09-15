import { test } from "node:test";
import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { runList, buildChoices, buildModeChoices, descriptionWidth, rowLabel } from "./list.js";
import { computeRows } from "../state.js";
import { targetDirFor } from "../installer.js";
import { installSkill } from "../installer.js";
import { makeHarness, toEntry } from "../testkit.js";

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

test("list excludes desktop-only skills and groups installable ones by stage", async () => {
  const h = await makeHarness([
    { name: "fieldnote-pretty-ppt", stage: "plan", surface: "desktop" },
    { name: "fieldnote-do-work", stage: "build", surface: "code" },
    { name: "fieldnote-run-agent", stage: "build", surface: "both" },
  ]);
  try {
    const rows = await computeRows(h.env);
    const names = rows.map((r) => r.entry.name).sort();
    assert.deepEqual(names, ["fieldnote-do-work", "fieldnote-run-agent"]);

    const choices = buildChoices(rows);
    // A non-selectable stage header precedes the build-stage skills.
    const header = choices.find((c) => c.disabled);
    assert.ok(header && /Build/.test(header.name));
  } finally {
    await h.cleanup();
  }
});

test("row label shows name, version, description and install state", async () => {
  const h = await makeHarness([{ name: "fieldnote-do-work", stage: "build" }]);
  try {
    let rows = await computeRows(h.env);
    assert.match(rowLabel(rows[0]!), /fieldnote-do-work/);
    assert.match(rowLabel(rows[0]!), /v1\.0\.0/);
    assert.doesNotMatch(rowLabel(rows[0]!), /installed/);

    await installSkill(h.env, toEntry({ name: "fieldnote-do-work", stage: "build" }));
    rows = await computeRows(h.env);
    assert.match(rowLabel(rows[0]!), /✓ installed/);
  } finally {
    await h.cleanup();
  }
});

test("row label is laid out over multiple lines with the description on its own padded line", async () => {
  const h = await makeHarness([{ name: "fieldnote-do-work", stage: "build" }]);
  try {
    const rows = await computeRows(h.env);
    const label = rowLabel(rows[0]!);
    const lines = label.split("\n");
    // Heading first, then an indented wrapped description.
    assert.match(lines[0]!, /^ fieldnote-do-work {2}· {2}v1\.0\.0$/);
    assert.match(lines[1]!, /^ {6}\S/);
    assert.equal(lines.slice(1, -1).map((line) => line.trim()).join(" "), rows[0]!.entry.description);
    // Trailing blank line gives bottom padding.
    assert.equal(lines.at(-1), "");
  } finally {
    await h.cleanup();
  }
});

test("row label truncates a long description to 400 chars with an ellipsis", async () => {
  const h = await makeHarness([
    { name: "fieldnote-do-work", stage: "build", description: "x".repeat(600) },
  ]);
  try {
    const rows = await computeRows(h.env);
    const descText = rowLabel(rows[0]!)
      .split("\n")
      .slice(1)
      .join(" ")
      .replace(/\s+/g, "");
    assert.equal(descText.length, 400);
    assert.ok(descText.endsWith("..."));
  } finally {
    await h.cleanup();
  }
});

test("row label wraps long descriptions with a hanging indent", async () => {
  const h = await makeHarness([
    {
      name: "fieldnote-do-work",
      stage: "build",
      description:
        "Use when an engineer wants a long description that wraps over several terminal lines while staying aligned under the skill name instead of falling back to the far left edge of the screen.",
    },
  ]);
  try {
    const rows = await computeRows(h.env);
    const descLines = rowLabel(rows[0]!).split("\n").slice(1, -1);
    assert.ok(descLines.length > 1);
    assert.ok(descLines.every((line) => /^ {6}\S/.test(line)));
  } finally {
    await h.cleanup();
  }
});

test("ticking a skill in the picker installs it into ~/.claude", async () => {
  const h = await makeHarness([
    { name: "fieldnote-do-work", stage: "build" },
    { name: "fieldnote-run-agent", stage: "build" },
  ]);
  try {
    h.prompter.selectAnswers = ["choose", "build"];
    h.prompter.checkboxAnswers = [["fieldnote-do-work"]];
    await runList(h.env);

    assert.ok(await exists(join(targetDirFor(h.env, "fieldnote-do-work"), "SKILL.md")));
    assert.equal(await exists(join(targetDirFor(h.env, "fieldnote-run-agent"), "SKILL.md")), false);
    assert.ok(h.logger.infos.some((l) => /Installed fieldnote-do-work@1\.0\.0/.test(l)));
  } finally {
    await h.cleanup();
  }
});

test("default list asks for a stage and filters the checkbox picker", async () => {
  const h = await makeHarness([
    { name: "fieldnote-plan-roadmap", stage: "plan" },
    { name: "fieldnote-do-work", stage: "build" },
    { name: "fieldnote-validate-ticket", stage: "review" },
  ]);
  try {
    h.prompter.selectAnswers = ["choose", "plan"];
    h.prompter.checkboxAnswers = [[]];
    await runList(h.env);

    assert.deepEqual(
      h.prompter.lastSelectChoices.map((c) => c.value),
      ["all", "plan", "build", "review"],
    );
    const values = h.prompter.lastCheckboxChoices.map((c) => c.value);
    assert.ok(values.includes("fieldnote-plan-roadmap"));
    assert.equal(values.includes("fieldnote-do-work"), false);
    assert.equal(values.includes("fieldnote-validate-ticket"), false);
  } finally {
    await h.cleanup();
  }
});

test("stage flag skips stage prompt and filters directly", async () => {
  const h = await makeHarness([
    { name: "fieldnote-plan-roadmap", stage: "plan" },
    { name: "fieldnote-do-work", stage: "build" },
  ]);
  try {
    h.prompter.selectAnswers = ["build"];
    h.prompter.checkboxAnswers = [[]];
    await runList(h.env, { stage: "plan" });

    assert.deepEqual(h.prompter.lastSelectChoices, []);
    const values = h.prompter.lastCheckboxChoices.map((c) => c.value);
    assert.ok(values.includes("fieldnote-plan-roadmap"));
    assert.equal(values.includes("fieldnote-do-work"), false);
  } finally {
    await h.cleanup();
  }
});

test("stage picker hides empty stages", async () => {
  const h = await makeHarness([{ name: "fieldnote-plan-roadmap", stage: "plan" }]);
  try {
    h.prompter.selectAnswers = ["choose", "plan"];
    h.prompter.checkboxAnswers = [[]];
    await runList(h.env);

    assert.deepEqual(
      h.prompter.lastSelectChoices.map((c) => c.value),
      ["all", "plan"],
    );
  } finally {
    await h.cleanup();
  }
});

test("stage all keeps the full grouped picker", async () => {
  const h = await makeHarness([
    { name: "fieldnote-plan-roadmap", stage: "plan" },
    { name: "fieldnote-do-work", stage: "build" },
  ]);
  try {
    h.prompter.checkboxAnswers = [[]];
    await runList(h.env, { stage: "all" });

    const values = h.prompter.lastCheckboxChoices.map((c) => c.value);
    assert.ok(values.includes("fieldnote-plan-roadmap"));
    assert.ok(values.includes("fieldnote-do-work"));
  } finally {
    await h.cleanup();
  }
});

test("unknown stage gives a user-facing error", async () => {
  const h = await makeHarness([{ name: "fieldnote-do-work", stage: "build" }]);
  try {
    await assert.rejects(() => runList(h.env, { stage: "sales" }), /Unknown stage "sales"/);
  } finally {
    await h.cleanup();
  }
});

test("selecting nothing installs nothing", async () => {
  const h = await makeHarness([{ name: "fieldnote-do-work", stage: "build" }]);
  try {
    h.prompter.selectAnswers = ["choose", "all"];
    h.prompter.checkboxAnswers = [[]];
    await runList(h.env);
    assert.equal(await exists(targetDirFor(h.env, "fieldnote-do-work")), false);
    assert.ok(h.logger.infos.some((l) => /Nothing selected/.test(l)));
  } finally {
    await h.cleanup();
  }
});

test("description lines fit the terminal, so they never wrap back to column 0", async () => {
  const h = await makeHarness([
    {
      name: "fieldnote-do-work",
      stage: "build",
      description:
        "Use when an engineer wants a long description that wraps over several terminal lines " +
        "while staying aligned under the skill name instead of falling back to the far left " +
        "edge of the screen, whatever width the terminal happens to be.",
    },
  ]);
  try {
    const row = (await computeRows(h.env))[0]!;
    // 80 is the default an inherited pipe reports; the picker must fit it too.
    for (const columns of [80, 100, 120]) {
      const descLines = rowLabel(row, columns).split("\n").slice(1, -1);
      assert.ok(descLines.length > 1, `expected wrapping at ${columns} columns`);
      const tooWide = descLines.filter((line) => line.length > columns);
      assert.deepEqual(tooWide, [], `these lines overflow a ${columns}-column terminal:\n${tooWide.join("\n")}`);
    }
  } finally {
    await h.cleanup();
  }
});

test("an unreported or nonsense terminal width falls back to 80 columns, not to the floor", () => {
  // A pty that never had its window size set reports 0, not undefined — and 0
  // is not nullish, so a `?? 80` fallback sails past it and wraps at the floor.
  assert.equal(descriptionWidth(0), descriptionWidth(80));
  assert.equal(descriptionWidth(-1), descriptionWidth(80));
  assert.equal(descriptionWidth(Number.NaN), descriptionWidth(80));
});

test("description width tracks the terminal between a readable floor and ceiling", () => {
  assert.equal(descriptionWidth(80), 72);
  assert.equal(descriptionWidth(300), 96);
  assert.equal(descriptionWidth(30), 40);
});

test("the first prompt offers everything before it offers a picker", async () => {
  const h = await makeHarness([
    { name: "fieldnote-plan-roadmap", stage: "plan" },
    { name: "fieldnote-do-work", stage: "build" },
  ]);
  try {
    const rows = await computeRows(h.env);
    const choices = buildModeChoices(rows);
    assert.deepEqual(
      choices.map((c) => c.value),
      ["everything", "choose"],
      "everything leads, so enter installs the whole loop",
    );
    assert.match(choices[0]!.name, /2 skills/);
  } finally {
    await h.cleanup();
  }
});

test("choosing everything installs the whole catalog without ever showing the picker", async () => {
  const h = await makeHarness([
    { name: "fieldnote-plan-roadmap", stage: "plan" },
    { name: "fieldnote-do-work", stage: "build" },
    { name: "fieldnote-validate-ticket", stage: "review" },
  ]);
  try {
    h.prompter.selectAnswers = ["everything"];
    await runList(h.env);

    for (const name of ["fieldnote-plan-roadmap", "fieldnote-do-work", "fieldnote-validate-ticket"]) {
      assert.ok(await exists(join(targetDirFor(h.env, name), "SKILL.md")), `${name} installed`);
    }
    assert.deepEqual(h.prompter.lastCheckboxChoices, [], "the picker is never rendered");
  } finally {
    await h.cleanup();
  }
});

test("the all flag installs everything with no prompt at all", async () => {
  const h = await makeHarness([
    { name: "fieldnote-plan-roadmap", stage: "plan" },
    { name: "fieldnote-do-work", stage: "build" },
  ]);
  try {
    await runList(h.env, { all: true });

    assert.ok(await exists(join(targetDirFor(h.env, "fieldnote-plan-roadmap"), "SKILL.md")));
    assert.ok(await exists(join(targetDirFor(h.env, "fieldnote-do-work"), "SKILL.md")));
    assert.deepEqual(h.prompter.lastSelectChoices, [], "no prompt, so it works without a TTY");
    assert.deepEqual(h.prompter.lastCheckboxChoices, []);
  } finally {
    await h.cleanup();
  }
});

test("the all flag narrows to a stage when one is given", async () => {
  const h = await makeHarness([
    { name: "fieldnote-plan-roadmap", stage: "plan" },
    { name: "fieldnote-do-work", stage: "build" },
  ]);
  try {
    await runList(h.env, { all: true, stage: "plan" });

    assert.ok(await exists(join(targetDirFor(h.env, "fieldnote-plan-roadmap"), "SKILL.md")));
    assert.equal(await exists(targetDirFor(h.env, "fieldnote-do-work")), false);
  } finally {
    await h.cleanup();
  }
});

test("the picker starts with every skill ticked, so enter is install-all", async () => {
  const h = await makeHarness([
    { name: "fieldnote-plan-roadmap", stage: "plan" },
    { name: "fieldnote-do-work", stage: "build" },
  ]);
  try {
    const rows = await computeRows(h.env);
    const choices = buildChoices(rows);
    const skills = choices.filter((c) => !c.disabled);
    assert.ok(skills.length > 0);
    assert.ok(skills.every((c) => c.checked === true), "every skill row is pre-ticked");
    assert.ok(
      choices.filter((c) => c.disabled).every((c) => c.checked !== true),
      "stage headers are never ticked",
    );
  } finally {
    await h.cleanup();
  }
});

test("the picker orders stage groups by the loop, not by the alphabet", async () => {
  const h = await makeHarness([
    { name: "fieldnote-run-review", stage: "review" },
    { name: "fieldnote-do-work", stage: "build" },
    { name: "fieldnote-plan-roadmap", stage: "plan" },
    { name: "fieldnote-setup-profile", stage: "setup" },
  ]);
  try {
    const rows = await computeRows(h.env);
    const headers = buildChoices(rows)
      .filter((c) => c.disabled)
      .map((c) => c.name);
    assert.deepEqual(headers, [
      "── Setup ──",
      "── Plan ──",
      "── Build ──",
      "── Review ──",
    ]);
  } finally {
    await h.cleanup();
  }
});

test("setup is a valid stage filter", async () => {
  const h = await makeHarness([
    { name: "fieldnote-setup-profile", stage: "setup" },
    { name: "fieldnote-do-work", stage: "build" },
  ]);
  try {
    h.prompter.checkboxAnswers = [[]];
    await runList(h.env, { stage: "setup" });

    const values = h.prompter.lastCheckboxChoices.map((c) => c.value);
    assert.ok(values.includes("fieldnote-setup-profile"));
    assert.equal(values.includes("fieldnote-do-work"), false);
  } finally {
    await h.cleanup();
  }
});

test("the stage prompt lists setup first", async () => {
  const h = await makeHarness([
    { name: "fieldnote-do-work", stage: "build" },
    { name: "fieldnote-setup-profile", stage: "setup" },
  ]);
  try {
    h.prompter.selectAnswers = ["choose", "setup"];
    h.prompter.checkboxAnswers = [[]];
    await runList(h.env);

    assert.deepEqual(
      h.prompter.lastSelectChoices.map((c) => c.value),
      ["all", "setup", "build"],
    );
  } finally {
    await h.cleanup();
  }
});

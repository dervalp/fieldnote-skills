import { strict as assert } from "node:assert";
import { join } from "node:path";
import { test } from "node:test";
import { resolveAgentHomes } from "./agent-homes.js";

const HOME = "/home/dev";
const CLAUDE = join(HOME, ".claude");
const CODEX = join(HOME, ".codex");

/** An `exists` probe that answers true for exactly the given paths. */
function only(...present: string[]): (path: string) => boolean {
  const set = new Set(present);
  return (path) => set.has(path);
}

test("both agent homes on disk means both get the skills", () => {
  const homes = resolveAgentHomes({ home: HOME, exists: only(CLAUDE, CODEX) });
  assert.deepEqual(homes, [
    { agent: "claude", root: CLAUDE },
    { agent: "codex", root: CODEX },
  ]);
});

test("only Claude on disk leaves Codex out", () => {
  const homes = resolveAgentHomes({ home: HOME, exists: only(CLAUDE) });
  assert.deepEqual(homes, [{ agent: "claude", root: CLAUDE }]);
});

test("only Codex on disk installs there and never creates a Claude home", () => {
  const homes = resolveAgentHomes({ home: HOME, exists: only(CODEX) });
  assert.deepEqual(homes, [{ agent: "codex", root: CODEX }]);
});

test("no agent home at all falls back to Claude, which the installer creates", () => {
  const homes = resolveAgentHomes({ home: HOME, exists: only() });
  assert.deepEqual(homes, [{ agent: "claude", root: CLAUDE }]);
});

test("a Claude override pins the target and stops Codex being detected", () => {
  // The guard the test suite depends on: every test here sets
  // FIELDNOTE_CLAUDE_DIR to a temp dir, and detection running alongside it
  // would write the fixtures into the developer's real ~/.codex/skills.
  const homes = resolveAgentHomes({
    home: HOME,
    overrides: { claude: "/tmp/fixture-claude" },
    exists: only(CLAUDE, CODEX),
  });
  assert.deepEqual(homes, [{ agent: "claude", root: "/tmp/fixture-claude" }]);
});

test("a Codex override alone pins Codex and leaves Claude out", () => {
  const homes = resolveAgentHomes({
    home: HOME,
    overrides: { codex: "/tmp/fixture-codex" },
    exists: only(CLAUDE, CODEX),
  });
  assert.deepEqual(homes, [{ agent: "codex", root: "/tmp/fixture-codex" }]);
});

test("overriding both targets both, Claude first", () => {
  const homes = resolveAgentHomes({
    home: HOME,
    overrides: { claude: "/tmp/fixture-claude", codex: "/tmp/fixture-codex" },
    exists: only(),
  });
  assert.deepEqual(homes, [
    { agent: "claude", root: "/tmp/fixture-claude" },
    { agent: "codex", root: "/tmp/fixture-codex" },
  ]);
});

test("an overridden home is used even when it does not exist yet", () => {
  const homes = resolveAgentHomes({
    home: HOME,
    overrides: { codex: "/tmp/not-there-yet" },
    exists: only(),
  });
  assert.deepEqual(homes, [{ agent: "codex", root: "/tmp/not-there-yet" }]);
});

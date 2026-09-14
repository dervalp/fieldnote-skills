import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "./args.js";

test("parseArgs accepts stage as a value flag", () => {
  assert.deepEqual(parseArgs(["list", "--stage", "build"]), {
    command: "list",
    positionals: [],
    flags: { stage: "build" },
  });
});

test("parseArgs accepts stage equals syntax", () => {
  assert.deepEqual(parseArgs(["list", "--stage=review"]), {
    command: "list",
    positionals: [],
    flags: { stage: "review" },
  });
});

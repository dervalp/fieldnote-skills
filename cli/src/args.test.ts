import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "./args.js";

test("parseArgs accepts category as a value flag", () => {
  assert.deepEqual(parseArgs(["list", "--category", "product"]), {
    command: "list",
    positionals: [],
    flags: { category: "product" },
  });
});

test("parseArgs accepts category equals syntax", () => {
  assert.deepEqual(parseArgs(["list", "--category=qa"]), {
    command: "list",
    positionals: [],
    flags: { category: "qa" },
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { Chalk } from "chalk";
import { renderBanner } from "./banner.js";

test("renderBanner with color off emits the wordmark and no ANSI escapes", () => {
  const banner = renderBanner(new Chalk({ level: 0 }));
  // A distinctive slice of the VERTUOZA block art.
  assert.ok(banner.includes("╚════"), "expected the block-letter wordmark");
  assert.ok(banner.includes("shared Claude Code skills"), "expected the tagline");
  assert.ok(!banner.includes("\x1b"), "expected no ANSI escape sequences when color is off");
});

test("renderBanner with truecolor emits the exact Vertuoza blue (#0050e9)", () => {
  const banner = renderBanner(new Chalk({ level: 3 }));
  // #0050e9 === rgb(0, 80, 233) → 24-bit foreground escape.
  assert.ok(banner.includes("\x1b[38;2;0;80;233m"), "expected the brand-blue truecolor escape");
});

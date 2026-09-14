import { test } from "node:test";
import assert from "node:assert/strict";
import { Chalk } from "chalk";
import { renderBanner, BRAND_PINE } from "./banner.js";

test("the banner carries the lowercase wordmark", () => {
  const out = renderBanner(new Chalk({ level: 0 }));
  assert.match(out, /fieldnote/);
  assert.ok(!out.includes("Fieldnote"), "brand name is always lowercase");
  assert.ok(!/vertuo/i.test(out));
});

test("the banner colours the mark in brand pine", () => {
  const out = renderBanner(new Chalk({ level: 3 }));
  assert.ok(out.includes("["), "expected ANSI colour output");
  assert.equal(BRAND_PINE, "#315b4d");
});

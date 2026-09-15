import { test } from "node:test";
import assert from "node:assert/strict";
import { Chalk } from "chalk";
import { renderBanner, BRAND_EMBER } from "./banner.js";

const ESC = "";

test("the banner carries the lowercase wordmark", () => {
  const out = renderBanner(new Chalk({ level: 0 }));
  assert.match(out, /fieldnote/);
  assert.ok(!out.includes("Fieldnote"), "brand name is always lowercase");
  assert.ok(!/vertuo/i.test(out));
});

test("the banner colours the mark in brand ember, the accent the product paints it with", () => {
  const out = renderBanner(new Chalk({ level: 3 }));
  assert.ok(out.includes(`${ESC}[`), "expected ANSI colour output");
  assert.equal(BRAND_EMBER, "#BE421F");
  // 0xBE 0x42 0x1F as truecolor — the same accent .brand-mark wears.
  assert.ok(out.includes("38;2;190;66;31"), "mark is stroked in ember-600");
});

test("the wordmark takes the terminal's own foreground, never a hardcoded dark pine", () => {
  // pine-900 (#203F36) is the product's ink, but a terminal's background is
  // unknowable from here — hardcoding it hides the wordmark on a dark theme.
  const out = renderBanner(new Chalk({ level: 3 }));
  assert.ok(!out.includes("38;2;32;63;54"), "wordmark must not be painted in pine-900");
  assert.ok(out.includes(`${ESC}[1mfieldnote${ESC}[22m`), "wordmark is plain bold");
});

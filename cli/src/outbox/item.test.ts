import { test } from "node:test";
import assert from "node:assert/strict";
import { floorRank, parseItem } from "./item.js";
import { GOOD_ITEM } from "./fixtures.js";

const FILE = "docs/outbox/1015/s3-01-default-country.md";

test("parses a well-formed item", () => {
  const r = parseItem(GOOD_ITEM, FILE);
  assert.ok(r.ok);
  assert.equal(r.value.rank, "medium");
  assert.equal(r.value.bearsOn, "none");
  assert.equal(r.value.decision, "Which country a new contact gets when none is given.");
});

test("parses the same item saved with CRLF", () => {
  assert.ok(parseItem(GOOD_ITEM.replace(/\n/g, "\r\n"), FILE).ok);
});

test("names every missing field", () => {
  const r = parseItem(GOOD_ITEM.replace("slice: s3\n", "").replace("wave: 2\n", ""), FILE);
  assert.ok(!r.ok);
  assert.ok(r.errors.some((e) => e.includes('"slice"')));
  assert.ok(r.errors.some((e) => e.includes('"wave"')));
});

test("refuses an id that does not match the file name", () => {
  const r = parseItem(GOOD_ITEM, "docs/outbox/1015/other.md");
  assert.ok(!r.ok);
  assert.match(r.errors.join("\n"), /does not match the file name/);
});

test("refuses an unknown rank", () => {
  const r = parseItem(GOOD_ITEM.replace("rank: medium", "rank: low"), FILE);
  assert.ok(!r.ok);
  assert.match(r.errors.join("\n"), /rank "low"/);
});

test("refuses a raised date that is not YYYY-MM-DD", () => {
  const r = parseItem(GOOD_ITEM.replace("raised: 2026-09-23", "raised: 23/09/2026"), FILE);
  assert.ok(!r.ok);
});

test("refuses a medium item that bears on a written rule", () => {
  const r = parseItem(GOOD_ITEM.replace("bears-on: none", "bears-on: shared.md#money"), FILE);
  assert.ok(!r.ok);
  assert.match(r.errors.join("\n"), /below the floor/);
});

test("refuses sections out of order, naming what it found", () => {
  const swapped = GOOD_ITEM.replace("## What I did meanwhile", "## TEMP")
    .replace("## What I had to decide", "## What I did meanwhile")
    .replace("## TEMP", "## What I had to decide");
  const r = parseItem(swapped, FILE);
  assert.ok(!r.ok);
  assert.match(r.errors.join("\n"), /exactly, in order/);
});

test("refuses a duplicated section", () => {
  const r = parseItem(GOOD_ITEM + "\n## What I could not know\n\n(author) again\n", FILE);
  assert.ok(!r.ok);
});

test("refuses an empty section", () => {
  const r = parseItem(GOOD_ITEM.replace("Used the tenant's own country.", ""), FILE);
  assert.ok(!r.ok);
  assert.match(r.errors.join("\n"), /"## What I did meanwhile" is empty/);
});

test("refuses a last section without the (author) mark", () => {
  const r = parseItem(GOOD_ITEM.replace("(author) Whether", "Whether"), FILE);
  assert.ok(!r.ok);
  assert.match(r.errors.join("\n"), /\(author\)/);
});

test("floorRank raises, never lowers", () => {
  assert.equal(floorRank("none", "medium"), "medium");
  assert.equal(floorRank("shared.md#money", "medium"), "high");
  assert.equal(floorRank("shared.md#money", "human-action"), "human-action");
  assert.equal(floorRank("NONE", "medium"), "medium");
});

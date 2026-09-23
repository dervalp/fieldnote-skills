import { test } from "node:test";
import assert from "node:assert/strict";
import { splitFrontMatter } from "./frontmatter.js";

test("splits key: value front matter from the body", () => {
  const r = splitFrontMatter("---\nid: 12\ntitle: A thing: with a colon\n---\n# Body\n");
  assert.ok(!("error" in r));
  assert.deepEqual(r.fields, { id: "12", title: "A thing: with a colon" });
  assert.equal(r.body, "# Body\n");
});

test("reads CRLF files exactly like LF files", () => {
  const r = splitFrontMatter("---\r\nid: 12\r\n---\r\nbody\r\n");
  assert.ok(!("error" in r));
  assert.deepEqual(r.fields, { id: "12" });
  assert.equal(r.body, "body\n");
});

test("accepts a closing --- on the last line with no newline", () => {
  const r = splitFrontMatter("---\nid: 1\n---");
  assert.ok(!("error" in r));
  assert.equal(r.body, "");
});

test("refuses a file with no opening ---", () => {
  const r = splitFrontMatter("id: 1\n");
  assert.ok("error" in r);
  assert.match(r.error, /does not open/);
});

test("refuses unclosed front matter", () => {
  const r = splitFrontMatter("---\nid: 1\n");
  assert.ok("error" in r);
  assert.match(r.error, /never closed/);
});

test("refuses a line that is not key: value", () => {
  const r = splitFrontMatter("---\nid 1\n---\n");
  assert.ok("error" in r);
  assert.match(r.error, /not "key: value"/);
});

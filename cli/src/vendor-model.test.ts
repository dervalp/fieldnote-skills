import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  isVendoredName,
  missingVendorFields,
  REQUIRED_VENDOR_FIELDS,
  vendorPrefixList,
  vendorPrefixOf,
} from "./vendor-model.js";

test("recognises every vendored prefix", () => {
  assert.equal(isVendoredName("fieldnote-matt-tdd"), true);
  assert.equal(isVendoredName("fieldnote-matt-setup-matt-pocock-skills"), true);
  assert.equal(isVendoredName("fieldnote-superpowers-brainstorming"), true);
  assert.equal(isVendoredName("fieldnote-validate-ticket"), false);
  assert.equal(isVendoredName("fieldnote-product-write-user-story"), false);
});

test("a bare prefix with nothing after it is not a vendored name", () => {
  // The destination-wipe guard in importSkill leans on this: "fieldnote-matt-"
  // alone would resolve to the section directory, not a skill folder.
  assert.equal(isVendoredName("fieldnote-matt-"), false);
  assert.equal(isVendoredName("fieldnote-superpowers-"), false);
});

test("names which upstream a vendored skill came from", () => {
  assert.equal(vendorPrefixOf("fieldnote-matt-tdd"), "fieldnote-matt-");
  assert.equal(vendorPrefixOf("fieldnote-superpowers-writing-plans"), "fieldnote-superpowers-");
  assert.equal(vendorPrefixOf("fieldnote-validate-ticket"), undefined);
});

test("the printable prefix list names every upstream", () => {
  assert.equal(vendorPrefixList(), "fieldnote-matt-*, fieldnote-superpowers-*");
});

test("lists every missing provenance field", () => {
  const expected = REQUIRED_VENDOR_FIELDS.filter((f) => f !== "ref").sort();
  assert.deepEqual(missingVendorFields({ ref: "v1.2.3" }).sort(), expected);
});

test("a complete block has nothing missing", () => {
  const complete = Object.fromEntries(REQUIRED_VENDOR_FIELDS.map((f) => [f, "x"]));
  assert.deepEqual(missingVendorFields(complete), []);
});

test("a present-but-blank field counts as missing", () => {
  const blank = Object.fromEntries(REQUIRED_VENDOR_FIELDS.map((f) => [f, "x"]));
  blank["commit"] = "   ";
  assert.deepEqual(missingVendorFields(blank), ["commit"]);
});

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
  assert.equal(isVendoredName("vertuo-matt-tdd"), true);
  assert.equal(isVendoredName("vertuo-matt-setup-matt-pocock-skills"), true);
  assert.equal(isVendoredName("vertuo-superpowers-brainstorming"), true);
  assert.equal(isVendoredName("vertuo-validate-ticket"), false);
  assert.equal(isVendoredName("vertuo-product-write-user-story"), false);
});

test("a bare prefix with nothing after it is not a vendored name", () => {
  // The destination-wipe guard in importSkill leans on this: "vertuo-matt-"
  // alone would resolve to the section directory, not a skill folder.
  assert.equal(isVendoredName("vertuo-matt-"), false);
  assert.equal(isVendoredName("vertuo-superpowers-"), false);
});

test("names which upstream a vendored skill came from", () => {
  assert.equal(vendorPrefixOf("vertuo-matt-tdd"), "vertuo-matt-");
  assert.equal(vendorPrefixOf("vertuo-superpowers-writing-plans"), "vertuo-superpowers-");
  assert.equal(vendorPrefixOf("vertuo-validate-ticket"), undefined);
});

test("the printable prefix list names every upstream", () => {
  assert.equal(vendorPrefixList(), "vertuo-matt-*, vertuo-superpowers-*");
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

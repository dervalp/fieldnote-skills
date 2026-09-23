import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProfile } from "../profile.js";
import { loopConfig } from "./config.js";

test("no profile: defaults, outbox off, and a note saying so", () => {
  const c = loopConfig(null);
  assert.equal(c.inbox, "docs/inbox");
  assert.equal(c.outbox, null);
  assert.equal(c.beforeAfter, "docs/inbox/before-after");
  assert.equal(c.plans, "./plans");
  assert.equal(c.tracker.kind, null);
  assert.match(c.notes.join("\n"), /No \.fieldnote\/profile\.md/);
});

test("reads every folder the profile names", () => {
  const c = loopConfig(
    parseProfile(`## Docs
- **inbox** — specs/inbox
- **outbox** — specs/outbox
- **beforeAfter** — specs/pages
- **plans** — specs/plans

## Tracker
- **kind** — github
- **repo** — acme/app
`),
  );
  assert.equal(c.inbox, "specs/inbox");
  assert.equal(c.outbox, "specs/outbox");
  assert.equal(c.beforeAfter, "specs/pages");
  assert.equal(c.plans, "specs/plans");
  assert.deepEqual(c.tracker, { kind: "github", repo: "acme/app" });
  assert.deepEqual(c.notes, []);
});

test("outbox (none) is off, with no note", () => {
  const c = loopConfig(parseProfile("## Docs\n- **inbox** — docs/inbox\n- **outbox** — (none)\n"));
  assert.equal(c.outbox, null);
  assert.deepEqual(c.notes, []);
});

test("TODO counts as absent: default used and noted", () => {
  const c = loopConfig(parseProfile("## Docs\n- **inbox** — TODO\n- **outbox** — TODO\n"));
  assert.equal(c.inbox, "docs/inbox");
  assert.equal(c.outbox, null);
  assert.match(c.notes.join("\n"), /Docs → inbox/);
  assert.match(c.notes.join("\n"), /Docs → outbox/);
});

test("beforeAfter defaults under a custom inbox", () => {
  const c = loopConfig(parseProfile("## Docs\n- **inbox** — specs\n"));
  assert.equal(c.beforeAfter, "specs/before-after");
});

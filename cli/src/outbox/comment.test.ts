import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMENT_MARKER, formatOutboxComment, ghIssueComments, upsertOutboxComment, type IssueComments } from "./comment.js";

const items = [
  { id: "s2-01-b", rank: "high" as const, decision: "Chose X.\nMore.", file: "f" },
  { id: "s1-01-a", rank: "medium" as const, decision: "Chose Y.", file: "f" },
];

test("the comment carries the marker, one line per item, and the settle hint", () => {
  const body = formatOutboxComment("7", items);
  assert.ok(body.startsWith(COMMENT_MARKER));
  assert.match(body, /\*\*2 open\*\*/);
  assert.match(body, /- \*\*high\*\* `s2-01-b` — Chose X\./);
  assert.doesNotMatch(body, /More\./);
  assert.match(body, /Verdict: agreed/);
});

test("nothing open says so", () => {
  assert.match(formatOutboxComment("7", []), /Nothing open/);
});

class FakeComments implements IssueComments {
  created: string[] = [];
  updated: [number, string][] = [];
  constructor(public existing: { id: number; body: string }[]) {}
  list() { return this.existing; }
  create(body: string) { this.created.push(body); }
  update(id: number, body: string) { this.updated.push([id, body]); }
}

test("creates when no marked comment exists", () => {
  const c = new FakeComments([{ id: 1, body: "unrelated" }]);
  assert.equal(upsertOutboxComment(c, `${COMMENT_MARKER}\nnew`), "created");
  assert.equal(c.created.length, 1);
});

test("updates the marked comment by its id, never another", () => {
  const c = new FakeComments([
    { id: 1, body: "unrelated, newer" },
    { id: 5, body: `${COMMENT_MARKER}\nold` },
  ]);
  assert.equal(upsertOutboxComment(c, `${COMMENT_MARKER}\nnew`), "updated");
  assert.deepEqual(c.updated, [[5, `${COMMENT_MARKER}\nnew`]]);
});

test("unchanged body writes nothing", () => {
  const c = new FakeComments([{ id: 5, body: `${COMMENT_MARKER}\nsame` }]);
  assert.equal(upsertOutboxComment(c, `${COMMENT_MARKER}\nsame`), "unchanged");
  assert.equal(c.updated.length + c.created.length, 0);
});

test("the gh client lists with --paginate and edits by comment id", () => {
  const calls: string[][] = [];
  const gh = (args: string[]) => {
    calls.push(args);
    return args.includes("--paginate") ? '{"id":5,"body":"x"}\n{"id":6,"body":"y"}\n' : "";
  };
  const client = ghIssueComments(gh, "acme/app", "7");
  assert.deepEqual(client.list(), [{ id: 5, body: "x" }, { id: 6, body: "y" }]);
  client.update(5, "b");
  client.create("c");
  assert.deepEqual(calls[1], ["api", "-X", "PATCH", "repos/acme/app/issues/comments/5", "-f", "body=b"]);
  assert.deepEqual(calls[2], ["api", "repos/acme/app/issues/7/comments", "-f", "body=c"]);
});

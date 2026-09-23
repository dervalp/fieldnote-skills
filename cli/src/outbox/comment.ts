/**
 * One comment on the PRD issue listing its open outbox items.
 *
 * Found by its marker and edited by its id — never "edit my last comment",
 * which clobbers whatever the author happened to post most recently.
 */
import type { OpenItem } from "./store.js";

export const COMMENT_MARKER = "<!-- fieldnote-outbox -->";

export function formatOutboxComment(prd: string, items: OpenItem[]): string {
  const lines = [COMMENT_MARKER, `### Outbox — ${prd}`, ""];
  if (items.length === 0) {
    lines.push("Nothing open. Every decision taken without asking has been answered.");
  } else {
    lines.push(`**${items.length} open** — decisions a slice took without asking. Answer each one here:`, "");
    for (const i of items) {
      lines.push(`- **${i.rank}** \`${i.id}\` — ${i.decision.split("\n")[0]}`);
    }
    lines.push(
      "",
      "Reply naming the item, and start your answer with `Verdict: agreed` (keep what was built) or `Verdict: drifted` (change it).",
    );
  }
  return lines.join("\n") + "\n";
}

export interface IssueComments {
  list(): { id: number; body: string }[];
  create(body: string): void;
  update(id: number, body: string): void;
}

export function upsertOutboxComment(
  client: IssueComments,
  body: string,
): "created" | "updated" | "unchanged" {
  const mine = client.list().find((c) => c.body.startsWith(COMMENT_MARKER));
  if (!mine) {
    client.create(body);
    return "created";
  }
  if (mine.body === body) return "unchanged";
  client.update(mine.id, body);
  return "updated";
}

export function ghIssueComments(
  gh: (args: string[]) => string,
  repo: string,
  issue: string,
): IssueComments {
  return {
    list: () =>
      gh(["api", "--paginate", `repos/${repo}/issues/${issue}/comments`, "--jq", ".[] | {id, body}"])
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as { id: number; body: string }),
    create: (body) => {
      gh(["api", `repos/${repo}/issues/${issue}/comments`, "-f", `body=${body}`]);
    },
    update: (id, body) => {
      gh(["api", "-X", "PATCH", `repos/${repo}/issues/comments/${id}`, "-f", `body=${body}`]);
    },
  };
}

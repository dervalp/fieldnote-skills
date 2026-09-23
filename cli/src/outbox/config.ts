/**
 * Where the loop's files live in this repository.
 *
 * `(none)` means someone decided; absent or TODO means nobody answered, so a
 * default is used and a note says which — the command prints the notes once.
 */
import type { Profile } from "../profile.js";

export interface LoopConfig {
  inbox: string;
  /** null when the outbox is off. */
  outbox: string | null;
  beforeAfter: string;
  plans: string;
  tracker: { kind: string | null; repo: string | null };
  notes: string[];
}

function answered(value: string | undefined): string | null {
  return value && value !== "TODO" ? value : null;
}

export function loopConfig(profile: Profile | null): LoopConfig {
  const notes: string[] = [];
  if (!profile) {
    notes.push(
      "No .fieldnote/profile.md — using docs/inbox, outbox off. fieldnote-setup-profile can record the real folders.",
    );
  }
  const docs = profile?.docs ?? {};

  const inbox = answered(docs.inbox) ?? "docs/inbox";
  if (profile && !answered(docs.inbox)) notes.push("Docs → inbox not set — using docs/inbox.");

  const outboxDeclaredOff = profile?.declaredAbsent.has("docs.outbox") ?? false;
  const outbox = answered(docs.outbox);
  if (profile && !outbox && !outboxDeclaredOff) {
    notes.push("Docs → outbox not set — the outbox is off. Set it to a folder to turn it on.");
  }

  return {
    inbox,
    outbox,
    beforeAfter: answered(docs.beforeAfter) ?? `${inbox}/before-after`,
    plans: answered(docs.plans) ?? "./plans",
    tracker: {
      kind: answered(profile?.tracker.kind),
      repo: answered(profile?.tracker.repo),
    },
    notes,
  };
}

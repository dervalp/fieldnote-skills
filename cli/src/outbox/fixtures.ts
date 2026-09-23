/** Test-only helpers for the outbox modules. Excluded from the build in cli/tsconfig.json. */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const GOOD_ITEM = `---
id: s3-01-default-country
prd: 1015
slice: s3
rank: medium
bears-on: none
raised: 2026-09-23
wave: 2
---

## What I had to decide

Which country a new contact gets when none is given.

## What I did meanwhile

Used the tenant's own country.

## What it costs to change later

One default in one function.

## What I could not know

(author) Whether sales wants a blank country instead.
`;

/** A throwaway directory holding `files` (relative path → content). */
export function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "fieldnote-outbox-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

/** GOOD_ITEM re-keyed: its id, rank, bears-on and decision line changed. */
export const item = (id: string, rank: string, bearsOn = "none") =>
  GOOD_ITEM.replace("id: s3-01-default-country", `id: ${id}`)
    .replace("rank: medium", `rank: ${rank}`)
    .replace("bears-on: none", `bears-on: ${bearsOn}`)
    .replace("Which country a new contact gets when none is given.", `Decision ${id}.`);

/** Test-only helpers for the outbox modules. Excluded from the build in cli/tsconfig.json. */
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

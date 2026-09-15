# The definition of done

Every skill in this repository has to answer one question at some point: is
this done? Without a written answer, each one invents its own, they do not
agree with each other, and none of them agree with you.

This document defines where that answer lives and what shape it takes.

## Where it lives

Resolved in this order:

1. `.fieldnote/definition-of-done.md` — the convention, beside `profile.md`
2. any `definition-of-done.md` among the repository's git-tracked files
3. nothing found

Whatever is found is recorded under `Docs → definitionOfDone` in
`.fieldnote/profile.md`. The convention is a default, not a rule: a repository
whose document already lives somewhere else just points at it, and step 2
finds it without being told.

Restricting the search to git-tracked files is deliberate — it keeps the
search out of `node_modules` and any other vendored tree.

## The five sections

The headings are fixed, so a skill can find its own section rather than
reading the whole document and guessing which part applies to it.

```markdown
## Always

Rules that hold at every stage.

## PRD

Done when the Product Requirement Description — what a brainstorm produces —
is ready to be built from.

## Do work

Done when one slice is implemented.

## Pull request

Done when it is ready for someone else to merge.

## Deployment

Done when the change is actually live.
```

The order is the order the work passes through: brainstorm → PRD → do work →
pull request → deployment.

Naming the stages is what makes the document writable. "When is a slice done?"
cannot be answered until a slice has been defined; "when is a pull request
ready to merge?" answers itself.

## Worked example (this repository)

```markdown
# Definition of done

## Always

- Conventional Commit titles; breaking changes marked `!`
- No coordinate that exists in only one repository (`npm run check:decoupling`)

## PRD

- The problem is stated before the solution
- Sliced into tracer-bullet vertical issues, each independently shippable
- Dependencies wired, so "takeable now" is computable

## Do work

- The promised behaviour works, and a test proves it
- `npm run validate` and `npm run check:decoupling` pass
- `cd cli && npm test && npm run typecheck` pass
- `npm run catalog` re-run if any SKILL.md changed, and its output committed —
  never hand-edited

## Pull request

- PR body filled with real evidence, not placeholders
- Every CI check green
- Not merged by its own author

## Deployment

- Release published and installs clean: `npx github:dervalp/fieldnote-skills
  --all` into a scratch `FIELDNOTE_CLAUDE_DIR` puts every skill on disk
- `fieldnote-skills doctor` reports no drift
- README and `docs/the-loop.md` describe what actually ships now
```

## Two bars, not one

The most common mistake is writing a single bar and applying it everywhere.
There are at least two:

- **A slice** is not done because it works on your machine. It is done at a
  green pull request.
- **A PRD** is not done because the last pull request merged. It is done when
  someone else can install or use the thing.

"Deployed" means different things in different repositories: a published
release someone installs, a URL responding, a package on a registry. Say which
one yours is — that section will vary more than the other four.

## Starting one

`templates/definition-of-done.md` is a starter with the five headings and
prompts under each. Copy it to `.fieldnote/definition-of-done.md` and replace
the prompts.

Delete a bullet that does not apply. An empty section is honest; a section
full of aspirations nobody enforces is worse than nothing.

## If you have none

Skills degrade rather than stop: each falls back to its own built-in bar and
says so. But that fallback is a guess about your repository, and it will be
wrong in the ways that matter most — what "tested enough" means, whether a
deploy is part of the job, who is allowed to merge. Writing four bullets under
each heading is a cheaper fix than discovering the mismatch in review.

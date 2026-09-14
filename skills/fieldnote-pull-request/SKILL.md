---
name: fieldnote-pull-request
description: Fill this repository's own PR template with domain impact, business rules, validation evidence, risk, rollback, reviewer focus, and Conventional Commit-aware context. Use when preparing, reviewing, or updating a pull request for this repository.
stage: review
variance: configured
surface: code
version: 0.1.0
release: skills-v0.1.0
---

# Fieldnote Pull Request

Use this skill when opening or updating a PR for this repository.

## Workflow

1. Inspect the diff and identify the primary domain, domains touched, business concepts, and
   technical surfaces.
2. Use `.github/PULL_REQUEST_TEMPLATE.md` as the PR body shape.
3. Fill sections with concrete evidence. Use `No impact` or `Not applicable` when a section truly
   does not apply; do not leave placeholders in a submitted PR.
4. Keep the summary short, then let the domain, solution, validation, risk, and rollback sections do
   the detailed work.
5. Prefer Conventional Commit-shaped commit messages for PR work, as described in the document named
   under `Docs → definitionOfDone` in `.fieldnote/profile.md`.

## Guidance

- Domain impact is about ownership and invariants, not package names.
- Business rules should point to their source of truth: code, schema, ADR, capability doc, product
  rule, or test.
- UI manual test steps should be executable by a reviewer exactly as written.
- Validation evidence should name real commands, checks, manual paths, or reasons a check was not
  run.
- Reviewer focus should call out the riskiest decisions, not repeat the whole summary.
- Rollback can be simple for docs-only or no-data changes, but it should still say what to revert.
- For any UI copy change, add a **translation checklist line**: confirm no user-facing string is
  hardcoded (all read through `t()`), every new key landed in both `fr.json` and `en.json` (key-parity
  passes), and the **French** wording was reviewed first (French is canonical — flag mistranslations as
  a human check; see the rules listed under `Architecture` in `.fieldnote/profile.md`).
- **Where does this string live?** (see `Architecture` in `.fieldnote/profile.md`) State explicitly
  which owner holds each new key:
  - **Shared feature-component lib** (e.g. a shared UI component library) — strings co-located in the
    lib's `src/i18n/<namespace>.<locale>.json`.
  - **App-exclusive chrome** — key stays in the app's `messages/fr.json` / `messages/en.json`.
  - **`system-*` primitive** — must remain text-free; no new i18n keys in primitive libs.
- If this repository's preflight was skipped when the PR was opened, the Summary's last line must read
  `Preflight skipped: <reason>`. A PR without that line was preflighted; a reviewer may hold one
  with it.
- A pull request opened by `/fieldnote-fix-bug` fills the template's **Bug** section (issue, triage, red
  evidence, guard, mutation line) and ends its body with `Closes #<issue>`. Every other pull request
  writes `Not applicable` there.

## References

- PR authoring guide: the document named under `Docs → pullRequest` in `.fieldnote/profile.md`
- Definition of Done: the document named under `Docs → definitionOfDone` in `.fieldnote/profile.md`
- PR template: `.github/PULL_REQUEST_TEMPLATE.md`

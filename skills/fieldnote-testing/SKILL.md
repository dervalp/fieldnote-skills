---
name: fieldnote-testing
description: This repository's own testing conventions. Use when adding, changing, reviewing, or choosing tests; covers red-green-refactor, characterization tests, choosing test level, boundary cases at every validated edge, domain invariants, eval/scorer checks, UI workflow tests, and structured logging/correlation-id assertions.
stage: review
variance: templated
concerns: [shared]
surface: code
version: 0.1.1
release: skills-v0.1.0
---

# Fieldnote Testing

Use this skill when deciding what to test, where to test it, or how to prove a change.

## Workflow

1. Read `.fieldnote/concerns/shared.md` for this repository's own rules before choosing what to
   test — a repository-wide rule can widen what needs coverage or rule out a pattern entirely. If
   the file does not exist, say so once and continue on general practice.
2. Identify the behavior or invariant the change protects.
3. Prefer red-green-refactor when the expected behavior is clear.
4. Add characterization tests before risky refactors.
5. Choose the narrowest test that proves the risk, then add broader coverage only when integration
   is the risk.
6. Run the relevant package or repo check and report skipped checks with a reason.

## Test Selection

- Pure logic, schemas, normalizers, config: unit tests near the code.
- Services and repositories: service/repository tests that prove business rules and persistence
  boundaries.
- Controllers and API boundaries: request validation, response shape, and failure behavior.
- React workflows: component/page tests for states and flows; manual browser evidence when visual or
  interaction risk matters.
- AI capabilities: parser, normalizer, schema-sync, scorer, and eval evidence over prompt wording.

## Repo Conventions

- Boundary cases at every validated edge need invalid-input tests, not only happy paths.
- Business rules should be tested where they live, usually services or capability logic.
- Test data should be small, domain-named, and explicit.
- Avoid brittle snapshots unless the exact output is the behavior.
- For structured logging, assert emitted JSON records and metadata. Do not spy on logger method
  calls as the proof.
- Preserve correlation context in tests that cross HTTP, WebSocket, or async logging paths. Assert
  `correlationId` plus useful bindings like `sessionId` or `feature`.
- Never assert that prompt text, assistant output, audio, transcripts, tokens, or secrets are logged;
  metadata-only logging is the expectation.
- If `.fieldnote/profile.md` has a `Localization` section, keep the **key-parity test** green: every
  locale named under `Localization → locales` must hold exactly the canonical locale's key set
  (`Localization → canonicalLocale`) — no missing keys, no orphans, no empty values, and ICU that
  parses. When you touch a catalog or convert a page, add the keys to every catalog under
  `Localization → catalogs`, and assert converted pages render the canonical locale's strings by
  default (update the existing page test rather than adding a parallel one). A component the rules in
  `.fieldnote/concerns/front-end.md` mark text-free stays text-free and needs no new tests. When the
  repository has no `Localization` section, none of this applies.

## References

- Testing guide: the document named under `Docs → testing` in `.fieldnote/profile.md`
- Verification guide: the document named under `Docs → verification` in `.fieldnote/profile.md`
- Repository rules: `.fieldnote/concerns/` — read the file for the area under test

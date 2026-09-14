---
name: fieldnote-testing
description: This repository's own testing conventions. Use when adding, changing, reviewing, or choosing tests; covers red-green-refactor, characterization tests, choosing test level, boundary cases at every validated edge, domain invariants, eval/scorer checks, UI workflow tests, and structured logging/correlation-id assertions.
stage: review
variance: configured
surface: code
version: 0.1.0
release: skills-v0.1.0
---

# Fieldnote Testing

Use this skill when deciding what to test, where to test it, or how to prove a change.

## Workflow

1. Identify the behavior or invariant the change protects.
2. Prefer red-green-refactor when the expected behavior is clear.
3. Add characterization tests before risky refactors.
4. Choose the narrowest test that proves the risk, then add broader coverage only when integration
   is the risk.
5. Run the relevant package or repo check and report skipped checks with a reason.

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
- For chrome i18n (see the rules listed under `Architecture` in `.fieldnote/profile.md`), keep the
  **key-parity test** green: the `en` catalog must hold exactly the
  canonical `fr` key set — no missing keys, no orphans, no empty values, and ICU that parses. When you
  touch a catalog or convert a page, add the keys to both `fr.json` and `en.json`, and assert converted
  pages render the **French** strings by default (update the existing page test rather than adding a
  parallel one). `system-ui` primitives stay text-free and need no new tests.

## References

- Testing guide: the document named under `Docs → testing` in `.fieldnote/profile.md`
- Verification guide: the document named under `Docs → verification` in `.fieldnote/profile.md`

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

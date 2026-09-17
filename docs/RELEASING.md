# Releasing Fieldnote Skills

1. Run `npm run release 0.1.0` for the intended version.
2. Run `npm run catalog && npm run validate && npm run check:decoupling`.
3. Commit `release.json`, `catalog.json`, `CATALOG.md`, `skills.lock.json`, and stamped skill files through a pull request.
4. After merge, tag the merge commit: `git tag skills-v0.1.0 && git push origin skills-v0.1.0`.
5. The Release workflow validates that the tag, release metadata, and lock agree before creating the GitHub release.

Never retag or overwrite a published release. Publish a new version instead.

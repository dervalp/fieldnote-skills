# Writing a new skill

1. **Copy the template.**

   ```bash
   cp -r templates/skill-template skills/fieldnote-<name>
   ```

2. **Fill in the frontmatter.** `name` (must equal the folder name),
   `description` (15+ words, containing a `use when …` clause), `stage`
   (`plan` / `build` / `review`), `version` (semver), and `variance`
   (`universal` / `configured` / `templated` — see below). `surface`
   defaults to `code`; only set it otherwise if the skill is desktop-only.
   Leave `release` as the template set it — once this repository has cut a
   release, `npm run validate` checks it against `release.json`, and
   `npm run release <version>` is what updates it, not a hand-edit. The
   full field-by-field rule set is in
   [CONTRIBUTING.md](../CONTRIBUTING.md).

3. **Pick a variance honestly.**
   - **`universal`** — the skill needs no fact about the repository it runs
     in. Most generic engineering-practice skills land here.
   - **`configured`** — the skill has one procedure, but some of its facts
     (a label, a command, a doc path) come from `.fieldnote/profile.md`.
   - **`templated`** — the skill's spine is generic but part of it has to be
     authored per repository (a domain-specific rules catalogue, a
     package-graph script). Say so in the description, the way
     `fieldnote-pr-monitor` names its Turbo dependency.

4. **Write the body.** There is no fixed section layout — a one-page
   PR-template filler doesn't need the sections a multi-phase delivery skill
   needs. Write whatever shape the skill's job actually calls for.

5. **Decouple as you write.** Anything specific to one repository — a path,
   a label, an ADR number, a shell command — gets read from
   `.fieldnote/profile.md` instead of hardcoded. See
   [docs/profile.md](profile.md) for the sections the profile defines. If a
   fact the skill needs has nowhere to live in the profile yet, that's worth
   raising, not working around.

6. **Validate and regenerate the catalog.**

   ```bash
   npm run validate
   npm run catalog
   ```

   Commit what `npm run catalog` writes (`CATALOG.md`, `catalog.json`,
   `skills.lock.json`) — never hand-edit those files.

7. **Open a pull request.**

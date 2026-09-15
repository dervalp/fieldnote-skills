# Repository concerns

`.fieldnote/concerns/` is where your repository writes its own rules. A skill
reads the file that matters at the moment it matters — before it touches a UI
file, before it says a change works, when a check goes red.

## The folder

    .fieldnote/concerns/shared.md      rules that bind everywhere in your code
    .fieldnote/concerns/front-end.md   your UI rules
    .fieldnote/concerns/backend.md     your service and API rules
    .fieldnote/concerns/database.md    your schema and migration rules
    .fieldnote/concerns/qa.md          how you actually prove a change works
    .fieldnote/concerns/ci.md          what to do when a check goes red

Those six are **strongly advised, not fixed**. A command-line tool has no
front end. A mobile repository may want `ios.md`. A repository doing model
work may want `prompts.md`. Adding one is dropping in a file — there is no
list anywhere you have to update, and no check will reject the name.

Start from `templates/concerns/`: copy the folder, keep the files you need,
and replace the examples.

## What goes in a file

Short imperative rules, one per bullet. A rule may cite a longer document in
your repository when the detail does not fit in a sentence or two.

    # Front-end

    - No user-facing string is hardcoded. Text is read through this
      repository's translation system with an identifier key.
    - A string rendered by a shared feature component belongs to that
      component's own catalog; a string only one application renders belongs
      to that application's catalog.
    - Primitive component libraries stay text-free — text arrives as props.
      **See:** the front-end guidelines document named under `Docs` in the
      profile.

That citation is what lets a long rule live here as three lines without
losing anything.

Your files may be as framework-specific as your repository is. The starters
we ship cannot be — they have to read sensibly in any repository — but yours
is yours.

## Which file does this sentence belong in

| | Lives in | Example |
|---|---|---|
| A **fact** | `.fieldnote/profile.md` | which command runs the checks |
| A **bar** — when is this done | `.fieldnote/definition-of-done.md` | "every required check is green" |
| A **rule** — how this repository is built | `.fieldnote/concerns/<name>.md` | "SQL lives in migrations and repositories, nowhere else" |
| **Universal practice** | the skill itself | work in small slices; stop after three failed attempts |

A sentence that fits two rows is written wrong — split it.

## What a concern file cannot do

It can **add** constraints. It cannot **remove** steps. You can say "a
migration needs a second reviewer". You cannot switch off writing the test
first, or the stop after three failed attempts. A repository that needs a step
gone is asking for a change to the skill — the same rule the profile already
states about procedure.

## If you write nothing

Every skill degrades rather than stopping. It says so once, at the moment it
looked, and carries on with general practice:

> No `.fieldnote/concerns/shared.md` — using general practice.
> `fieldnote-setup-profile` can draft one.

That fallback is a guess about your repository, and it will be wrong in
exactly the places you care about. Three bullets per file is a cheaper fix
than finding out in review.

## Which skills read which files

A skill that reads concern files declares `variance: templated` and lists the
ones it always reads:

    variance: templated
    concerns: [shared, qa, ci]

`fieldnote-skills doctor` reads that list and tells you which files your
repository does not have.

`fieldnote-do-work` declares `[shared]` — the one it always reads. Which
others it reads depends on what the change touches, which is a judgement, not
something frontmatter can hold.

## The `Architecture` section of the profile

Superseded by `.fieldnote/concerns/shared.md`. It was a bare list with no room
for detail and no way to cite a longer document. Move its bullets into
`shared.md`; `fieldnote-setup-profile` will offer to do it for you.

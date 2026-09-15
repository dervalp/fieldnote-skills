# Definition of done

Copy this to `.fieldnote/definition-of-done.md` and replace each bullet with
what is actually true here. Keep the five headings exactly as they are — a
skill looks for its own section by name.

Delete a bullet that does not apply. An empty section is honest; a section
full of aspirations you do not enforce is worse than nothing.

## Always

Rules that hold at every stage.

- <e.g. commit titles follow a stated convention>
- <e.g. no secret, token, or credential is ever committed>

## PRD

Done when the Product Requirement Description is ready to be built from.

- <the problem is stated before the solution>
- <sliced into vertical slices, each one shippable on its own>
- <dependencies between slices are recorded, so "takeable now" is computable>

## Do work

Done when one slice is implemented.

- <the promised behaviour works, and a test proves it>
- <the command that runs this repository's checks passes>
- <generated files were regenerated, not hand-edited>

## Pull request

Done when it is ready for someone else to merge.

- <the description carries real evidence, not placeholders>
- <every required check is green>
- <it is not merged by its own author>

## Deployment

Done when the change is actually live.

- <the release or deploy step ran and succeeded>
- <someone can use the change through the real product surface>
- <the documentation describes what now ships>

A slice is not done because it works on your machine. It is done at a green
pull request. A PRD is not done because the last pull request merged. It is
done when someone else can use the thing.

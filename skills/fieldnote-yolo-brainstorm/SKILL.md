---
name: fieldnote-yolo-brainstorm
description: Explore an idea to a settled design, then write it down as a spec file in the repository with its plan already cut into slices and waves, so an unattended build can start the moment the brainstorm ends. Use when someone wants a change built without being asked questions along the way — "brainstorm and yolo it", "spec this so it can run overnight", "design it, then build it without me". Pairs with fieldnote-yolo-deliver, whose command it prints last.
stage: plan
variance: configured
surface: code
version: 0.1.0
release: skills-v0.1.0
---

# Fieldnote Yolo Brainstorm

The same design conversation as `fieldnote-brainstorming`, ending somewhere else. That skill ends
with a PRD issue a human tickets into child issues. This one ends with everything an **unattended
build** needs, committed to a feature branch:

- an **inbox file** — the spec, as a file in the repository;
- a **plan** — slices, the files each one touches, and the waves they run in;
- a **before/after** a person can open, and **acceptance scenarios** in the domain's words.

After this skill, nobody is asked anything until the feature pull request is green. So this is the
last moment a human is at the keyboard — every question that can be answered, gets answered here.

This skill is self-contained: it depends on no other skill being installed. Its mechanics — what a
well-formed inbox file is — are checked by the `fieldnote-skills outbox check` command, never by
reading this page.

## When to use

- **Use** when a change is wanted, the design is not settled, and the build should run without
  stopping to ask.
- **Do not use** when a human wants to merge every slice (use `fieldnote-brainstorming`), for a bug
  with a known cause, or to write code.

## Before you start: the profile

Facts come from `.fieldnote/profile.md`, exactly as in `fieldnote-brainstorming`: `(none)` means
decided — skip it; a value means use it; absent or `TODO` means **look in the repository, don't ask**,
and say in one line what you found. A missing profile never stops the brainstorm.

This skill reads:

| Key | Used for | Absent |
| --- | -------- | ------ |
| `Docs → inbox` | where the inbox file goes | `docs/inbox` |
| `Docs → beforeAfter` | where the before/after page goes | `<Docs → inbox>/before-after` |
| `Docs → plans` | where the plan goes | `./plans` |
| `Docs → outbox` | whether the outbox is on — said in the Handoff | off |
| `Docs → glossary`, `Docs → scenarios`, `Docs → acceptance`, `Commands → scenarioCheck` | step 3 | as in `fieldnote-brainstorming` |
| `Tracker → kind` | `github`: a PRD issue points at the inbox file; anything else: the file is the whole spec | the git remote's host |
| `Labels → prd`, `Labels → phase0` | labels | `prd`, `phase-0` |
| `Merge policy → specOnMain` | whether step 6 runs | `false` |
| `Git → baseRemote`, `Git → baseBranch` | where the feature branch is cut from | `origin`, `main` |
| `Parallelism → waveSize` | the widest a wave may be | `3` |

Run the CLI as `npx github:dervalp/fieldnote-skills outbox …` (or `fieldnote-skills outbox …` where
it is installed). It prints once which defaults it used.

---

## 1. Brainstorm to a settled design

> The method in this section is adapted from the `brainstorming` skill in
> [obra/superpowers](https://github.com/obra/superpowers) — MIT licensed, Copyright (c) 2025 Jesse
> Vincent. The full notice is at the end of this file. It is reproduced here rather than invoked, so
> this skill works on a bare install. **What changed:** where it ends. The original writes a design
> document and hands off to a plan-writing skill; this one hands off to steps 2–7 below, and its spec
> self-review became the inbox-file self-review in step 4.

### The hard gate

**Do not invoke an implementation skill, write code, scaffold a project, or take any implementation
action until you have told your human partner what you intend and they have approved it.** This
applies on every path below. The ceremony scales with the task; the approval gate never does.

### Three paths

Before your first question, classify the request and **say the classification out loud** — "this looks
bounded, so I'll present a short design here rather than go the whole way" — so your partner can
override it.

| Path              | What it is                                                                                                                                                      | Where it ends            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Spike**         | A feasibility question ("can we…", "is it possible…", "quick and dirty is fine") whose output is an answer, not code you keep.                                   | Step 1. Nothing else.    |
| **Bounded**       | A well-scoped change to code **that already exists in this repository**: a new flag, a small endpoint, a one-file fix.                                           | Steps 3, 4, 5 and 7 (plus 6 when the profile asks). |
| **Architectural** | New projects, new subsystems, changes that restructure how components fit together or alter interfaces others depend on.                                        | Steps 2 through 7.       |

- A **spike** presents the question and what you'll try in two or three sentences, gets a nod, then
  finds out as cheaply as correctness allows. Report findings as a recommendation; anything you built
  stays labelled throwaway.
- **Bounded** means the flow you are changing **is already here to read**. Understanding the kind of
  application is not enough. If there is no existing flow to change, the task is not bounded. Ask the
  clarifying questions that matter, present a short design in chat, stop for approval.
- **Architectural** runs the full process: questions, approaches, a sectioned design, approval.

**When in doubt between two paths, take the heavier one.** The ratchet is one-way: hidden complexity
discovered mid-task upgrades the path — stop, say so, step up. Nothing downgrades mid-task.

### Anti-pattern: "too simple to need approval"

Every path ends with your partner approving your intent before implementation. A one-function utility,
a configuration change — the design may be two sentences in chat, but you **must** present it and get
approval. "Simple" tasks are where unexamined assumptions cause the most wasted work. What scales with
simplicity is the artifact, never the approval.

### Red flags

| Thought                                                               | Reality                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| "This is too simple to need a design"                                 | Simple means a short design, not no design. Two sentences in chat, then approval.           |
| "I'll call it bounded and skip the rest"                              | Reaching for a label to skip work **is** the doubt — take the heavier path.                 |
| "It's bounded and the design is obvious — I'll start while they read" | The gate is the approval, not the design's length. Present, then stop until you hear yes.   |
| "I understand this kind of app, so it's bounded"                      | Bounded measures the repository, not your familiarity. A new project has no existing flow.  |
| "The spike works, so I'll keep the code"                              | A spike's output is an answer. Keeping the code is a new request — classify it.             |
| "It grew, but I'm almost done — no need to re-classify"               | Hidden complexity upgrades the path mid-task. Stop and say so.                              |
| "They approved the spike, so the follow-up is approved too"           | Each task gets its own classification and its own approval.                                 |
| "The design is approved, so I can skip the inbox file"                | An approved design that lives only in this transcript dies with it. Step 4 is not optional. |

### Checklists

Classify first, announce the path, then work the list in order.

**Spike**

1. Explore project context — enough to frame the probe
2. Present the question and the probe plan — two or three sentences
3. Get approval — a nod is enough
4. Investigate — as cheaply as correctness allows
5. Report findings — a recommendation; label anything built as throwaway

**Bounded**

1. Explore project context — files, documents, recent commits
2. Ask clarifying questions — one at a time, the ones that matter
3. Present a short design in chat — approach, what it touches, how it is tested
4. Get approval — **stop and wait for an explicit yes**; presenting the design and starting in the same
   breath is skipping the gate
5. Go to steps 3 (observable behaviour only), 4, 5 and 7 (plus 6 when the profile asks)

**Architectural**

1. Explore project context — files, documents, recent commits
2. Ask clarifying questions — one at a time: purpose, constraints, success criteria
3. Propose two or three approaches — trade-offs, and your recommendation
4. Present the design in sections scaled to their complexity; get approval after each section
5. Go to steps 2 through 7

### The conversation itself

A spike stops at "present the probe, get a nod". Everything from *Exploring approaches* onward is
architectural depth — for bounded work, context plus a few questions plus a short in-chat design is the
whole process.

**Understanding the idea**

- Check the current project state first — files, documents, recent commits.
- Before asking detailed questions, assess scope. If the request describes several independent
  subsystems ("a platform with chat, file storage, billing and analytics"), flag it immediately. Don't
  spend questions refining the details of something that needs decomposing first.
- If it is too large for one inbox file, help decompose it into sub-projects: what the independent
  pieces are, how they relate, what order they get built in. Then brainstorm the first one through the
  normal flow. **Each sub-project gets its own inbox file.**
- For appropriately scoped work, ask questions **one at a time**.
- Prefer multiple-choice questions where they fit; open-ended is fine too.
- **One question per message.** If a topic needs more exploring, break it into several questions.
- Focus on purpose, constraints, success criteria.

**Exploring approaches**

- Propose two or three approaches with their trade-offs.
- Present them conversationally, leading with your recommendation and why.
- **YAGNI ruthlessly** — cut unnecessary features from every approach and from the design.

**Presenting the design**

- Once you believe you understand what you are building, present it.
- Scale each section to its complexity: a few sentences when it is straightforward, up to two or three
  hundred words when it is nuanced.
- Ask after each section whether it looks right so far.
- Cover architecture, components, data flow, error handling, testing.
- Be ready to go back and clarify when something doesn't make sense.

**Design for isolation and clarity**

- Break the system into smaller units that each have one clear purpose, talk through well-defined
  interfaces, and can be understood and tested on their own.
- For each unit, you should be able to answer: what does it do, how do you use it, what does it depend
  on?
- Can someone understand what a unit does without reading its internals? Can you change the internals
  without breaking its callers? If not, the boundaries need work.
- Smaller, well-bounded units are also easier for an agent to work with — you reason better about code
  you can hold in context at once, and your edits are more reliable when files are focused. A file
  growing large is usually a signal that it is doing too much.

**Working in an existing codebase**

- Explore the current structure before proposing changes. Follow the patterns already there.
- Where existing code has problems that affect this work — a file that has grown too large, unclear
  boundaries, tangled responsibilities — include targeted improvements in the design, the way a good
  developer improves the code they are working in.
- Don't propose unrelated refactoring. Stay on what serves the current goal.

**Nothing below this line starts before the design is approved.** A spike ends here.

---

## 2. Before and after

Make the change visible to someone who was not in the conversation — and to the agents that will
build it, which cannot open a private link.

- A change with a **screen** — the screen today and after, side by side.
- A change to an **API or an agent's behaviour** — the exchange today and after, or a flow diagram.
- A change with **nothing to show** skips this step and says so in the Handoff.

Write **one self-contained HTML file** under `Docs → beforeAfter`, named `<topic>.html`: inline CSS
and SVG, no external asset, no build step, no embedded base64 image, under 512 KB. **Never a private
hosted page** — the unattended build must be able to read it from the branch.

## 3. Acceptance scenarios, in the domain's words

Exactly step 3 of `fieldnote-brainstorming`: glossary words first (curate missing ones into the
glossary in the same commit), declarative scenarios where `Docs → scenarios` says, a pending marker
your runner honours, `Commands → scenarioCheck` when the profile names one. With no harness, the
scenarios go into the inbox file's Acceptance criteria, marked *"no harness — ordinary tests"*.

## 4. The spec: an inbox file

1. **Cut the feature branch** in a worktree:

   ```bash
   git fetch <baseRemote>
   git worktree add <path> -b feat/<topic> <baseRemote>/<baseBranch>
   ```

2. **With a GitHub tracker**, create the PRD issue first — its number is the spec's id. Its body is
   a pointer, not the spec:

   ```markdown
   The spec is a file: `<Docs → inbox>/<id>-<topic>.md` on `feat/<topic>`.
   This issue tracks it and is where outbox answers are posted.

   ## Handoff

   - Next command: `/fieldnote-yolo-deliver <id>`
   - Branch: `feat/<topic>`
   ```

   ```bash
   gh issue create --title "PRD: <topic>" --label <Labels → prd> --body-file <file>
   ```

   Then edit the placeholder `<id>` in the body to the issue's number. **Without a GitHub
   tracker**, the id is today's date as `YYYYMMDD`; if an inbox file with that id exists, add one to
   it until it is free.

3. **Write the inbox file** at `<Docs → inbox>/<id>-<topic>.md`:

   ```markdown
   ---
   id: <id>
   title: <topic, in words>
   blocked-by: none            # or [966, 970] — declared by a human, never inferred
   plan: none
   tracker: <github|file>
   ---

   ## Problem

   ## Solution

   ## Decisions

   ## User stories

   ## Scope

   ## Test seams

   ## Risks

   ## Delivery

   ## Acceptance criteria

   <Every scenario from step 3, verbatim, under the path of its file.>

   ## Handoff

   - Next command: `/fieldnote-yolo-deliver <id>`
   - Branch: `feat/<topic>`
   - Plan: <filled in step 5>
   - Scenarios: `<path>` … (or "none — no observable behaviour")
   - Pending marker: <mechanism> (or "none")
   - Before/after: `<path>` (or "none")
   - Outbox: on (`<Docs → outbox>`) | off — an open question stops its slice
   ```

   `blocked-by` names other inbox ids only when **the person says so** — never infer a dependency.
   The front matter never carries a status, a branch, a priority or a value; the check refuses them.
   A declared blocker's inbox file may still live only on its own unmerged `feat/<topic>` branch —
   see the note on `outbox check` in step 4.4 below.

4. **Self-review, then check.** Placeholders, contradictions between Solution and Acceptance
   criteria, scope too big for one feature, anything readable two ways — fix inline. Then run
   `outbox check`. Red means the file is wrong; fix the file — **except** `blocked-by N names no
   inbox file`, which is expected whenever `N`'s inbox file lives only on its own unmerged
   `feat/<topic>` branch and is not in this checkout. That one failure is never "fixed" by removing
   the dependency; every other red means the file is wrong.

5. **Commit and push** the inbox file, the before/after, the scenarios and any glossary change on
   `feat/<topic>`.

## 5. The plan: slices, territories, waves

Write `<Docs → plans>/<YYYY-MM-DD>-<topic>.md`:

```markdown
# <topic> — plan

Spec: `<Docs → inbox>/<id>-<topic>.md`

## Slices

### s1 — <one-line goal>

- Activates: <scenario names, or "none">
- Territory: `<path>`, `<path>/` …
- Needs: none | s<n>, …
- Done when: <one testable sentence>

### s2 — …

## Waves

- Wave 1: s1, s3
- Wave 2: s2
```

Rules for cutting it:

- **A slice is a tracer bullet** — one thin behaviour end to end, small enough to review in one
  sitting, with its own "done when".
- **Territory is a promise.** It lists every file and folder the slice will touch. Read the code to
  write it; don't guess.
- **Waves.** A slice goes in the first wave after every slice it `Needs`. Two slices whose
  territories overlap never share a wave — move the later one down. No wave is wider than
  `Parallelism → waveSize`.
- **A question you cannot answer from the spec** is asked now, while the person is here. If they
  cannot answer it either, write it into the spec's Decisions as the option easiest to undo and say
  so — the build will not ask.

Set the inbox file's `plan:` to the plan's path and its Handoff's Plan line, run `outbox check`,
commit, push.

## 6. Spec on the base branch — only when the profile asks

Skip this step unless `Merge policy → specOnMain` is `true`.

Put the same files on the base branch through a docs-only pull request a human merges:

```bash
git fetch <baseRemote>
git worktree add <path> -b docs/spec-<topic> <baseRemote>/<baseBranch>
git -C <path> checkout feat/<topic> -- <inbox file> <plan> <before/after> <scenario files> <glossary, if changed>
```

Copy with `checkout`, never by retyping, so both branches hold byte-identical files. The pull request
carries **no source file**; label it `Labels → phase0`; its body references the PRD issue without
closing it. **Never merge it.** `fieldnote-yolo-deliver` refuses to start until it is merged.

## 7. The next command

Ask for a read, then print the next command alone on the last line of your reply:

> "Spec `<inbox file>` and plan `<plan>` are on `feat/<topic>`<, and the docs-only pull request
> #<n> is waiting for a merge>. Have a read — anything to change is cheaper now than after the build."

```text
/fieldnote-yolo-deliver <id>
```

## Guardrails

- **Never write production code here.**
- **Never invent vocabulary** — the glossary first, same commit.
- **Never skip the approval** in step 1.
- **Never a private link** for the before/after: the build reads it from the branch.
- **Never infer `blocked-by`.** Only the person declares a dependency.
- **The transcript is not a deliverable.** If it is not on the branch, it does not exist.

## References

- `.fieldnote/profile.md` — the keys in the table above.
- `fieldnote-skills outbox check` — what a well-formed inbox file is.
- Next: `fieldnote-yolo-deliver`. The human-merged alternative: `fieldnote-brainstorming`.

## Licence notice for step 1

Step 1's method is adapted from the `brainstorming` skill in
[obra/superpowers](https://github.com/obra/superpowers).

> MIT License · Copyright (c) 2025 Jesse Vincent
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
> associated documentation files (the "Software"), to deal in the Software without restriction,
> including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
> and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
> subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial
> portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
> LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
> NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
> WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
> SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

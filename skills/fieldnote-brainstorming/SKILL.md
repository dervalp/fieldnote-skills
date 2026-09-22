---
name: fieldnote-brainstorming
description: Explore an idea to a settled design, then leave behind everything the next session needs — a before/after the change can be seen in, acceptance scenarios written in the domain's own words, and a published PRD issue. Use when a business user or engineer wants a change and nothing is written down yet, or when someone says "brainstorm this", "I have an idea", "let's design this", "what should we build". Ends by printing the next command, so a cleared context loses nothing.
stage: plan
variance: configured
surface: code
version: 0.1.0
release: skills-v0.1.0
---

# Fieldnote Brainstorming

Run this before building anything. It is a design conversation held properly, plus the three things
that make the design outlive the conversation: a **before/after** someone can look at, **acceptance
scenarios** in the domain's own words, and a **PRD issue** on the tracker.

That last part is the point. When this skill finishes, everything the next session needs is on the
tracker and on the branch — not in the transcript. Clear the context, start cold, and the work
continues.

This skill is self-contained: it depends on no other skill being installed.

## When to use

- **Use** when a change is wanted and the design is not settled yet: a feature idea, a rework, a
  "could we…" from a business user.
- **Do not use** when the design is already settled (go straight to `fieldnote-setup-prd`), for a bug
  with a known cause, or to write code.

## Before you start: the profile

This skill reads facts from `.fieldnote/profile.md`. **A missing profile never stops the brainstorm.**
Check once, before step 2 — step 1 needs nothing from it.

Three states, three behaviours:

- **`(none)`** — somebody decided this repository has no such thing. Take it at face value, skip what
  depends on it, and never ask.
- **A real value** — use it. Don't go looking for a better one.
- **Absent, or `TODO`** — nobody has answered yet. **Do not ask. Go and look in the repository**, using
  the table below. Then say in one line what you found and where, so it can be checked.

If the whole file is absent, say so once and carry on the same way:

> "No `.fieldnote/profile.md` — I looked these up in the repo instead. `fieldnote-setup-profile` can
> record them so the next run doesn't have to."

### Where to look

| Key                        | Look here                                                                                                                             | Nothing found                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `Git → baseRemote`         | `git remote`                                                                                                                          | `origin`                                                                   |
| `Git → baseBranch`         | `git symbolic-ref refs/remotes/<remote>/HEAD`, or the branch CI runs on                                                               | `main`                                                                     |
| `Labels → prd`             | `gh label list` — an existing label meaning "this is a PRD"                                                                           | `prd`; create it on the tracker                                            |
| `Docs → glossary`          | A glossary, ubiquitous-language or domain-terms document anywhere in the repo; failing that, the vocabulary `AGENTS.md`/`CLAUDE.md` uses | No glossary — see below                                                     |
| `Docs → scenarios`         | Existing scenario files and the config that runs them (a `features/` tree, a BDD or e2e runner in the test config)                    | No harness — see below                                                      |
| `Docs → acceptance`        | A document on how scenarios are written here; failing that, `Docs → testing`                                                          | Step 3's guidance alone                                                    |
| `Commands → scenarioCheck` | The project's script list, for a check that validates scenario wording                                                                | Check the wording by **reading** it, not by running something              |

**No glossary found.** Take the words from the code and the existing issues, use them **consistently**,
and name in the PRD which terms you settled on. Offer to start a glossary — never block on it.

**No scenario harness found.** Skip writing scenario files. Put every scenario in the PRD's Acceptance
criteria, marked *"no harness — ordinary tests"*, and `fieldnote-do-work` turns them into ordinary tests.

Whatever you had to look up, offer once at the end to have `fieldnote-setup-profile` record it, so the
next run reads it instead of searching again.

---

## 1. Brainstorm to a settled design

> The method in this section is adapted from the `brainstorming` skill in
> [obra/superpowers](https://github.com/obra/superpowers) — MIT licensed, Copyright (c) 2025 Jesse
> Vincent. The full notice is at the end of this file. It is reproduced here rather than invoked, so
> this skill works on a bare install. **What changed:** where it ends. The original writes a design
> document and hands off to a plan-writing skill; this one hands off to steps 2–4 below, and its spec
> self-review became the PRD self-review in step 4.

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
| **Bounded**       | A well-scoped change to code **that already exists in this repository**: a new flag, a small endpoint, a one-file fix.                                           | Steps 3 and 4.           |
| **Architectural** | New projects, new subsystems, changes that restructure how components fit together or alter interfaces others depend on.                                        | Steps 2, 3 and 4.        |

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
| "The design is approved, so I can skip the PRD"                       | An approved design that lives only in this transcript dies with it. Step 4 is not optional. |

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
5. Go to step 3 (observable behaviour only) and step 4

**Architectural**

1. Explore project context — files, documents, recent commits
2. Ask clarifying questions — one at a time: purpose, constraints, success criteria
3. Propose two or three approaches — trade-offs, and your recommendation
4. Present the design in sections scaled to their complexity; get approval after each section
5. Go to steps 2, 3 and 4

### The conversation itself

A spike stops at "present the probe, get a nod". Everything from *Exploring approaches* onward is
architectural depth — for bounded work, context plus a few questions plus a short in-chat design is the
whole process.

**Understanding the idea**

- Check the current project state first — files, documents, recent commits.
- Before asking detailed questions, assess scope. If the request describes several independent
  subsystems ("a platform with chat, file storage, billing and analytics"), flag it immediately. Don't
  spend questions refining the details of something that needs decomposing first.
- If it is too large for one PRD, help decompose it into sub-projects: what the independent pieces are,
  how they relate, what order they get built in. Then brainstorm the first one through the normal flow.
  **Each sub-project gets its own PRD.**
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

Make the change visible to someone who was not in the conversation.

- A change with a **screen** — the screen today and the screen after, side by side.
- A change to an **API or an agent's behaviour** — the exchange today and after (request → response, or
  user turn → agent turn), or a flow diagram.
- A change with **nothing to show** (documentation, configuration) skips this step and says so.

Publish it as a **private hosted page** if your agent can publish one — on Claude Code, load
`artifact-design` and publish with the `Artifact` tool. If it cannot, write a **self-contained HTML
file** (no external assets, no build step) and commit it on the feature branch from step 4. Either way
the result has an address, and that address goes in the PRD's Handoff.

## 3. Acceptance scenarios, in the domain's words

Only when the change has behaviour something can observe from outside.

1. **Words first.** Every noun and verb in a scenario must already exist in the glossary named under
   `Docs → glossary` in `.fieldnote/profile.md`. If the area has not defined its verbs yet, curate them
   into the glossary **now, in the same commit** — never invent vocabulary inside a scenario file. Where
   `Docs → acceptance` names this repository's scenario-writing conventions, read it first and follow it.

2. **Write the scenarios** where `Docs → scenarios` says they live. Keep them **declarative**: one
   behaviour per scenario, under about eight steps, no HTTP verbs, no status codes, no clicking and
   typing. Describe what becomes true, not how the screen is operated.

3. **Mark them pending**, so the suite stays green while the steps behind them do not exist yet. Use
   whatever your runner already honours — a filename suffix the test config excludes
   (`<behaviour>.pending.feature`), a `@wip` tag, a skip annotation. State in the PRD which mechanism
   you used.

4. **Check the wording** by running `Commands → scenarioCheck` if the profile names one. Red means the
   words are wrong, not the guard.

These scenarios are the acceptance scope. `fieldnote-do-work` activates them — dropping the pending
marker — as the behaviour behind them lands.

**No harness for this kind of behaviour yet?** Then write the scenarios into the PRD's Acceptance
criteria in the same shape, marked *"no harness — ordinary tests"*, and `fieldnote-do-work` turns them
into ordinary tests instead.

## 4. Handoff — the PRD issue

**The PRD issue is the spec.** No separate spec file is written; every pull request of this feature
links back to it.

1. **Cut the feature branch** in a worktree, off the integration branch the profile names
   (`Git → baseRemote` / `Git → baseBranch`; `origin`/`main` absent a profile):

   ```bash
   git fetch <baseRemote>
   git worktree add <path> -b feat/<topic> <baseRemote>/<baseBranch>   # fix/<topic> for a fix
   ```

2. **Commit the scenario files and any glossary change** on that branch, with the before/after file if
   you wrote one rather than published one, and push. The branch has no pull request yet — a later skill
   opens it.

3. **Draft the PRD body**, using these sections:

   ```markdown
   ## Problem

   ## Solution

   ## Decisions

   ## User stories

   ## Scope

   ## Test seams

   ## Risks

   ## Delivery

   ## Acceptance criteria

   <Every scenario from step 3, verbatim, under the path of its file. A scenario with no harness yet
   is written here the same way and marked "no harness — ordinary tests".>

   ## Handoff

   - Next command: `/fieldnote-setup-prd #<this issue>`
   - Branch: `feat/<topic>`
   - Scenarios: `<path>` … (or "none — no observable behaviour")
   - Pending marker: <the mechanism from step 3> (or "none")
   - Before/after: <URL or committed path> (or "none")
   ```

4. **PRD self-review — before publishing.** Read the body back with fresh eyes:

   - **Placeholders** — any "TBD", "TODO", empty section or vague requirement? Fix it.
   - **Internal consistency** — do any sections contradict each other? Does the Solution match the
     Acceptance criteria? Does every scenario listed exist as a file, or carry the "no harness" marking?
   - **Scope** — is this focused enough to be one PRD, or does it need decomposing?
   - **Ambiguity** — could any requirement be read two different ways? Pick one and make it explicit.

   Fix what you find inline. No need to re-review — fix it and move on.

5. **Publish it**, labelled with `Labels → prd` from the profile (create the label if the tracker does
   not have it):

   ```bash
   gh issue create --title "PRD: <topic>" --label <Labels → prd> --body-file <file>
   ```

   The acceptance criteria now live in two places — the PRD and the scenario files — and they change
   together. A scenario edited later is edited in both, in the same push.

6. **Ask for a read, then print the next command alone on the last line of your reply**, with nothing
   after it:

   > "PRD published as #<n>, branch `feat/<topic>` pushed. Have a read before we ticket the slices —
   > tell me if anything should change."

   If they ask for changes, edit the issue and the scenario files in the same push.

## The next command

This skill publishes the PRD; it does **not** break it into child issues. `fieldnote-deliver` works from
a PRD's children, so the Handoff names `/fieldnote-setup-prd #<prd>` — pointed at the published PRD, it
tickets the slices underneath it, and `/fieldnote-deliver #<prd>` takes them from there. If your loop
runs from a plan file instead of child issues, name `/fieldnote-prd-to-plan #<prd>`.

## Guardrails

- **Never write production code here.** This skill produces a design, scenarios, a branch and an issue.
- **Never invent vocabulary.** A word that is not in the glossary goes into the glossary first, in the
  same commit, or the scenario is rewritten in words that are.
- **Never skip the approval** in step 1. Steps 2–4 run on an approved design or not at all.
- **The transcript is not a deliverable.** If it is not on the branch or on the tracker when you finish,
  it does not exist.

## References

- `.fieldnote/profile.md` — `Docs → glossary`, `Docs → scenarios`, `Docs → acceptance`,
  `Commands → scenarioCheck`, `Labels → prd`, `Git → baseRemote`, `Git → baseBranch`.
- Next in the loop: `fieldnote-setup-prd`, then `fieldnote-deliver`.
- Implementation activates the pending scenarios: `fieldnote-do-work`.

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

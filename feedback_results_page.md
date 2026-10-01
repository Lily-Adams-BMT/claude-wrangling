---
name: results-page-for-recommended-changes
description: "For coding and review work that ends in a recommended diff or changes, default to a local HTML results page with Keep/Skip cards and a Copy prompt, not chat-only findings"
---

When a coding or review task ends with changes I recommend (a PR review, an audit, a proposed diff), deliver them as a local HTML results page, not only in chat

**Why:** she reviews in the page, comments on any text she selects, marks each card, and pastes one generated prompt back. Her decisions and comments stay together and survive a reload.

**How to apply:**
- Save the page and its data under `~/src/retail/.scratch/<topic>/` (git-ignored), for example `review.html` with `findings.json` beside it.
- Sections: a "Start here" summary; "Needs you" (decisions and access, each with my recommendation); one card per finding; then tables for items others already raised, candidates I checked and dropped, and what I couldn't confirm.
- Each card: file and line (for a PR, a GitHub permalink pinned to the reviewed commit), current text next to the suggested text, why, evidence, confidence, the-book rule quote and link when one applies, and whether someone already raised it. Buttons: Keep/Skip for review findings, Approve/Skip for changes I would apply.
- Every visible text is commentable: a popover at the selection with a one-line input; Enter submits; Escape or a click outside dismisses; selections inside text inputs are ignored. A side panel lists comments with a delete button. Comments and decisions live in localStorage keyed by the file path.
- Copy prompt builds: page path, JSON path, kept and skipped lists, each comment as `[section] "text" -> note`, and a closing instruction. For PR reviews the instruction asks me to draft comments for her to paste, never to post them ([[feedback_pr_direct_edits]], [[feedback_pr_comments]], [[feedback_comment_tone]]).
- Write the page with the Write tool. Before opening it, drive it once with Playwright (select text, fire mouseup, see the popover, submit a comment, check the panel and the copied prompt, check 400 px width). Then `open -a "Google Chrome" <file>`.
- Code in cards: when a diff has lines longer than about 60 characters, stack "In the PR" above "Suggested" (`.diff.stack`) and mark pure-code blocks `pre.code` (no wrap, own horizontal scroll). Side-by-side wrapping splits identifiers and hides indentation.
- Reference implementation (start here): `~/src/retail/.scratch/results-page-template/`. Copy `template.html`, edit only its `#page-config` JSON block and the content; it supports finding cards (Keep/Skip or Approve/Skip) and decision cards (Pick A/B/C, Discuss, `data-mine`). Run the generic `page-check.js <page> --head <sha>` (no per-page edits). `README.md` there is the full guideline, including the review workflow and lessons.
- Design planning uses the same page. One card per decision: the question, options A/B/C each with a Pick button, a Discuss button, my pick and the existing drafts' position tagged per option. The Copy prompt lists picks (and whether each matches my pick), discuss items, and comments, and says not to change code yet. 

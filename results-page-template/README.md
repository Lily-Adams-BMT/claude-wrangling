# Results page: reference implementation

Use a results page whenever review, audit, or planning work ends with changes I recommend or
decisions you need to make. The page replaces findings that would otherwise exist only in chat.
You read it in Chrome, mark each card, comment on any text, and paste one generated prompt back.

## Files

- `template.html`: the page. Copy it, fill in the content, and change the settings block. Leave
  the script as it is.
- `page-check.js`: the generic Playwright check. It reads the page's settings and cards, so it
  needs no edits for each page.
- `page-check.txt`: the check's output against the template, as a known-good baseline.

## When to use which card

| Card | Markup | Buttons | Use it for |
|---|---|---|---|
| Finding | `<article class="card" data-kind="finding">` | Keep / Skip (review) or Approve / Skip (changes I would apply) | A defect or improvement with a location and a suggested change |
| Decision | `<article class="card" data-kind="decision" data-mine="B">` | Pick A / B / C, Discuss | A choice only you can make, such as design planning |

One page can mix both kinds. The copied prompt includes a section only for the kinds the page has.

Every card needs `id="card-<ID>"`, `data-id`, `data-title`, and `data-section`. The comment
panel and the prompt use `data-section` to say where a comment came from.

## Building a page

1. **Copy the template** to `~/src/retail/.scratch/<topic>/`. That folder is git-ignored.
2. **Edit the settings block** (`<script type="application/json" id="page-config">`):
   - `keyPrefix`: unique per page, for example `pr60557-review`. The storage key is
     `keyPrefix:<file path>`.
   - `dataFile`: the JSON file beside the page, such as `findings.json`, `re-review.json`, or
     `decisions.json`.
   - `pageLabel`: `Review page` or `Decision page`.
   - `contextLine`: the subject and the pinned commit, for example
     `PR: https://github.com/Betterment/retail/pull/60557 (reviewed at 0d0dbee)`.
   - `closing`: what you want me to do with the prompt. These are the standard lines:
     - Review: `Draft review comments for the kept findings for me to paste (do not post them), and answer each comment.`
     - Re-review with drafts: `Give me the final drafts for the kept cards to paste (do not post them), and answer each comment.`
     - Changes I would apply: `Apply the approved changes and answer each comment.`
     - Decisions: `Answer each comment and each Discuss item. Do not change code yet.`
3. **Change the `<title>` and the `<h1>`** to the same distinctive name, such as `PR 60557 review`.
   The check compares them.
4. **Fill the sections in this order:**
   1. "Start here": the main point first, one bullet per group of cards, my recommendation, and
      the counts and CI status.
   2. "Needs you": decisions and access, each with my recommendation.
   3. The cards.
   4. "Already raised by others": each thread, its status, and the author's reply.
   5. "Checked and not raised": each candidate I dropped, and the fact that rules it out.
   6. "Could not confirm": each open item, and where I looked.
   7. "How I reviewed": the method and the sub-pass counts.

   Leave a table out when it would be empty, and say so in one line.
5. **Write the JSON** with the same content as data. It's the record I re-read later.
6. **Run the check**, from the page's folder and with absolute paths:
   ```bash
   cd ~/src/retail/.scratch/<topic> && node ~/src/retail/.scratch/results-page-template/page-check.js \
     ~/src/retail/.scratch/<topic>/review.html --head <full sha> > ~/src/retail/.scratch/<topic>/page-check.txt 2>&1
   ```
   `--head` makes every GitHub blob link prove it is pinned to the reviewed commit. The check
   saves `<page>-shot.png` beside the page. Look at the screenshot before opening the page.
7. **Open the page:** `open -a "Google Chrome" <page>`.

## What each finding card carries

- **Title:** one sentence that states the defect, not the fix.
- **Location:** a GitHub permalink pinned to the full head SHA, with new-file line numbers.
- **Code:** "In the PR" beside "Suggested". When any line is longer than about 60 characters,
  use `<div class="diff stack">` so the two blocks stack. Mark code-only blocks `<pre class="code">`
  so they keep indentation and scroll instead of wrapping. Escape `<`, `>`, and `&` in code.
- **Why:** a concrete input and the wrong result it produces.
- **Rule** (when one applies): the exact quote from `the-book rules <id> --json`, and its `url`
  plus the heading slug. Never quote or link a rule the CLI didn't return.
- **Evidence:** where I confirmed it, and which pass found it.
- **Badges:** severity, confidence, rule id, and whether someone already raised it.

## What each decision card carries

- The question, and the context needed to choose.
- Options A, B, C. Each says what it does and what it costs, with a Pick button.
- `data-mine` set to my pick. The `option mine` class and a "my pick" tag mark it on the page.
- Tags showing where any existing draft or plan already stands.
- A Discuss button for choices that need more back and forth first.

## Writing rules for the page

- Plain, literal language: short active sentences, one term per concept, no metaphors.
- Main point first, in the page and in each card.
- Keep every quantity and condition exact. Don't flatten them.
- Drafted PR comments: 2 or 3 sentences, warm, no em dashes. Name the rule link when one applies.
  Never post them. You paste them yourself.

## Review workflow around the page

1. Preflight `the-book --version`. Scope the diff, and take the repo and the head SHA from the PR.
2. Fetch the head into a named scratch ref, not `FETCH_HEAD`:
   `git fetch origin pull/<N>/head:refs/scratch/pr<N>`. A background `git fetch` can overwrite
   `FETCH_HEAD` at any time. Read files with `git show "refs/scratch/pr<N>:<path>"`. Delete the
   ref when done: `git update-ref -d refs/scratch/pr<N>`.
3. Map files to the-book topics, and fetch 3 or 4 rule bodies.
4. Run the code-review skill in the background with the rule paths, and "do not post, do not
   edit, do not run tests". Do my own pass while it runs.
5. Verify every sub-pass finding against the code at the head before it becomes a card. Reject
   false ones in "Checked and not raised", with the fact that disproves them.
6. Read every review thread and the author's replies. Don't re-raise a point the author
   already declined. Build on the reply when it misses something.
7. For a re-review, compare the old and new heads. Map each earlier card to its new status and
   new line numbers, and check whether you have a pending review on GitHub before drafting again.

## Lessons from earlier pages

- In zsh, `$R:r` and `$H:path` read as history modifiers. Write `"${R}:path"`, or quote the full
  `ref:path` string. zsh also rejects a function named after an existing alias, such as `t()`.
- Always `cd` into the scratch folder, or use absolute paths, before any `>` redirect. A failed
  command once left an empty file in the repo root.
- Mouse-drag tests on wrapped table cells select only one line. The generic check picks a cell
  whose text fits on one line.
- Count blob links after writing the page, and pass `--head`, so a link to the wrong commit fails.
- Check `git status` at the end, and report changes you didn't make without touching them.
- Line numbers drift between heads. Re-derive them with `git show <ref>:<file> | grep -n`.

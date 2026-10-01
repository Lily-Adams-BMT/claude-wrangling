// Usage: node page-check.js /absolute/path/to/page.html [--head <full-sha>]
// Reads the page's #page-config block and its cards, so it needs no per-page edits.
// Exit code: 0 = all checks pass, 1 = a check failed, 2 = the script crashed.
const path = require('path');

const PLAYWRIGHT =
  process.env.PLAYWRIGHT_CORE ||
  '/Users/lilyadams/src/retail/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core';
const { chromium } = require(PLAYWRIGHT);

const args = process.argv.slice(2);
const PAGE = path.resolve(args[0] || '');
const HEAD = args.includes('--head') ? args[args.indexOf('--head') + 1] : null;
const DIR = path.dirname(PAGE);
if (!args[0]) {
  console.error('Usage: node page-check.js /absolute/path/to/page.html [--head <full-sha>]');
  process.exit(2);
}

const results = [];
const check = (n, ok, d) => results.push({ n, ok: !!ok, d });
const vis = (p) => p.evaluate(() => getComputedStyle(document.getElementById('cpop')).display === 'block');

// Select the first `words` words of the first non-empty text node under `selector`, then fire mouseup.
async function selectFirstWords(page, selector, words) {
  return page.evaluate(({ selector, words }) => {
    const root = document.querySelector(selector);
    if (!root) return null;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = w.nextNode())) {
      const text = node.textContent;
      const m = text.match(new RegExp('\\S+(\\s+\\S+){0,' + (words - 1) + '}'));
      if (!m) continue;
      const r = document.createRange();
      r.setStart(node, m.index);
      r.setEnd(node, m.index + m[0].length);
      const bb = r.getBoundingClientRect();
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      node.parentElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      return { phrase: m[0], left: bb.left, bottom: bb.bottom };
    }
    return null;
  }, { selector, words });
}

(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + PAGE);

  const config = await page.evaluate(() => JSON.parse(document.getElementById('page-config').textContent));
  const cards = await page.$$eval('.card[data-id]', (cs) => cs.map((c) => ({
    id: c.getAttribute('data-id'), title: c.getAttribute('data-title'), section: c.getAttribute('data-section'),
    kind: c.getAttribute('data-kind'), mine: c.getAttribute('data-mine'),
  })));
  const findings = cards.filter((c) => c.kind === 'finding');
  const decisions = cards.filter((c) => c.kind === 'decision');

  check('title matches h1', (await page.title()) === (await page.textContent('h1')).trim());
  check('cards present, ids unique, every card has kind/title/section',
    cards.length > 0 && new Set(cards.map((c) => c.id)).size === cards.length &&
    cards.every((c) => c.title && c.section && (c.kind === 'finding' || c.kind === 'decision')), cards);
  check('every card id has a matching #card-<id>', (await page.evaluate(
    (ids) => ids.every((id) => document.getElementById('card-' + id)), cards.map((c) => c.id))));
  if (HEAD) {
    const links = await page.$$eval('a[href*="github.com/"][href*="/blob/"]', (as) => as.map((a) => a.href));
    check(links.length + ' blob links, all pinned to --head', links.length > 0 && links.every((h) => h.includes('/blob/' + HEAD + '/')),
      links.filter((h) => !h.includes('/blob/' + HEAD + '/')));
  }

  // 1. Select text in the first card's first <dd> (or <p>), submit with Enter.
  const first = cards[0];
  const target = `#card-${first.id} dl.meta dd, #card-${first.id} p`;
  await page.locator(`#card-${first.id}`).scrollIntoViewIfNeeded();
  const sel = await selectFirstWords(page, target, 4);
  await page.waitForTimeout(50);
  check('selection + mouseup shows popover', sel && (await vis(page)), sel);
  const pb = await page.locator('#cpop').boundingBox();
  check('popover sits under the selection', pb && sel && Math.abs(pb.y - (sel.bottom + 8)) < 4 && Math.abs(pb.x - Math.max(8, sel.left)) < 4, { pb, sel });
  await page.keyboard.type('First note');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(50);
  check('Enter submits and hides', !(await vis(page)));
  check('comment section is the card section', (await page.locator('#comment-list .c-sec').first().textContent()) === first.section);

  // 2. Captions and headings are commentable; Escape and click-outside dismiss.
  const capSel = await selectFirstWords(page, 'caption', 3);
  await page.waitForTimeout(50);
  check('table caption commentable', capSel && (await vis(page)));
  await page.keyboard.press('Escape');
  check('Escape dismisses without a comment', !(await vis(page)) && (await page.locator('#comment-list li[data-comment-id]').count()) === 1);
  const headSel = await selectFirstWords(page, 'main h2', 2);
  await page.waitForTimeout(50);
  check('heading commentable', headSel && (await vis(page)));
  await page.mouse.click(30, 870);
  await page.waitForTimeout(50);
  check('click outside dismisses', !(await vis(page)));

  // 3. Selecting inside the prompt textarea is ignored.
  await page.evaluate(() => {
    const t = document.getElementById('prompt-preview');
    t.focus(); t.select();
    t.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await page.waitForTimeout(50);
  check('textarea selection ignored', !(await vis(page)));
  await page.evaluate(() => document.activeElement.blur());

  // 4. A real mouse drag across a one-line table cell.
  const cell = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('main table td'));
    for (const td of cells) {
      const r = document.createRange();
      r.selectNodeContents(td);
      const rects = r.getClientRects();
      const text = td.textContent.trim();
      if (text.length >= 8 && rects.length && new Set(Array.from(rects).map((x) => Math.round(x.top))).size === 1) {
        td.setAttribute('data-check-cell', '1');
        const host = td.closest('[data-section]');
        return { text, section: host ? host.getAttribute('data-section') : 'Page' };
      }
    }
    return null;
  });
  check('found a one-line table cell to drag', cell);
  let dragged = false;
  if (cell) {
    const td = page.locator('td[data-check-cell="1"]');
    await td.scrollIntoViewIfNeeded();
    const bb = await td.evaluate((c) => { const r = document.createRange(); r.selectNodeContents(c); const x = r.getBoundingClientRect(); return { x: x.left, y: x.top, w: x.width, h: x.height }; });
    await page.mouse.move(bb.x + 1, bb.y + bb.h / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.w - 1, bb.y + bb.h / 2, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(80);
    dragged = await vis(page);
    check('real drag on a table cell shows popover', dragged);
    if (dragged) {
      await page.fill('#cpop-input', 'Second note');
      await page.click('#cpop button[type="submit"]');
      await page.waitForTimeout(50);
      const secs = await page.locator('#comment-list .c-sec').allTextContents();
      check('table comment section', secs[1] === cell.section, secs);
    }
  }

  // 5. Card buttons.
  if (findings.length) {
    await page.click(`#card-${findings[0].id} button.approve`);
    if (findings[1]) await page.click(`#card-${findings[1].id} button.skip`);
    check('keep/skip marks', await page.evaluate(({ a, s }) =>
      document.getElementById('card-' + a).classList.contains('approved') && (!s || document.getElementById('card-' + s).classList.contains('skipped')),
      { a: findings[0].id, s: findings[1] && findings[1].id }));
  }
  if (decisions.length) {
    await page.click(`#card-${decisions[0].id} button.pick[data-option="A"]`);
    if (decisions[1]) await page.click(`#card-${decisions[1].id} button.discuss`);
    check('pick marks', await page.evaluate((id) => document.getElementById('card-' + id).classList.contains('picked'), decisions[0].id));
  }
  const nComments = dragged ? 2 : 1;
  const tally = await page.textContent('#tally');
  check('tally counts comments', tally.includes(nComments + ' comment'), tally);

  // 6. The copied prompt.
  await page.click('#copy-prompt');
  await page.waitForTimeout(100);
  const pr = await page.evaluate(() => window.__lastCopiedPrompt);
  const lines = pr.split('\n');
  check('prompt = preview', pr === (await page.inputValue('#prompt-preview')));
  check('prompt header lines', lines[0] === config.pageLabel + ': ' + PAGE && lines[1] === 'Data: ' + path.join(DIR, config.dataFile) && lines[2] === config.contextLine, lines.slice(0, 3));
  if (findings.length) {
    const approveText = await page.textContent(`#card-${findings[0].id} button.approve`);
    check('prompt lists the kept card', pr.includes(`${approveText.trim()} (1):\n- ${findings[0].id} ${findings[0].title}`));
    if (findings[1]) check('prompt lists the skipped card', pr.includes(`Skip (1):\n- ${findings[1].id} ${findings[1].title}`));
  }
  if (decisions.length) {
    const mine = decisions[0].mine;
    const suffix = mine ? (mine === 'A' ? ' (matches my pick)' : ` (my pick was ${mine})`) : '';
    check('prompt lists the pick', pr.includes(`- ${decisions[0].id} ${decisions[0].title}: A${suffix}`));
  }
  const commentLines = lines.filter((l) => l.startsWith('['));
  check('prompt comment lines', commentLines.length === nComments && commentLines[0].startsWith(`[${first.section}] "`) && commentLines[0].endsWith('-> First note'), commentLines);
  check('prompt ends with the closing line', pr.trimEnd().endsWith(config.closing));

  // 7. Persistence.
  await page.reload();
  await page.waitForTimeout(100);
  check('reload keeps comments', (await page.locator('#comment-list li[data-comment-id]').count()) === nComments);
  check('storage key is keyPrefix:path', JSON.stringify(await page.evaluate(() => Object.keys(localStorage))) === JSON.stringify([config.keyPrefix + ':' + PAGE]));
  await page.locator('#comment-list li[data-comment-id]').first().locator('.c-del').click();
  await page.reload();
  await page.waitForTimeout(100);
  check('delete persists', (await page.locator('#comment-list li[data-comment-id]').count()) === nComments - 1);

  // 8. Layout and errors.
  await page.setViewportSize({ width: 400, height: 800 });
  check('no sideways scroll at 400px', (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.evaluate((id) => document.getElementById('card-' + id).scrollIntoView(), first.id);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(DIR, path.basename(PAGE, '.html') + '-shot.png') });
  check('no page errors', errors.length === 0, errors);

  await b.close();
  for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.n + (r.ok ? '' : '  ' + JSON.stringify(r.d)));
  console.log('\n' + pr);
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

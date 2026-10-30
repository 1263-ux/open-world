import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

/** Geometry-only observation: no game state, input, clock or layout is modified. */
export async function assertLandscapeCanvasAndHud(page: Page, canvas: Locator, info: TestInfo) {
  const frame = await page.getByTestId('hks-frame').boundingBox();
  const game = await canvas.boundingBox();
  const viewport = page.viewportSize();
  const logicalWidth = Number(await canvas.getAttribute('data-logical-width'));
  const logicalHeight = Number(await canvas.getAttribute('data-logical-height'));
  if (!frame || !game || !viewport) throw new Error('Missing iframe, canvas or viewport geometry');
  // HUD.ts createExpBar uses x=12..1256+12 and y=690..718 in the native
  // 1280x720 canvas. Project that actual fixed region to CSS pixels. The
  // separate complete-canvas check catches clipping of every other HUD edge.
  const xp = { x: game.x + game.width * 12 / logicalWidth,
    y: game.y + game.height * 690 / logicalHeight,
    width: game.width * 1256 / logicalWidth, height: game.height * 28 / logicalHeight };
  const evidence = { frame, canvas: game, viewport, logicalWidth, logicalHeight, xpHudRegion: xp };
  await info.attach('landscape-canvas-and-hud-bounds', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  expect([logicalWidth, logicalHeight]).toEqual([1280, 720]);
  const contained = (inner: { x: number; y: number; width: number; height: number }, outer: { x: number; y: number; width: number; height: number }) =>
    inner.x >= outer.x - .5 && inner.y >= outer.y - .5 && inner.x + inner.width <= outer.x + outer.width + .5 && inner.y + inner.height <= outer.y + outer.height + .5;
  expect(contained(frame, { x: 0, y: 0, ...viewport }), 'The Hks iframe must fit in the viewport').toBe(true);
  expect(contained(game, frame), 'The entire native canvas must fit in the iframe, not merely its visible intersection').toBe(true);
  expect(contained(xp, game) && contained(xp, frame), 'The projected bottom XP/HUD bar must fit entirely in the visible iframe').toBe(true);
}

/** Verify the actual rendered text is in the scroll and is not under the gold roller or clipped by an overflow ancestor. */
export async function assertKnowledgeDismissHint(page: Page, info: TestInfo) {
  const hint = page.frameLocator('[data-testid="hks-frame"]').locator('#monster-popup .close-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('关 闭');
  const evidence = await hint.evaluate(element => {
    const scroll = element.closest('.scroll');
    const range = document.createRange(); range.selectNodeContents(element);
    const text = range.getBoundingClientRect(), box = element.getBoundingClientRect(), card = scroll?.getBoundingClientRect();
    const samples: Array<{ x: number; y: number; hit: string | null; unobscured: boolean }> = [];
    for (const fx of [.1, .5, .9]) for (const fy of [.25, .5, .75]) {
      const x = text.left + text.width * fx, y = text.top + text.height * fy;
      const hit = document.elementFromPoint(x, y);
      samples.push({ x, y, hit: hit?.className?.toString() ?? null, unobscured: !!hit && (hit === element || element.contains(hit)) });
    }
    const rect = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
    return { text: rect(text), box: rect(box), card: card ? rect(card) : null,
      frameViewport: { width: innerWidth, height: innerHeight }, samples,
      color: getComputedStyle(element).color, fontSize: getComputedStyle(element).fontSize };
  });
  await info.attach('landscape-knowledge-hint-bounds', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  expect(evidence.card, 'Knowledge card must exist').not.toBeNull();
  if (!evidence.card) throw new Error('Missing card geometry');
  const { text, card, frameViewport, samples } = evidence;
  expect(text.width).toBeGreaterThan(0); expect(text.height).toBeGreaterThan(0);
  expect(text.left >= card.left && text.right <= card.right && text.top >= card.top && text.bottom <= card.bottom,
    'The complete dismissal text must fit within the knowledge card').toBe(true);
  expect(text.left >= 0 && text.top >= 0 && text.right <= frameViewport.width && text.bottom <= frameViewport.height,
    'The complete dismissal text must fit within the iframe viewport').toBe(true);
  expect(samples.every(sample => sample.unobscured), 'Dismissal hint must not be covered by the roller or clipped').toBe(true);
  expect(Number.parseFloat(evidence.fontSize), 'Phone dismissal text must be at least 14 CSS px').toBeGreaterThanOrEqual(14);
  const channels = evidence.color.match(/[\d.]+/g)?.map(Number) ?? [];
  expect(channels.length, 'Dismissal text color must be a measurable opaque RGB value').toBeGreaterThanOrEqual(3);
  if (channels.length < 3 || (channels.length > 3 && channels[3]! < 1)) throw new Error('Dismissal text color is missing or translucent');
  const luminance = (rgb: number[]) => rgb.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
  const foreground = luminance(channels);
  // The five flat gradient stops used by the retained parchment card. This is
  // a conservative CSS-color check, not a substitute for pixel/screenshot QA.
  const parchment = [[245,230,200],[240,222,184],[237,217,176],[232,208,160],[229,205,160]];
  const minContrast = Math.min(...parchment.map(rgb => { const bg = luminance(rgb); return (Math.max(bg, foreground) + .05) / (Math.min(bg, foreground) + .05); }));
  await info.attach('landscape-hint-contrast-estimate', { body: JSON.stringify({ foreground: evidence.color, minContrast, parchmentStops: parchment }, null, 2), contentType: 'application/json' });
  expect(minContrast, 'Dismissal text must contrast at least 4.5:1 against all retained parchment stops').toBeGreaterThanOrEqual(4.5);
}

/** Use the naturally encountered description only: never change its content or game state. */
export async function observeNaturalKnowledgeScroll(page: Page, info: TestInfo) {
  const popup = page.frameLocator('[data-testid="hks-frame"]').locator('#monster-popup');
  const desc = popup.locator('.desc');
  const before = await desc.evaluate(element => ({ scrollTop: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
  if (before.scrollHeight <= before.clientHeight + 2) {
    await info.attach('landscape-natural-knowledge-scroll', { body: JSON.stringify({ before, exercised: false, reason: 'Natural first encounter has no scrollable overflow; longer later encounters remain untested' }, null, 2), contentType: 'application/json' });
    return;
  }
  const box = await desc.boundingBox(); if (!box) throw new Error('Scrollable knowledge description has no bounds');
  const touch = await page.context().newCDPSession(page);
  const x = box.x + box.width * .5, y = box.y + box.height * .75;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 7 }] });
  try {
    for (let i = 1; i <= 4; i++) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - Math.min(box.height * .5, 80) * i / 4, id: 7 }] });
      await page.waitForTimeout(60);
    }
  } finally { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
  const after = await desc.evaluate(element => ({ scrollTop: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
  await info.attach('landscape-natural-knowledge-scroll', { body: JSON.stringify({ before, after, exercised: true }, null, 2), contentType: 'application/json' });
  await expect(popup, 'Scrolling a knowledge description must not dismiss its card').toBeVisible();
  expect(after.scrollTop, 'A real upward touch gesture must scroll the overflowing natural description').toBeGreaterThan(before.scrollTop + 1);
}

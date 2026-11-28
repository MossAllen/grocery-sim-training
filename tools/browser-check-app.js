const assert = require('node:assert/strict');

// Exercise the same relative paths used by GitHub Pages, without keeping any real profile data.
module.exports = async function verifyApp(browser, url, axeScript) {
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url);
    await page.locator('#showInstall').tap();
    await page.locator('#install-app[open] #install-app-status[data-state=ready]').waitFor({ timeout: 25_000 });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 820, 'tablet launch page overflow');
    const { manifest, scope } = await page.evaluate(async () => {
      const response = await fetch(document.querySelector('link[rel=manifest]').href);
      const registration = await navigator.serviceWorker.ready;
      return { manifest: await response.json(), scope: registration.scope };
    });
    assert.equal(scope, url);
    assert.equal(new URL(manifest.start_url, url).href, url);
    assert.equal(new URL(manifest.scope, url).href, url);
    assert.equal(manifest.display, 'standalone');
    assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.purpose === 'any'));
    assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'));
    const problems = axeScript ? await require('./run-browser-check.js').axe(page, axeScript, 'tablet app install help') : [];

    await page.locator('.product-pick [data-p="water"]').tap();
    assert.equal(await page.locator('.product-pick [data-p="water"]').getAttribute('aria-pressed'), 'true');
    await context.setOffline(true);

    await page.reload();
    await page.locator('#continueBtn').tap();
    await page.locator('.lesson-wrap .lesson').waitFor();
    assert.equal(await page.evaluate(() => window.MTL.State.data.product), 'water');

    const preview = await context.newPage();
    preview.on('pageerror', (error) => errors.push(error.message));
    for (const [hash, mission] of [['observe-walk', '.observe-walk'], ['shelf-walk', '.shelf-walk'], ['promo-walk', '.w4r3-walk']]) {
      // Loading a new document exercises the normally lazy chunks under the offline worker.
      await preview.goto('about:blank');
      await preview.goto(`${url}#${hash}`);
      await preview.locator('#startBtn').tap();
      await preview.locator(`${mission} canvas`).waitFor();
      assert.equal(await preview.evaluate(() => document.documentElement.scrollWidth), 820, `${hash}: tablet overflow`);
    }
    await preview.goto('about:blank');
    await preview.goto(`${url}#report-desk`);
    await preview.evaluate(require('./browser-check-report-desk.js'), 'hash');
    const range = await preview.evaluate(async () => {
      const response = await fetch('assets/audio/scanner.ogg', { headers: { Range: 'bytes=0-31' } });
      return [response.status, (await response.arrayBuffer()).byteLength];
    });
    assert.deepEqual(range, [206, 32], 'offline audio must support the byte-range request used by media elements');
    assert.deepEqual(errors, []);
    console.log('PWA tablet: nested scope, install manifest, offline reload with saved product, lesson, all three walks, report desk and audio range passed');
    return problems;
  } finally {
    await context.close();
  }
};

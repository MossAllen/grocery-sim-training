/* Isolated desktop and touch acceptance for the first-person W2R2 mission. */
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

const scenarios = [
  { product: 'water', width: 390, touch: true, prices: [[12, 20], [9, 24]], quantities: [0.6, 1.5], basis: 1 },
  { product: 'snack', width: 1280, touch: false, prices: [[10, 25], [8, 27]], quantities: [25, 75], basis: 100 },
  { product: 'household', width: 320, touch: true, prices: [[12, 59], [9, 60]], quantities: [1, 6], basis: 1 },
];

async function verifyShelfWalk(browser, url, axeScript) {
  const problems = [];
  for (const scenario of scenarios) {
    const { product, width, touch, prices, quantities, basis } = scenario;
    const context = await browser.newContext({
      viewport: { width, height: touch ? 844 : 880 },
      isMobile: touch, hasTouch: touch, reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      const errors = [];
      const mediaRequests = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => {
        if (response.url().startsWith(url) && response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
          errors.push(response.status() + ' ' + response.url());
        }
      });
      page.on('request', (request) => {
        if (/^https:.*(?:youtube(?:-nocookie)?\.com|youtu\.be|accc\.gov\.au)\//i.test(request.url())) mediaRequests.push(request.url());
      });

      const use = (selector) => {
        const control = page.locator(selector);
        return touch ? control.tap() : control.click();
      };
      const target = (id) => page.locator('[data-walk-action][data-target="' + id + '"]');
      const interact = async (id) => {
        await target(id).waitFor({ timeout: 5000 });
        if (!touch && id === 'a') {
          await target(id).focus();
          await page.keyboard.press('e');
          await page.locator('[data-recorded=a][data-price]').waitFor({ timeout: 5000 });
        } else {
          await use('[data-walk-action]');
        }
      };
      const passFiveAisleSteps = async () => {
        const right = page.locator('[data-move=right]');
        for (let step = 0; step < 5; step++) {
          if (touch) await right.tap();
          else await right.press('Enter');
        }
      };

      await page.goto(url);
      await use('.product-pick [data-p=' + product + ']');
      await use('#startBtn');
      await use('#soundBtn');
      await use('#ttsBtn');
      await use('#menuBtn');
      await page.locator('#ul').check();
      await use('#modal [data-a=close]');
      await use('.week[data-w="1"]');
      await use('.round[data-r="1"]');
      await page.locator('.shelf-walk canvas').waitFor();
      assert.equal(await page.locator('.lesson-wrap .lesson').count(), 0, 'The immersive activity should be playable directly');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, product + ': viewport overflow');
      if (axeScript && product === 'water') {
        const { axe } = require('./run-browser-check.js');
        problems.push(...await axe(page, axeScript, 'shelf-walk mobile launch'));
      }

      for (let run = 0; run < prices.length; run++) {
        const canvas = page.locator('.shelf-walk canvas');
        const firstView = run === 0 ? await canvas.screenshot() : null;
        await interact('a');
        await passFiveAisleSteps();
        await target('b').waitFor({ timeout: 5000 });
        if (firstView) assert.notDeepEqual(await canvas.screenshot(), firstView, product + ': scene did not move from A to B');
        await interact('b');

        const rates = [];
        for (const [index, id] of ['a', 'b'].entries()) {
          const record = page.locator('[data-recorded=' + id + ']');
          await record.waitFor();
          const label = await record.evaluate((row) => Object.fromEntries(Object.entries(row.dataset)));
          assert.equal(Number(label.price), prices[run][index], product + ': wrongly recorded shelf price');
          assert.equal(Number(label.quantity), quantities[index], product + ': wrongly normalized size');
          assert.equal(Number(label.basis), basis, product + ': wrong standard unit');
          rates.push(Number(label.price) * basis / quantities[index]);
        }
        await passFiveAisleSteps();
        await interact('checkout');

        const form = page.locator('.walk-checkout-form');
        await form.waitFor();
        for (const [index, id] of ['a', 'b'].entries()) {
          const amount = rates[index].toFixed(2);
          await form.locator('[name=unit-' + id + ']').fill(run ? amount.replace(/\d/g, (d) => '๐๑๒๓๔๕๖๗๘๙'[d]) : amount);
        }
        const best = rates[0] <= rates[1] ? 'a' : 'b';
        assert.equal(best, run ? 'a' : 'b', product + ': replay should reverse the unit-price comparison');
        // Pick the sticker-price trap on the first run, then prove the alternate case can earn full credit.
        await form.locator('[name=chosen][value=a]').check();
        await form.locator('button[type=submit]').click();
        await page.locator('.walk-feedback').waitFor();
        assert.match(await page.locator('.walk-feedback').innerText(), /หน่วย|ลิตร|กรัม|ม้วน/);
        assert.doesNotMatch(await page.locator('.shelf-walk').innerText(), /\b(?:undefined|NaN)\b/);
        if (axeScript && product === 'water' && run === 0) {
          const { axe } = require('./run-browser-check.js');
          problems.push(...await axe(page, axeScript, 'shelf-walk mobile checkout'));
        }
        await use('[data-walk-save]');
        await page.locator('#modal [data-a=again]').waitFor();
        const state = await page.evaluate(() => JSON.parse(localStorage.getItem('mtl-save-v1')));
        assert.equal(state.rounds['1-1'].stars, run === 0 ? 2 : 3, product + ': incorrect evidence score');
        assert.ok(state.portfolio['w2-store-' + product]?.text, product + ': missing portfolio record');
        if (run === 0) await use('#modal [data-a=again]');
      }

      await page.reload();
      assert.equal(await page.evaluate(() => window.MTL.State.round(1, 1).stars), 3, product + ': saved result was not loaded');
      await use('.week[data-w="1"]');
      await use('.round[data-r="1"]');
      await use('[data-walk-classic]');
      await page.locator('.stage .calc-form, .lesson .nx, .precheck .opt').first().waitFor({ timeout: 5000 });
      assert.equal(await page.locator('.shelf-walk').count(), 0, 'The classic route must leave the walking mission');
      assert.equal(mediaRequests.length, 0, 'The mission should not require loading third-party course media');
      assert.deepEqual(errors, [], product + ': Chromium runtime or asset errors');
      console.log('W2R2 shelf-walk ' + product + ' @ ' + width + 'px: ' + prices.length + ' cases, evidence and classic route passed');
    } finally {
      await context.close();
    }
  }
  return problems;
}

async function main() {
  const [modules] = process.argv.slice(2);
  if (!modules) throw new Error('Usage: node tools/browser-check-shelf-walk.js <node_modules path>');
  const { withGameServer } = require('./run-browser-check.js');
  const modulesPath = path.resolve(modules);
  const axeScript = path.join(modulesPath, 'axe-core/axe.min.js');
  const { chromium } = require(path.join(modulesPath, 'playwright'));
  process.chdir(os.tmpdir());
  await withGameServer(async (url) => {
    const browser = await chromium.launch({ args: ['--disable-crashpad-for-testing'] });
    try {
      const problems = await verifyShelfWalk(browser, url, axeScript);
      if (problems.length) throw new Error(problems.join('\n'));
    } finally {
      await browser.close();
    }
  });
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = verifyShelfWalk;

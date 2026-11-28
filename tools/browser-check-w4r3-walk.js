/* W4R3 walk acceptance (handoff/2026-11-28_gpt-to-claude_w4r3-walk.md): sign → promo period → stock → counter summary.
 * Results and scores must equal the list route for the same base and plan. */
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

const scenarios = [
  // seed 4001 · am · none · P20 C12 B36 F30 → 25 vs 9 sets + 14 singles, 384 / 190 / ปรับ (GDD §5)
  { product: 'water', seed: 4001, event: 'none', B: 3600, F: 3000, width: 1280, touch: false, motion: true,
    expect: { N0: 25, S: 9, U: 14, left0: 35, left1: 28, COGS1: 38400, G1: 19000, decision: 'ปรับ' } },
  { product: 'snack', seed: 4001, event: 'none', B: 3600, F: 3000, width: 390, touch: true, motion: false,
    expect: { N0: 25, S: 9, U: 14, COGS1: 38400, G1: 19000, decision: 'ปรับ' } },
  { product: 'water', seed: 4002, event: 'none', B: 3600, F: 3000, width: 320, touch: true, motion: false, expect: { decision: 'ทำต่อ' } },
  { product: 'water', seed: 4012, event: 'none', B: 2300, F: 3000, width: 390, touch: true, motion: false, expect: { decision: 'หยุด' } },
  { product: 'household', seed: 4005, event: 'shelfOut', B: 2700, F: 1875, width: 1280, touch: false, motion: false, expect: {} },
];

async function verifyW4R3Walk(browser, url, axeScript) {
  const problems = [];
  for (const sc of scenarios) {
    const compact = sc.width === 320;
    const context = await browser.newContext({ viewport: { width: sc.width, height: compact ? 568 : sc.touch ? 760 : 880 }, isMobile: sc.touch,
      hasTouch: sc.touch, reducedMotion: sc.motion ? 'no-preference' : 'reduce', serviceWorkers: 'block' });
    await context.addInitScript((pid) => {
      if (!localStorage.getItem('mtl-save-v1')) {
        localStorage.setItem('mtl-save-v1', JSON.stringify({ version: 1, product: pid, player: '', rounds: {}, sim: {}, portfolio: {},
          lessons: { '3-2': true }, settings: { sound: true, tts: false, unlockAll: true } }));
      }
    }, sc.product);
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const use = (selector) => (sc.touch ? page.locator(selector).tap() : page.locator(selector).click());
      await page.goto(compact ? `${url}#promo-walk` : url);
      // Base and plan the model would have saved in W4R1/W4R2 for this seed.
      const model = await page.evaluate(({ product, seed, event, B, F }) => {
        const M = window.MTL, PM = M.PromoModel, pr = M.PRODUCTS[product].promo;
        const P = PM.satang(pr.price), C = PM.satang(pr.cost);
        const slot = seed % 2 ? 'am' : 'pm';
        const pair = PM.simulatePair({ seed, P, C, B, T: 30, K0: 60, K1: 60, slot, event });
        const N0 = pair.normal.N, store = M.State.promo(product);
        store.baseline = { id: 'base-test', version: 2, source: 'จำลอง', seed, slot, event, T: 30, K0: 60, P, C, N0, R0: N0 * P, COGS0: N0 * C, G0: N0 * (P - C) };
        store.plan = { id: 'plan-test', baselineId: 'base-test', B, F };
        store.run = null;
        M.State.save();
        const v = PM.evaluate({ P, C, B, F, N0, S: pair.promo.S, U: pair.promo.U });
        return { N0, S: pair.promo.S, U: pair.promo.U, left0: pair.normal.stockLeft, left1: pair.promo.stockLeft, COGS1: v.COGS1, G1: v.G1, decision: v.decision, lostEvent: pair.promo.lostEvent };
      }, sc);
      for (const [key, value] of Object.entries(sc.expect)) assert.equal(model[key], value, `${sc.product} ${sc.seed}: model ${key}`);

      if (compact) await use('#startBtn');
      else {
        await use('#homeBtn');
        await use('.week[data-w="3"]');
        await use('.round[data-r="2"]');
      }
      await page.locator('.w4r3-walk').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), sc.width, 'viewport overflow');
      const row = (id) => page.locator(`.ow-book tr[data-row="${id}"]`);
      const assertFocusable = async (selector) => {
        if (!compact) return;
        const reachable = await page.locator(selector).evaluate((button) => {
          const { top, bottom, left, width } = button.getBoundingClientRect();
          const header = document.querySelector('.topbar').getBoundingClientRect();
          return document.activeElement === button && top >= header.bottom && bottom <= window.innerHeight &&
            button.contains(document.elementFromPoint(left + width / 2, (top + bottom) / 2));
        });
        assert.ok(reachable, `Compact focus is behind the header or offscreen: ${selector}`);
      };
      const go = async (id) => {
        const button = `[data-w4-go="${id}"]`;
        if (compact) await page.locator(button).evaluate((item) => item.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await use(button);
        const target = `[data-w4-action][data-target="${id}"]`;
        await page.locator(target).waitFor();
        await assertFocusable(target);
        await use(target);
      };

      // Counter and stock wait for their turn.
      await go('w4r3-counter');
      assert.equal(await row('w4r3-counter').count(), 0, 'counter opened before stock');
      await go('w4r3-sign');
      await assertFocusable('[data-w4-sign]');
      await use('[data-w4-sign]');
      await assertFocusable('[data-w4-start]');
      await row('w4r3-sign').waitFor();
      assert.match(await row('w4r3-sign').innerText(), new RegExp(`โปร 2 ชิ้น ${sc.B / 100} บาท`));
      await go('w4r3-sign');
      assert.equal(await page.locator('.ow-book tr[data-row]').count(), 1, 'repeat note added a row');
      await go('w4r3-stock');
      assert.equal(await row('w4r3-stock').count(), 0, 'stock recorded before the promo period');

      await use('[data-w4-start]');
      if (sc.motion) {
        // Customers walk in and pay; the till counts each one once, then skip jumps to the model totals.
        await page.waitForFunction(() => Number(document.querySelector('[data-w4-entered]').textContent) >= 3, null, { timeout: 15000 });
        await use('[data-w4-skip]');
      }
      await page.waitForFunction((n) => document.querySelector('[data-w4-units]').textContent === String(n), model.S * 2 + model.U);
      assert.equal(await page.locator('[data-w4-stock]').innerText(), String(model.left1));

      await go('w4r3-stock');
      const stock = await row('w4r3-stock').innerText();
      assert.match(stock, new RegExp(`เหลือ ปกติ ${model.left0} · โปร ${model.left1}`));
      if (sc.event === 'shelfOut') assert.match(stock, /หน้าชั้นหมดชั่วคราว/, 'shelf-out event must be listed separately');
      else assert.match(stock, /ไม่มีเหตุการณ์|สต็อกไม่พอ/);

      await go('w4r3-counter');
      await page.locator('.w4-summary .calc-form').waitFor();
      if (axeScript && sc.width === 320) {
        const { axe } = require('./run-browser-check.js');
        problems.push(...await axe(page, axeScript, 'w4r3 walk summary 320px'));
      }
      await page.locator('[name=c1]').fill((model.COGS1 / 100).toFixed(2));
      await page.locator('[name=g1]').fill((model.G1 / 100).toFixed(2));
      await page.locator('[name=dec]').selectOption(model.decision);
      await use('.w4-summary .chk');
      assert.match(await page.locator('.w4-summary .solution').innerText(), /\(3\/3\)/);
      await use('.w4-summary .sv');
      await page.locator('#modal [data-a="again"]').waitFor();
      const walkRun = await page.evaluate((pid) => JSON.parse(localStorage.getItem('mtl-save-v1')), sc.product);
      const run = walkRun.sim.promoV2[sc.product].run;
      assert.equal(walkRun.rounds['3-2'].stars, 3);
      assert.deepEqual([run.route, run.S, run.U, run.COGS1, run.G1, run.decision, run.baselineId, run.planId, run.seed],
        ['walk', model.S, model.U, model.COGS1, model.G1, model.decision, 'base-test', 'plan-test', sc.seed]);
      assert.deepEqual(run.evidence.map((e) => e.id), ['w4r3-sign', 'w4r3-stock', 'w4r3-counter']);

      if (sc.product === 'water' && sc.seed === 4001) {
        const desk = await context.newPage();
        try {
          desk.on('pageerror', (error) => errors.push(error.message));
          await desk.goto(`${url}#report-desk`);
          await desk.evaluate(require('./browser-check-report-desk.js'), 'hash');
          assert.ok((await desk.locator('.rd-ids').innerText()).includes(run.id), 'W6R5 did not open the saved W4R3 run');
          const amounts = await desk.locator('.rd-cols dd b').allTextContents();
          assert.deepEqual(amounts, ['200 บาท', '190 บาท']);
          await desk.locator('.rd-walk summary').click();
          assert.deepEqual(await desk.locator('.rd-walk li small').allTextContents(), run.evidence.map((e) => e.id));
          console.log('W4R3 saved walk → W6R5: matching run, 200/190 baht and three evidence points');
        } finally {
          await desk.close();
        }
      }

      // List route with the same base and plan: same numbers and the same 3/3.
      await use('#modal [data-a="again"]');
      await use('[data-walk-classic]');
      await page.locator('.precheck .opt').first().waitFor();
      await page.evaluate(() => {
        const R = window.MTL.WEEKS[3].rounds[2];
        document.querySelector(`.precheck .opt[data-k="${R.check.answer}"]`).click();
        document.querySelector('.precheck .go').click();
      });
      await use('.stage .go');
      await use('.stage .skip');
      await page.locator('.stage .calc-form').waitFor();
      await page.locator('.stage [name=c1]').fill((model.COGS1 / 100).toFixed(2));
      await page.locator('.stage [name=g1]').fill((model.G1 / 100).toFixed(2));
      await page.locator('.stage [name=dec]').selectOption(model.decision);
      await use('.stage .chk');
      assert.match(await page.locator('.stage .solution').innerText(), /\(3\/3\)/);
      await use('.stage .sv');
      await page.locator('#modal [data-a="again"]').waitFor();
      const listRun = await page.evaluate((pid) => JSON.parse(localStorage.getItem('mtl-save-v1')).sim.promoV2[pid].run, sc.product);
      assert.deepEqual([listRun.route, listRun.S, listRun.U, listRun.G1, listRun.decision], ['list', run.S, run.U, run.G1, run.decision], 'walk and list routes differ');
      assert.deepEqual(errors, [], 'runtime errors');
      console.log(`W4R3 walk ${sc.product} seed ${sc.seed} ${sc.event} @ ${sc.width}px ${sc.motion ? 'motion' : 'reduced'}: ${model.decision} 3/3, list route equal`);
    } finally {
      await context.close();
    }
  }
  return problems;
}

async function main() {
  const [modules] = process.argv.slice(2);
  if (!modules) throw new Error('Usage: node tools/browser-check-w4r3-walk.js <node_modules path>');
  const { withGameServer } = require('./run-browser-check.js');
  const modulesPath = path.resolve(modules);
  const { chromium } = require(path.join(modulesPath, 'playwright'));
  process.chdir(os.tmpdir());
  await withGameServer(async (url) => {
    const browser = await chromium.launch({ args: ['--disable-crashpad-for-testing'] });
    try {
      const problems = await verifyW4R3Walk(browser, url, path.join(modulesPath, 'axe-core/axe.min.js'));
      if (problems.length) throw new Error(problems.join('\n'));
    } finally { await browser.close(); }
  });
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = verifyW4R3Walk;

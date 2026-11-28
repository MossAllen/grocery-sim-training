/* Desktop and touch acceptance for the W1R2 walking observation mission (docs/GDD.md §9 acceptance table). */
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

const ORDER = ['am-carry', 'am-fast', 'am-price', 'pm-stock', 'pm-stock-more'];
const save = (product, extra = {}) => ({
  version: 1, product, player: '', rounds: {}, sim: {}, portfolio: {},
  settings: { sound: true, tts: false, unlockAll: true }, ...extra,
});
const scenarios = [
  // Keyboard on a desktop, sound on, fresh save: walk past, out-of-order notes, full marks, then a 9/12 replay.
  { product: 'water', width: 1280, touch: false, seed: save('water') },
  // 320 px phone, sound off, a v0.4 save without observations and an older W1R2 result: leave mid-play, then finish.
  { product: 'household', width: 320, height: 568, touch: true,
    seed: save('household', { rounds: { '0-1': { stars: 1, score: 0.4, skill: 'evid', at: 1 } }, settings: { sound: false, tts: false, unlockAll: true } }) },
  // 390 px phone with another product's notes already saved: data stays per product, then the list route still opens.
  { product: 'snack', width: 390, touch: true,
    seed: save('snack', { observations: { timeCompare: { water: { source: 'simulated', events: [], comparison: [], score: 1, route: 'list' } } } }) },
];

async function verifyObserveWalk(browser, url, axeScript) {
  const problems = [];
  for (const { product, width, height, touch, seed } of scenarios) {
    const context = await browser.newContext({
      viewport: { width, height: height ?? (touch ? 760 : 880) }, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce',
    });
    await context.addInitScript((state) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('mtl-save-v1', JSON.stringify(state));
        sessionStorage.setItem('seeded', '1');
      }
    }, seed);
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => {
        if (response.url().startsWith(url) && response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
          errors.push(response.status() + ' ' + response.url());
        }
      });
      const use = (selector) => (touch ? page.locator(selector).tap() : page.locator(selector).click());
      const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('mtl-save-v1')));
      const focusIs = (id, level) => page.locator(`.walk-viewport[data-focus="${id}"][data-level="${level}"]`).waitFor({ timeout: 5000 });
      const walk = async (move, times) => {
        for (let i = 0; i < times; i++) {
          if (touch) await page.locator(`[data-move="${move}"]`).tap();
          else await page.locator(`[data-move="${move}"]`).press('Enter');
        }
      };
      const goTo = async (id) => {
        const customer = page.locator(`[data-ow-go="${id}"]`);
        if (height === 568) await customer.evaluate((button) => button.scrollIntoView({ block: 'center' }));
        if (touch) await customer.tap();
        else await customer.press('Enter');
        await focusIs(id, 'ready');
        if (height === 568) {
          const record = page.locator(`[data-ow-record][data-target="${id}"]`);
          const placement = await record.evaluate((button) => {
            const { top, bottom, left, width } = button.getBoundingClientRect();
            const headerBottom = document.querySelector('.topbar').getBoundingClientRect().bottom;
            const hit = document.elementFromPoint(left + width / 2, (top + bottom) / 2);
            return { top, bottom, headerBottom, viewportHeight: window.innerHeight,
              focused: document.activeElement === button, tappable: button.contains(hit) };
          });
          assert.ok(placement.focused && placement.tappable && placement.top >= placement.headerBottom &&
            placement.bottom <= placement.viewportHeight, `Compact phone hid the focused record button: ${JSON.stringify(placement)}`);
        }
      };
      const note = async (id) => {
        await use(`[data-ow-record][data-target="${id}"]`);
        await page.locator(`.ow-book tr[data-row="${id}"]`).waitFor();
      };
      const open = async () => {
        await use('#homeBtn');
        await use('.week[data-w="0"]');
        await use('.round[data-r="1"]');
        await page.locator('.observe-walk canvas').waitFor();
      };
      const rows = () => page.locator('.ow-book tr[data-row]').evaluateAll((list) => list.map((row) => row.dataset.row));
      const analyse = async ({ wrongObservation, wrongReason, wrongEvening } = {}) => {
        await use('.ow-next');
        for (const id of ORDER) {
          await use(`[data-answer="${id === wrongObservation ? 'inference' : 'fact'}"]`);
          await use('.tc-next');
          await use(`[data-answer="${id}-${id === wrongReason ? 'alternative' : 'supported'}"]`);
          await use('.tc-next');
        }
        assert.match(await page.locator('.tc-tally').innerText(), /2 ÷ 3/, product + ': morning tally must show the denominator');
        await use('[data-answer="carry"]');
        const morning = await page.locator('.feedback').innerText();
        assert.match(morning, /07:02 และ 07:06/, product + ': comparison must cite the supporting rows');
        assert.match(morning, /2 ÷ 3/, product + ': comparison must cite the morning denominator');
        assert.match(morning, /ตัวอย่างจำลอง 5 เหตุการณ์/, product + ': comparison must state the sample scope');
        await use('.tc-next');
        assert.match(await page.locator('.tc-tally').innerText(), /2 ÷ 2/, product + ': evening tally must show the denominator');
        await use(`[data-answer="${wrongEvening ? 'value' : 'home'}"]`);
        assert.match(await page.locator('.feedback').innerText(), /2 ÷ 2/);
        await use('.tc-next');
        await page.locator('.tc-proposal input[name="tc-event"][value="am-fast"]').check();
        await page.locator('.tc-proposal input[name="tc-change"][value="service"]').check();
        await use('.tc-save');
        await page.locator('#modal [data-a="again"]').waitFor();
      };
      const viaList = async (ids) => { for (const id of ids) { await goTo(id); await note(id); } };

      await page.goto(url);
      await open();
      assert.equal(await page.locator('.lesson-wrap .lesson').count(), 0, product + ': the walk should open directly');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, product + ': viewport overflow');
      assert.equal(await page.locator('.ow-tag').innerText(), 'จำลอง');
      assert.equal(await page.locator('.ow-clock').innerText(), '07:00');
      assert.equal(await page.locator('.ow-muted').count(), seed.settings.sound ? 0 : 1, product + ': muted notice');
      const poses = () => page.locator('.walk-viewport').getAttribute('data-poses');
      // Reduced motion: nobody walks in, and customers out of sight stay in the standing pose.
      assert.match(await poses(), /am-carry:idle/, product + ': unseen customer should stand idle');
      assert.match(await poses(), /am-fast:idle/, product + ': reduced motion must skip the walk to the counter');

      if (product === 'water') {
        // Arrow keys and WASD move the camera.
        const canvas = page.locator('.observe-walk canvas');
        const before = await canvas.screenshot();
        await page.locator('.walk-viewport').focus();
        await page.keyboard.down('KeyW'); await page.waitForTimeout(150); await page.keyboard.up('KeyW');
        await page.keyboard.down('ArrowDown'); await page.waitForTimeout(150); await page.keyboard.up('ArrowDown');
        assert.notDeepEqual(await canvas.screenshot(), before, 'keyboard did not move the camera');
        await page.reload();
        await open();
        // Record sound cues (docs/AUDIO_SPEC.md): footsteps only while moving, notebook once per new note.
        await page.evaluate(() => {
          const { sfx } = window.MTL, play = sfx.play;
          window.cues = [];
          sfx.play = (key) => { window.cues.push(key); return play.call(sfx, key); };
        });
        const cues = (key) => page.evaluate((name) => window.cues.filter((cue) => cue === name).length, key);

        // Walk toward the price comparer: seen from afar, then close enough to hear and see.
        await walk('left', 3);
        assert.ok(await cues('step_shop') > 0, 'walking must play footsteps');
        await focusIs('am-price', 'seen');
        assert.match(await page.locator('.ow-caption').innerText(), /เห็น[\s\S]*เข้าใกล้/);
        assert.ok(await page.locator('[data-ow-record]').isDisabled(), 'notes must wait until the customer is heard');
        await walk('forward', 3);
        await focusIs('am-price', 'ready');
        // Walk past and come back.
        await walk('right', 3);
        await page.waitForFunction(() => document.querySelector('.walk-viewport').dataset.level !== 'ready');
        await walk('left', 3);
        await focusIs('am-price', 'ready');
        // A behaviour event needs sight: turned away it is heard but cannot be noted. Turning makes no footsteps.
        const steps = await cues('step_shop');
        await walk('turn-right', 2);
        assert.equal(await cues('step_shop'), steps, 'turning in place must not play footsteps');
        await focusIs('am-price', 'heard');
        assert.match(await page.locator('.ow-caption').innerText(), /ได้ยิน 07:09[\s\S]*หันไปทางลูกค้า/);
        assert.ok(await page.locator('[data-ow-record]').isDisabled());
        await walk('turn-left', 2);
        await focusIs('am-price', 'ready');
        // Note out of order with E, then press E and the note button again: still one row.
        await page.locator('.walk-viewport').focus();
        await page.keyboard.press('e');
        await page.locator('.ow-book tr[data-row="am-price"]').waitFor();
        const replayQueued = await page.locator('[data-ow-record][data-target="am-price"]').evaluate((button) => {
          // Follow a keyboard replay immediately with the record button, before the replay redraw.
          button.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
          const clearedForReplay = document.querySelector('.ow-caption').textContent === '';
          button.click();
          return clearedForReplay;
        });
        assert.ok(replayQueued, 'E should replay an already recorded conversation');
        await page.waitForTimeout(100);
        assert.match(await page.locator('.ow-caption').innerText(), /มีแถวนี้ในสมุดแล้ว/);
        assert.deepEqual(await rows(), ['am-price'], 'repeat notes must not add rows');
        assert.equal(await cues('notebook'), 1, 'the notebook cue must play once per new note');
        assert.equal(await page.locator('.ow-clock').innerText(), '07:09');
        await use('[data-ow-replay]');
        await page.waitForFunction(() => /ได้ยิน 07:09/.test(document.querySelector('.ow-caption').innerText));
        await page.evaluate(() => {
          window.mtlThaiSpeech = [];
          window.speechSynthesis.speak = (utterance) => {
            window.mtlThaiSpeech.push({ text: utterance.text, lang: utterance.lang });
            utterance.onend();
          };
          window.MTL.State.data.settings.tts = true;
        });
        await use('[data-ow-replay]');
        assert.deepEqual(await page.evaluate(() => window.mtlThaiSpeech), [
          { text: '“สองขนาดนี้ ขนาดไหนถูกกว่าต่อหน่วย”', lang: 'th-TH' },
        ]);
        await page.evaluate(() => { window.MTL.State.data.settings.tts = false; });
        assert.ok(await page.locator('.ow-next').isDisabled(), 'evening must wait for three morning notes');
        await viaList(['am-fast']);
        assert.ok(await page.locator('.ow-next').isDisabled());
        await goTo('am-carry');
        assert.match(await poses(), /am-carry:action/, 'a seen customer must switch to the pick pose');
        assert.equal(await page.locator('.ow-caption b').first().innerText(), 'เห็น');
        await walk('turn-right', 6);
        await focusIs('am-carry', 'ready');
        assert.deepEqual(await page.locator('.ow-caption b').allInnerTexts(), ['ได้ยิน 07:02'],
          'the caption must omit sight when the player faces away, even if the event can be noted');
        await note('am-carry');
        assert.deepEqual(await rows(), ['am-carry', 'am-fast', 'am-price'], 'notebook must be in time order');
        if (axeScript) {
          const { axe } = require('./run-browser-check.js');
          problems.push(...await axe(page, axeScript, 'observe-walk desktop'));
        }
      } else {
        // Touch: walk the pad to shelf A and tap the scene to note.
        await walk('left', 6);
        await walk('forward', 3);
        await focusIs('am-carry', 'ready');
        const caption = await page.locator('.ow-caption').innerText();
        assert.ok(caption.includes(await page.evaluate((id) => window.MTL.PRODUCTS[id].small.name, product)), product + ': caption must use the chosen product');
        await page.locator('.walk-viewport').tap({ position: { x: 20, y: 20 } });
        await page.locator('.ow-book tr[data-row="am-carry"]').waitFor();
        await viaList(['am-fast']);
        for (const selector of ['#menuBtn', '[data-ow-record]', '[data-ow-replay]', '[data-walk-classic]', '[data-ow-go="am-price"]', '.walk-pad']) {
          const box = await page.locator(selector).boundingBox();
          assert.ok(box && box.x >= 0 && box.x + box.width <= width + 0.5, `${product}: ${selector} is outside the ${width}px screen`);
        }
        if (axeScript && product === 'household') {
          const { axe } = require('./run-browser-check.js');
          problems.push(...await axe(page, axeScript, 'observe-walk 320px muted'));
        }
        if (product === 'household') {
          // Leave mid-play: the scene stops, the earlier result stays, and the old save still opens.
          await use('#back');
          await page.locator('.round[data-r="1"]').waitFor();
          assert.equal(await page.locator('.observe-walk').count(), 0);
          await page.keyboard.press('ArrowUp');
          const state = await saved();
          assert.deepEqual(state.rounds['0-1'], seed.rounds['0-1'], 'unfinished notes replaced the earlier result');
          assert.equal(state.observations, undefined, 'unfinished notes were saved');
          await page.reload();
          await open();
          await viaList(['am-carry', 'am-fast']);
        }
        await viaList(['am-price']);
      }

      // Evening: the scene changes period and analysis waits for all five notes.
      await use('.ow-next');
      await page.waitForFunction(() => document.querySelector('.ow-clock').textContent === '17:00');
      assert.equal(await page.locator('.ow-period').innerText(), 'ช่วงเย็น');
      await viaList(['pm-stock-more']);
      assert.ok(await page.locator('.ow-next').isDisabled(), 'analysis must wait for five notes');
      await viaList(['pm-stock']);
      assert.deepEqual(await rows(), ORDER, 'notebook must list both periods in time order');
      assert.doesNotMatch(await page.locator('.observe-walk').innerText(), /\b(?:undefined|NaN)\b/);
      await analyse();

      let state = await saved();
      const record = state.observations.timeCompare[product];
      assert.equal(state.rounds['0-1'].stars, 3, product + ': 12/12 must earn three stars');
      assert.equal(record.score, 1);
      assert.equal(record.route, 'walk');
      assert.deepEqual(record.events.map((event) => [event.id, event.minute, event.selectedObservationId, event.selectedReasonId]),
        ORDER.map((id, i) => [id, [422, 426, 429, 1024, 1028][i], 'fact', id + '-supported']));
      assert.deepEqual(record.comparison, [{ period: 'am', sampleCount: 3, selectedGroupId: 'carry' }, { period: 'pm', sampleCount: 2, selectedGroupId: 'home' }]);
      assert.equal(record.proposal.eventId, 'am-fast');
      assert.match(state.portfolio['w1-observe'].text, /am-fast/);
      if (product === 'snack') assert.deepEqual(state.observations.timeCompare.water, seed.observations.timeCompare.water, 'another product\'s notes changed');

      if (product === 'water') {
        // Replay with 9/12: the attempt is saved, the best stars stay.
        await use('#modal [data-a="again"]');
        await page.locator('.observe-walk canvas').waitFor();
        await viaList(['am-carry', 'am-fast', 'am-price']);
        await use('.ow-next');
        await viaList(['pm-stock', 'pm-stock-more']);
        await analyse({ wrongObservation: 'am-carry', wrongReason: 'am-fast', wrongEvening: true });
        state = await saved();
        assert.equal(state.observations.timeCompare.water.score, 0.75, 'the 9/12 replay was not saved');
        assert.equal(state.rounds['0-1'].stars, 3, 'a weaker replay lowered the best stars');
      }

      if (product === 'snack') {
        await use('#modal [data-a="again"]');
        await use('[data-walk-classic]');
        await page.locator('.lesson .nx, .precheck .opt, .stage .observe-compare').first().waitFor({ timeout: 5000 });
        assert.equal(await page.locator('.observe-walk').count(), 0, 'the list route must leave the walk');
      }
      assert.deepEqual(errors, [], product + ': Chromium runtime or asset errors');
      console.log(`W1R2 observe-walk ${product} @ ${width}px ${touch ? 'touch' : 'keyboard'}${seed.settings.sound ? '' : ' muted'}: passed`);
    } finally {
      await context.close();
    }
  }
  // Motion on: the student walks to the counter, can be heard only after arriving, and the list route snaps them there.
  const context = await browser.newContext({ viewport: { width: 1280, height: 880 }, reducedMotion: 'no-preference' });
  await context.addInitScript((state) => localStorage.setItem('mtl-save-v1', JSON.stringify(state)), save('water'));
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const poses = () => page.locator('.walk-viewport').getAttribute('data-poses');
    const open = async () => {
      await page.locator('#homeBtn').click();
      await page.locator('.week[data-w="0"]').click();
      await page.locator('.round[data-r="1"]').click();
      await page.locator('.observe-walk canvas').waitFor();
    };
    await page.goto(url);
    await open();
    assert.match(await poses(), /am-fast:walk/, 'the student should walk in when motion is allowed');
    // Sample the view during the walk: the student must cross the picture before arriving.
    const canvas = page.locator('.observe-walk canvas');
    const before = await canvas.screenshot();
    let crossed = false;
    for (let i = 0; i < 30 && /am-fast:walk/.test(await poses()); i++) {
      await page.waitForTimeout(250);
      crossed ||= !before.equals(await canvas.screenshot());
    }
    assert.ok(crossed, 'the walking customer never appeared in view');
    await page.waitForFunction(() => !/am-fast:walk/.test(document.querySelector('.walk-viewport').dataset.poses), null, { timeout: 8000 });
    await page.locator('[data-ow-go="am-fast"]').click();
    await page.locator('.walk-viewport[data-focus="am-fast"][data-level="ready"]').waitFor({ timeout: 5000 });
    assert.match(await poses(), /am-fast:action/, 'an arrived customer must switch to the pay pose when heard');
    await page.reload();
    await open();
    assert.match(await poses(), /am-fast:walk/);
    await page.locator('[data-ow-go="am-fast"]').click();
    await page.locator('.walk-viewport[data-focus="am-fast"][data-level="ready"]').waitFor({ timeout: 5000 });
    assert.match(await poses(), /am-fast:action/, 'the list route must bring a walking customer to the counter');
    assert.deepEqual(errors, [], 'walk-in: Chromium runtime errors');
    console.log('W1R2 observe-walk walk-in @ 1280px motion on: passed');
  } finally {
    await context.close();
  }
  return problems;
}

async function main() {
  const [modules] = process.argv.slice(2);
  if (!modules) throw new Error('Usage: node tools/browser-check-observe-walk.js <node_modules path>');
  const { withGameServer } = require('./run-browser-check.js');
  const modulesPath = path.resolve(modules);
  const axeScript = path.join(modulesPath, 'axe-core/axe.min.js');
  const { chromium } = require(path.join(modulesPath, 'playwright'));
  process.chdir(os.tmpdir());
  await withGameServer(async (url) => {
    const browser = await chromium.launch({ args: ['--disable-crashpad-for-testing'] });
    try {
      const problems = await verifyObserveWalk(browser, url, axeScript);
      if (problems.length) throw new Error(problems.join('\n'));
    } finally {
      await browser.close();
    }
  });
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = verifyObserveWalk;

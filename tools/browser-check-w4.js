/* Real-store acceptance scenario. Run in a fresh browser context and reload between phases. */
module.exports = async (phase) => {
  const key = 'mtl-save-v1';
  const M = window.MTL;
  const assert = (condition, failure) => { if (!condition) throw new Error(failure); };
  const find = (selector) => {
    const element = document.querySelector(selector);
    assert(element, `Missing ${selector}`);
    return element;
  };
  const click = (selector) => {
    const element = find(selector);
    assert(!element.disabled, `Disabled ${selector}`);
    element.click();
  };
  const set = (form, values) => {
    for (const [key, value] of Object.entries(values)) {
      const element = find(`${form} [name="${key}"]`);
      if (typeof value === 'boolean') element.checked = value;
      else element.value = value;
    }
  };
  const enter = async (round) => {
    await M.nav.play(3, round);
    click(`.precheck .opt[data-k="${M.WEEKS[3].rounds[round].check.answer}"]`);
    click('.precheck .go');
  };
  const finish = (values) => {
    set('.calc-form', values);
    click('.calc-form .chk');
    assert(find('.solution').textContent.includes('(3/3)'), 'Real-store calculation was not three correct answers');
    click('.save-real');
  };
  const records = () => M.RealW4.evidence({ product: M.PRODUCTS.water, state: M.State.data });

  if (phase === 'seed') {
    localStorage.setItem(key, JSON.stringify({
      version: 1, product: 'water', settings: { sound: false, tts: false, unlockAll: true },
      rounds: { '0-0': { stars: 3, score: 1 } }, lessons: { '3-0': true, '3-1': true, '3-2': true },
      sim: { plan: { bundle: 36 } }, portfolio: { 'w4-baseline': { week: 4, title: 'ยอดปกติเดิม', text: 'เดิม' } },
    }));
    return;
  }

  assert(M.State.data.portfolio['w4-baseline-v01']?.text === 'เดิม', 'v0.1 portfolio was not migrated');
  if (phase === 'exercise') {
    await enter(0);
    click('.use-real');
    const conditions = { origin: 'นับที่ร้าน', weather: 'ปกติ', supply: 'มีสินค้าตลอด', competitor: 'ไม่มี', start: '23:55', duration: '๑๕' };
    set('.real-entry', { ...conditions, day: '2026-10-31', reference: 'BASE-1', P: '๑๘.๗๕๕', C: '๑๐.๒๕', N0: '๑๐', K0: '๙' });
    click('.real-entry button');
    assert(find('[name="P"]').getAttribute('aria-invalid') === 'true', 'More than two decimals were accepted');
    set('.real-entry', { P: ' ๑๘.๗๕ ' });
    click('.real-entry button');
    assert(find('[name="N0"]').getAttribute('aria-invalid') === 'true', 'Baseline sales exceeded known stock');
    set('.real-entry', { K0: '๑๐' });
    click('.real-entry button');
    assert(find('.calc-intro').textContent.includes('2026-11-01 00:10'), 'Cross-midnight end is missing its date');
    finish({ r0: '187.50', c0: '102.50', g0: '85' });
    const { baseline: b } = records();
    assert(b.P === 1875 && b.C === 1025 && b.G0 === 8500 && b.period.endDay === '2026-11-01', 'Baseline loses satang or period');

    await enter(2);
    assert(find('.to-plan'), 'Run was available before its plan');
    await enter(1);
    set('.real-entry', { B: '๓๐.๗๕', F: '๕.๒๕', K1: '๐' });
    click('.real-entry button');
    finish({ margin: '10.25', cover: '1', match: '9' });
    const { plan: p } = records();
    assert(p.baselineId === b.id && p.K1 === 0, 'Plan lost its baseline reference or actual zero stock');

    await enter(2);
    click('.forecast-run');
    finish({ c1: '0', g1: '-5.25', dec: 'หยุด' });
    const { run: forecast } = records();
    assert(forecast.kind === 'forecast' && forecast.planId === p.id && forecast.G1 === -525 && forecast.decision === 'หยุด', 'Forecast did not use the saved plan');
    assert(M.State.data.portfolio['w4-store-water-run'].text.includes('ตามแบบจำลอง'), 'Forecast was not labeled in the portfolio');

    await enter(2);
    click('.actual-run');
    set('.real-entry', { ...conditions, day: '2026-11-02', duration: '๑๐', reference: 'PROMO-1', B: '๓๒.๒๕', F: '๖.๒๕', S: '๗', U: '๓', K1: '๑๖', matches: true });
    click('.real-entry button');
    assert(find('[name="K1"]').getAttribute('aria-invalid') === 'true', 'Observed promo sold more units than available');
    assert(find('[name="changeReason"]').getAttribute('aria-invalid') === 'true', 'Observed values diverged from the plan without an explanation');
    set('.real-entry', { K1: '๑๗', changeReason: 'เปลี่ยนป้ายราคา' });
    click('.real-entry button');
    finish({ c1: '174.25', g1: '101.50', dec: 'หลักฐานยังไม่พอสำหรับสรุปผลโปร' });
    const { run: mismatch } = records();
    assert(mismatch.decision === null && !mismatch.comparable && mismatch.G1 === 10150, 'Different-length periods produced a promo recommendation');

    await enter(2);
    click('.actual-run');
    set('.real-entry', { duration: '๑๕' });
    click('.real-entry button');
    finish({ c1: '174.25', g1: '101.50', dec: 'ทำต่อ' });
    const { run: observed } = records();
    assert(observed.kind === 'observed' && observed.comparable && observed.decision === 'ทำต่อ', 'Matched periods did not produce an evidence-based recommendation');
    const ctx = { product: M.PRODUCTS.water, state: M.State.data };
    const quote = M.WEEKS[3].rounds[3].script(ctx)[3].choices[0].en;
    assert(quote.includes('thirty-two baht and twenty-five satang'), 'English round did not use actual cents');
    return;
  }

  assert(phase === 'reload', `Unknown W4 acceptance phase ${phase}`);
  const { baseline: b, plan: p, run: observed } = records();
  assert(observed?.baselineId === b.id && observed.planId === p.id && observed.G1 === 10150, 'Observed comparison did not survive reload');
  await enter(1);
  set('.real-entry', { B: '๓๗.๕๐' });
  click('.real-entry button');
  finish({ margin: '17', cover: '1', match: '6' });
  assert(records().run === null && !M.State.data.portfolio['w4-store-water-run'], 'Replanning did not invalidate the old run and portfolio item');
  const ctx = { product: M.PRODUCTS.water, state: M.State.data };
  assert(M.WEEKS[3].rounds[3].script(ctx).filter((s) => s.choices).every((s) => s.choices.length >= 2 && new Set(s.choices.map((c) => c.en)).size === s.choices.length), 'Regular-price bundle has duplicated or insufficient dialogue choices');
  await enter(0);
  click('.use-real');
  click('.real-entry button');
  finish({ r0: '187.50', c0: '102.50', g0: '85' });
  assert(records().baseline.id !== b.id && records().plan === null && records().run === null, 'Changing the baseline did not invalidate the dependent stages');

  click('#menuBtn');
  window.confirm = () => true;
  click('#modal [data-a="drop"]');
  const saved = JSON.parse(localStorage.getItem(key));
  assert(records().baseline === null && !M.RealW4.hasReal('water') && !saved.sim.promoV2.water.history.length, 'Deletion left active or archived real data');
  assert(saved.rounds['0-0'].stars === 3 && saved.portfolio['w4-baseline-v01'].text === 'เดิม', 'Deleting real-store data also removed stars or legacy work');
  assert(!Object.keys(saved.portfolio).some((key) => key.startsWith('w4-store-water-')), 'Deletion left real-store portfolio items');
};

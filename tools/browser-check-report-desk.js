// Playwright acceptance scenario for the W6R5 report desk (GDD §8). Phases: hash, states, reload.
module.exports = async function reportDesk(phase) {
  const M = window.MTL;
  const State = M.State;
  const D = M.ReportDeskModel;
  const pid = 'water';
  const key = 'w6-report-desk-water';
  const assert = (condition, reason) => { if (!condition) throw new Error(reason); };
  const one = (selector) => {
    const found = document.querySelector(selector);
    if (!found) throw new Error('Report desk control missing: ' + selector);
    return found;
  };
  const click = (selector) => one(selector).click();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (selector) => {
    const deadline = Date.now() + 5000;
    while (!document.querySelector(selector) && Date.now() < deadline) await wait(25);
    return one(selector);
  };
  const desk = () => one('.report-desk').innerText;
  const round = () => M.WEEKS[5].rounds[4];
  const open = async () => {
    State.data.lessons = State.data.lessons || {};
    State.data.lessons['5-4'] = true;
    await M.nav.play(5, 4);
    click('.precheck .opt[data-k="' + round().check.answer + '"]');
    click('.precheck .go');
    one('.report-desk');
  };
  const seed = (store) => { State.data.sim.promoV2[pid] = { version: 2, history: [], baseline: null, plan: null, run: null, ...store }; };
  const base = { id: 'base-sim-1', version: 2, source: 'จำลอง', seed: 7, slot: 'pm', event: 'none', T: 30, K0: 60, P: 2000, C: 1200, N0: 20, R0: 40000, COGS0: 24000, G0: 16000 };
  const plan = { id: 'plan-sim-1', baselineId: 'base-sim-1', practiceBase: false, B: 3600, F: 3000 };
  const run = { id: 'run-sim-1', baselineId: 'base-sim-1', planId: 'plan-sim-1', source: 'จำลอง', B: 3600, F: 3000, S: 8, U: 13, N1: 29, R1: 54800, COGS1: 34800, G1: 17000, G0: 16000, delta: 1000, decision: 'ทำต่อ', route: 'list', practiceBase: false };
  const period = { day: '2026-11-01', start: '09:00', duration: 30, endDay: '2026-11-01', end: '09:30' };
  const inputs = { origin: 'บันทึกยอดขายร้าน', reference: 'OBS-1', weather: 'ปกติ', supply: 'มีสินค้าตลอด', competitor: 'ไม่มี', duration: 30, start: '09:00' };
  const realBase = { ...base, id: 'base-real-1', source: M.RealW4.real, period, inputs };
  const realPlan = { ...plan, id: 'plan-real-1', baselineId: 'base-real-1' };
  const realRun = { ...run, id: 'run-real-1', baselineId: 'base-real-1', planId: 'plan-real-1', source: M.RealW4.real, kind: 'observed', period, route: undefined,
    inputs: { ...inputs, weather: 'ฝนตก', matches: true }, comparable: false, decision: null, sourceByField: { R1: 'คำนวณจากข้อมูลจริง', F: M.RealW4.real } };

  if (phase === 'hash') {
    // เปิดผ่าน #report-desk: ยังต้องผ่านบทเรียนและคำถามเช็กก่อนเล่น แล้วจึงถึงโต๊ะ
    State.data.lessons = { ...State.data.lessons, '5-4': true };
    State.save();
    click('.product-pick [data-p="' + pid + '"]');
    assert(one('#startBtn').textContent.includes('เข้าร้าน'), 'Hash entry did not offer to enter the desk round');
    click('#startBtn');
    await waitFor('.precheck .opt');
    click('.precheck .opt[data-k="' + round().check.answer + '"]');
    click('.precheck .go');
    one('.report-desk');
    assert(document.documentElement.scrollWidth <= window.innerWidth + 1, 'Report desk overflows the screen width');
    return;
  }

  if (phase === 'reload') {
    const saved = State.data.portfolio[key];
    assert(saved && saved.week === 6, 'Report desk portfolio entry did not survive reload');
    assert(saved.data.store.runId === 'run-sim-1' && saved.data.store.baselineId === 'base-sim-1', 'Store run references lost after reload');
    assert(saved.text.includes('run-sim-1') && saved.text.includes('SIM-TH-56-1-2025') && saved.text.includes('SIM-US-10K-FY2025'), 'Run or document IDs missing from the saved entry');
    click('#homeBtn');
    click('#pfBtn');
    assert(document.body.innerText.includes('โต๊ะอ่านผลประกอบการ') && document.body.innerText.includes('run-sim-1'), 'Portfolio screen does not show the report desk entry');
    assert(State.data.rounds['5-4'].stars === 3, 'Original W6R5 stars changed across reload');
    State.data.sim.promoV2[pid].run.id = 'run-sim-2';
    await open();
    assert(desk().includes('อ้างผลหรือตัวอย่างชุดอื่น'), 'A saved entry from an older run must be marked as referring to another set');
    click('.rd-skip');
    one('.stage .opt');
    return;
  }

  Object.assign(State.data.settings, { sound: false, tts: false, unlockAll: true });
  State.data.product = pid;

  // ไม่มีผลของผู้เล่น: ใช้ตัวอย่าง seed 4001 ที่กำกับชัดเจนและมีทางกลับไปทำฐานก่อน
  delete State.data.sim.promoV2[pid];
  await open();
  let text = desk();
  assert(text.includes('ตัวอย่างฝึก') && text.includes('4001') && text.includes('604') && text.includes('190') && text.includes('ปรับ') && text.includes('30 นาที · บาท'), 'Sample card seed 4001 missing');
  assert(one('.rd-go').textContent.includes('W4R1'), 'Missing baseline should point back to W4R1');
  assert(!/\b(?:undefined|NaN)\b/.test(text), 'Sample card has invalid text');

  // ชุดฝึกและชุดที่ฐานเปลี่ยนหลังรันแล้วไม่ใช่ผลของผู้เล่น
  seed({ baseline: null, plan: { ...plan, baselineId: 'practice-4002', practiceBase: true }, run: { ...run, baselineId: 'practice-4002', practiceBase: true } });
  await open();
  assert(desk().includes('ตัวอย่างฝึก') && desk().includes('โจทย์ฝึก'), 'Practice data was accepted as a player report');
  seed({ baseline: { ...base, id: 'base-new' }, plan, run });
  await open();
  assert(desk().includes('ตัวอย่างฝึก') && one('.rd-go').textContent.includes('W4R2'), 'A run left behind after changing the baseline was accepted');

  // ผลจำลองของผู้เล่นที่ผูกชุดเดียวกัน ไม่มีหลักฐานฉากเดินก็ใช้ได้ และข้อความจากเซฟที่ถูกแก้ต้องไม่กลายเป็นแท็ก
  seed({ baseline: base, plan, run: { ...run, route: 'walk', evidence: [{ id: 'w4r3-sign', text: '<img src=x onerror="window.__rdxss=1">' }] } });
  await open();
  text = desk();
  assert(!text.includes('ตัวอย่างฝึก') && text.includes('run-sim-1') && text.includes('548') && text.includes('ทำต่อ'), 'Linked simulated run not shown');
  assert(!document.querySelector('.report-desk img') && !window.__rdxss, 'Saved text was not escaped');
  assert(one('.rd-walk summary').textContent.includes('1 จุด') && one('.rd-walk').textContent.includes('<img'), 'Walk evidence should appear as plain text');
  seed({ baseline: base, plan, run });
  await open();
  assert(desk().includes('ไม่มีบันทึกจากฉากเดิน'), 'A run without walk evidence must still display');

  // ผลจริงที่เทียบไม่ได้ ผลคาดการณ์ และผลจริงที่เทียบได้
  seed({ baseline: realBase, plan: realPlan, run: realRun });
  await open();
  text = desk();
  assert(text.includes('หลักฐานยังไม่พอสำหรับสรุปผลโปร') && text.includes('อากาศต่างกัน') && text.includes('2026-11-01 09:00–09:30'), 'Incomparable real run lost its label or reasons');
  seed({ baseline: realBase, plan: realPlan, run: { ...realRun, kind: 'forecast', source: 'จำลอง', comparable: false, decision: 'ปรับ', sourceByField: { F: 'แผน' } } });
  await open();
  text = desk();
  assert(text.includes('ปรับ ตามแบบจำลอง') && text.includes('ผลโปรจำลอง'), 'Forecast must be labelled as model output');
  seed({ baseline: realBase, plan: realPlan, run: { ...realRun, inputs: { ...inputs, matches: true }, comparable: true, decision: 'ทำต่อ' } });
  await open();
  assert(desk().includes('ทำต่อ') && !desk().includes('หลักฐานยังไม่พอ'), 'Comparable real run should show its decision');

  // กลับมาใช้ชุดจำลองที่ผูกกันเพื่อทดสอบฟอร์ม
  seed({ baseline: base, plan, run });
  await open();

  // แท็บแฟ้มรายงานใช้คีย์บอร์ดได้
  const tab = (id) => one('#rd-tab-' + id);
  tab('th').focus();
  tab('th').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert(tab('us').getAttribute('aria-selected') === 'true' && document.activeElement === tab('us') && one('#rd-panel-th').hidden && !one('#rd-panel-us').hidden, 'ArrowRight did not move to the 10-K tab');
  tab('us').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  assert(tab('th').getAttribute('aria-selected') === 'true' && !one('#rd-panel-th').hidden, 'Home did not return to the first tab');

  // เลือกไม่ครบหรือเลือกผิด: ต้องชี้ข้อที่ต้องตรวจและยังไม่จด
  const pick = (name, value) => click('input[name="' + name + '"][value="' + value + '"]');
  click('.rd-record[data-report="th"]');
  assert(one('#rd-th-metric-err').textContent.includes('เลือก') && !document.querySelector('#rd-panel-th .rd-row-list [data-del]'), 'Empty selection must not record');
  pick('rd-th-metric', 'netProfit'); pick('rd-th-page', 'overview'); pick('rd-th-period', 'fy2024'); pick('rd-th-unit', 'thb');
  click('.rd-record[data-report="th"]');
  assert(one('#rd-th-page-err').textContent.length && one('#rd-th-period-err').textContent.length && one('#rd-th-unit-err').textContent.length, 'Wrong page, period and unit must each be pointed out');
  assert(!document.querySelector('#rd-panel-th .rd-row-list [data-del]'), 'A wrong selection was recorded');

  // จดถูกทั้งสองแฟ้ม แล้วลองบันทึกเมื่อยังขาดแฟ้มหรือตอบข้อเทียบผิด
  const record = (report, metric) => {
    const want = D.expected(D.reportOf(report), metric);
    click('#rd-tab-' + report);
    pick('rd-' + report + '-metric', metric); pick('rd-' + report + '-page', want.pageId);
    pick('rd-' + report + '-period', want.periodId); pick('rd-' + report + '-unit', want.unitId);
    click('.rd-record[data-report="' + report + '"]');
  };
  record('th', 'netProfit');
  assert(one('.rd-status').textContent.includes('จดแล้ว') && document.querySelectorAll('#rd-panel-th .rd-row-list [data-del]').length === 1, 'Correct reading was not recorded');
  record('th', 'netProfit');
  assert(document.querySelectorAll('#rd-panel-th .rd-row-list [data-del]').length === 1, 'Recording the same item twice must keep one row');
  const before = Object.keys(State.data.portfolio).length;
  pick('rd-contrast-profit', 'opCash');
  click('.rd-save');
  assert(one('.rd-status').textContent.includes('บริษัทสหรัฐตัวอย่าง') && one('#rd-contrast-profit-err').textContent.length && Object.keys(State.data.portfolio).length === before, 'Saving with a missing file or wrong contrast answer must be refused');
  record('us', 'opCash');
  pick('rd-contrast-profit', 'netProfit'); pick('rd-contrast-cash', 'opCash');

  // บันทึกแล้วไปคำถามเดิม 4 ข้อ ตอบครบได้ 3 ดาวและตัวหารเดิม
  click('.rd-save');
  const entry = State.data.portfolio[key];
  assert(entry && entry.week === 6 && entry.data.store.runId === 'run-sim-1' && entry.data.reports[1].entries[0].metric === 'opCash', 'Report desk entry not saved with its references');
  assert(one('.stage .q-count').textContent.includes('/ 4'), 'Original four-question quiz did not follow the desk');
  for (const q of round().questions({ product: M.PRODUCTS[pid], state: State.data })) {
    click('.stage .opt[data-k="' + q.answer + '"]');
    click('.stage .nx');
  }
  await waitFor('#modal:not(.hidden)');
  assert(document.querySelector('#modal').innerText.includes('ตอบถูก 4 จาก 4 ข้อ') && State.data.rounds['5-4'].stars === 3 && State.data.rounds['5-4'].score === 1, 'W6R5 stars or denominator changed');

  // เล่นซ้ำโดยข้ามโต๊ะ ตอบผิดสองข้อ: คะแนนที่ดีที่สุดเดิมต้องไม่ลดลง และไม่เพิ่มรายการแฟ้มใหม่
  click('#modal [data-a="again"]');
  await waitFor('.precheck .opt');
  click('.precheck .opt[data-k="' + round().check.answer + '"]');
  click('.precheck .go');
  await waitFor('.rd-skip');
  const count = Object.keys(State.data.portfolio).length;
  click('.rd-skip');
  const qs = round().questions({ product: M.PRODUCTS[pid], state: State.data });
  for (const [i, q] of qs.entries()) {
    const wrong = q.options.findIndex((_, k) => k !== q.answer);
    click('.stage .opt[data-k="' + (i < 2 ? wrong : q.answer) + '"]');
    click('.stage .nx');
  }
  await waitFor('#modal:not(.hidden)');
  assert(State.data.rounds['5-4'].stars === 3 && State.data.rounds['5-4'].score === 1 && Object.keys(State.data.portfolio).length === count, 'A lower replay changed the best result or portfolio');
  click('#modal [data-a="back"]');

  // คืนชุดจำลองให้ตรงกับแฟ้มที่บันทึกไว้ แล้วเซฟเพื่อให้เฟส reload ตรวจรหัสผลหลังโหลดหน้าใหม่
  seed({ baseline: base, plan, run });
  State.save();
};

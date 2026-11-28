// Playwright acceptance scenario for the W5R5 Limit order desk (GDD §8). Phases: hash, states, reload.
module.exports = async function limitDesk(phase) {
  const M = window.MTL;
  const State = M.State;
  const D = new Proxy({}, { get: (_, name) => M.LimitDeskModel[name] }); // โหลดพร้อมโต๊ะ
  const pid = 'snack';
  const key = 'w5-limit-desk-snack';
  const assert = (condition, reason) => { if (!condition) throw new Error(reason); };
  const one = (selector) => {
    const found = document.querySelector(selector);
    if (!found) throw new Error('Limit desk control missing: ' + selector);
    return found;
  };
  const click = (selector) => {
    const element = one(selector);
    assert(!element.disabled && !element.hidden, 'Limit desk control unavailable: ' + selector);
    element.click();
  };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (selector) => {
    const deadline = Date.now() + 5000;
    while (!document.querySelector(selector) && Date.now() < deadline) await wait(25);
    return one(selector);
  };
  const desk = () => one('.limit-desk').innerText;
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const round = () => M.WEEKS[4].rounds[4];
  const open = async () => {
    State.data.lessons = State.data.lessons || {};
    State.data.lessons['4-4'] = true;
    await M.nav.play(4, 4);
    click('.precheck .opt[data-k="' + round().check.answer + '"]');
    click('.precheck .go');
    await waitFor('.limit-desk');
  };
  const order = (price, qty) => {
    one('#ld-price').value = price;
    one('#ld-qty').value = qty;
    click('.ld-send');
  };
  const walk = () => {
    const seen = [];
    seen.push(one('.ld-now').innerText);
    while (!one('.ld-next').hidden) { click('.ld-next'); seen.push(one('.ld-now').innerText); }
    return seen;
  };
  const explain = (cause) => {
    click('input[name="ld-cause"][value="' + cause + '"]');
    click('.ld-check');
  };

  if (phase === 'hash') {
    // เปิดผ่าน #limit-desk: ยังต้องผ่านบทเรียนและคำถามเช็กก่อนเล่น แล้วจึงถึงโต๊ะ
    State.data.lessons = { ...State.data.lessons, '4-4': true };
    State.save();
    click('.product-pick [data-p="' + pid + '"]');
    assert(one('#startBtn').textContent.includes('เข้าร้าน'), 'Hash entry did not offer to enter the desk round');
    click('#startBtn');
    await waitFor('.precheck .opt');
    click('.precheck .opt[data-k="' + round().check.answer + '"]');
    click('.precheck .go');
    await waitFor('.limit-desk');
    assert(desk().includes('เงินสมมติ') && desk().includes('SIM-SNK') && desk().includes('ค่าฝึกในเกม'), 'Desk must show the safety label, the fictional company and practice values');
    assert(document.documentElement.scrollWidth <= window.innerWidth + 1, 'Limit desk overflows the screen width');
    order('9.90', '100');
    walk();
    assert(document.documentElement.scrollWidth <= window.innerWidth + 1, 'Limit desk timeline overflows the screen width');
    return;
  }

  if (phase === 'reload') {
    const saved = State.data.portfolio[key];
    assert(saved && saved.week === 5, 'Limit desk portfolio entry did not survive reload');
    assert(saved.data.runs.map((r) => r.orderId).join() === 'SIM-ORD-1-2,SIM-ORD-2-1,SIM-ORD-3-1' && saved.data.wallet.cash === 602000, 'Order references or wallet lost after reload');
    assert(saved.data.setCheck && saved.data.setCheck.date === today() && saved.text.includes('<img'), 'SET note lost after reload');
    click('#homeBtn');
    click('#pfBtn');
    assert(document.body.innerText.includes('โต๊ะคำสั่ง Limit จำลอง') && document.body.innerText.includes('SIM-ORD-3-1-T1'), 'Portfolio screen does not show the limit desk entry');
    assert(!document.querySelector('img[src="x"]') && !window.__ldxss, 'Saved note was rendered as markup');
    assert(State.data.rounds['4-4'].stars === 3, 'Original W5R5 stars changed across reload');
    await open();
    assert(desk().includes('เคยบันทึกใบงานโต๊ะนี้ไว้แล้ว'), 'A saved entry must be mentioned when the desk opens again');
    click('.ld-skip');
    one('.stage .opt');
    return;
  }

  Object.assign(State.data.settings, { sound: false, tts: false, unlockAll: true });
  State.data.product = pid;
  delete State.data.portfolio[key];
  await open();
  assert(!/\b(?:undefined|NaN)\b/.test(desk()), 'Desk has invalid text');

  // ภารกิจ 1: กติกาแต่ละข้อต้องชี้ช่องที่ผิดและยังไม่ส่งคำสั่ง
  order('10.05', '100');
  assert(one('#ld-price-err').textContent.includes('0.10') && !document.querySelector('.ld-timeline'), 'Off-tick price was accepted');
  order('13.50', '100');
  assert(one('#ld-price-err').textContent.includes('กรอบราคา'), 'Price outside the band was accepted');
  order('9.95', '150');
  assert(one('#ld-qty-err').textContent.includes('ทวีคูณของ 100') && !one('#ld-price-err').textContent, 'Odd lot was accepted or a valid price was flagged');
  order('10.10', '100');
  assert(one('#ld-price-err').textContent.includes('ไม่เกิน 10.00'), 'Price above the mission cap was accepted');

  // ปุ่ม + / − เลื่อนตามช่วงราคาและหน่วยซื้อขาย
  one('#ld-price').value = '9.95';
  click('.ld-price-up');
  assert(one('#ld-price').value === '10.00', 'Price + did not move 9.95 → 10.00');
  click('.ld-price-up');
  assert(one('#ld-price').value === '10.10', 'Price + did not use the 0.10 tick above 10.00');
  click('.ld-price-down'); click('.ld-price-down');
  assert(one('#ld-price').value === '9.95', 'Price − did not return to 9.95');
  one('#ld-qty').value = '';
  click('.ld-qty-up'); click('.ld-qty-up');
  assert(one('#ld-qty').value === '200' && one('.ld-reserve').textContent.includes('1,990'), 'Lot buttons or reserve preview failed');

  // ตั้งต่ำกว่าราคาขาย: รอจนหมดเวลาแล้วสิ้นสุด อธิบายผิดได้คำแนะนำ อธิบายถูกแล้วยังต้องส่งใหม่
  order('9.95', '100');
  let seen = walk();
  assert(seen[0].includes('รอจับคู่') && seen[seen.length - 1].includes('สิ้นสุด'), 'Order below the offer should wait then expire');
  explain('filled');
  assert(one('#ld-cause-err').textContent.length && !document.querySelector('.ld-retry'), 'A wrong explanation was accepted');
  explain('no-seller');
  assert(one('.ld-after').innerText.includes('ยังไม่ผ่านภารกิจ') && one('.ld-after').innerText.includes('10.00'), 'Failed mission must ask for a new order');
  assert(one('.ld-wallet').innerText.includes('10,000 บาท'), 'An expired order must not spend money');
  click('.ld-retry');
  order('10.00', '100');
  seen = walk();
  assert(seen[0].includes('จับคู่ครบ') && desk().includes('SIM-ORD-1-2'), 'Order at the offer should fill at once on the second attempt');
  explain('filled');
  assert(one('.ld-wallet').innerText.includes('9,000 บาท') && one('.ld-wallet').innerText.includes('100 หุ้น'), 'Wallet did not update after the fill');
  click('.ld-go');

  // ภารกิจ 2: รอ → บางส่วน → ครบ
  order('9.95', '200');
  seen = walk();
  assert(seen[0].includes('รอจับคู่') && seen.some((s) => s.includes('จับคู่บางส่วน') && s.includes('100/200')) && seen[seen.length - 1].includes('จับคู่ครบ'), 'Mission 2 did not pass through waiting, partial and filled');
  assert(one('.ld-board').innerText.includes('9.95'), 'Board did not keep the remaining offer');
  explain('filled');
  click('.ld-go');

  // ภารกิจ 3: คิวราคาเดียวกัน คำสั่งของผู้เล่นแสดงบนกระดาน ได้ 100 หุ้นแล้วสิ้นสุด
  order('9.90', '300');
  assert(one('.ld-board').innerText.includes('คำสั่งของคุณ') && one('.ld-board').innerText.includes('ส่งก่อนคุณ'), 'Queue markers missing on the board');
  seen = walk();
  assert(seen.some((s) => s.includes('จับคู่บางส่วน')) && seen[seen.length - 1].includes('สิ้นสุด') && one('.ld-timeline').innerText.includes('ส่งก่อนได้ไป 400'), 'Mission 3 queue result missing');
  explain('partial');
  assert(one('#ld-cause-err').textContent.length, 'Partial explanation must point to the queue');
  explain('queue');
  click('.ld-go');

  // สรุป: ตอบผิดหรือจดค่า SET ไม่ครบต้องบันทึกไม่ได้
  const before = Object.keys(State.data.portfolio).length;
  click('input[name="ld-final-level"][value="exact"]');
  click('input[name="ld-final-unmatched"][value="no-seller"]');
  click('.ld-save');
  assert(one('#ld-final-level-err').textContent.length && Object.keys(State.data.portfolio).length === before, 'Wrong summary answer must block saving');
  click('input[name="ld-final-level"][value="at-or-below"]');
  one('#ld-set-hours').value = '<img src=x onerror="window.__ldxss=1">';
  click('.ld-save');
  assert(one('#ld-set-err').textContent.includes('วันที่') && one('.ld-set').open && Object.keys(State.data.portfolio).length === before, 'A SET note without a date must block saving');
  one('#ld-set-date').value = today();
  click('.ld-save');
  const entry = State.data.portfolio[key];
  assert(entry && entry.week === 5 && entry.data.runs.length === 3 && entry.data.runs[0].attempts === 2 && entry.data.wallet.shares === 400, 'Limit desk entry not saved with its orders');
  assert(entry.text.includes('เงินสมมติ ไม่ส่งเข้าตลาดจริง') && entry.text.includes('SIM-SNK'), 'Saved entry lost its labels');

  // คำถามเดิม 4 ข้อ ตอบครบได้ 3 ดาว
  assert(one('.stage .q-count').textContent.includes('/ 4'), 'Original four-question quiz did not follow the desk');
  for (const q of round().questions({ product: M.PRODUCTS[pid], state: State.data })) {
    click('.stage .opt[data-k="' + q.answer + '"]');
    click('.stage .nx');
  }
  await waitFor('#modal:not(.hidden)');
  assert(document.querySelector('#modal').innerText.includes('ตอบถูก 4 จาก 4 ข้อ') && State.data.rounds['4-4'].stars === 3, 'W5R5 stars changed');
  click('#modal [data-a="back"]');
  State.save();
};

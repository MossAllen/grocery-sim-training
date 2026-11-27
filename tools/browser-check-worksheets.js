// Playwright acceptance scenario for the linked W3, W5 and W8 worksheets.
module.exports = async function worksheets(phase) {
  const M = window.MTL;
  const one = (selector) => {
    const result = document.querySelector(selector);
    if (!result) throw new Error('Worksheet control missing: ' + selector);
    return result;
  };
  const assert = (condition, reason) => { if (!condition) throw new Error(reason); };
  const click = (selector) => one(selector).click();
  const open = async (week, round) => {
    M.State.data.lessons ||= {};
    M.State.data.lessons[week + '-' + round] = true;
    await M.nav.play(week, round);
    click('.precheck .opt[data-k="' + M.WEEKS[week].rounds[round].check.answer + '"]');
    click('.precheck .go');
  };
  const field = (name) => one('.worksheet-form [name="' + name + '"]');
  const fill = (fields) => {
    for (const [name, value] of Object.entries(fields)) {
      field(name).value = value;
      field(name).dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  const submit = () => one('.worksheet-form').requestSubmit();
  const waitFor = async (selector) => {
    const deadline = Date.now() + 5000;
    while (!document.querySelector(selector) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    return one(selector);
  };
  const finish = () => {
    click('.stage .chk');
    click('.stage .sv');
    click('#modal [data-a="again"]');
  };
  const setup = M.State.data;
  const pid = 'water';

  if (phase === 'reload') {
    assert(setup.worksheets[pid].stock.rows[0].price === 1315, 'Satang not preserved across reload');
    assert(setup.worksheets[pid].post.messages === 0, 'Zero post count not preserved across reload');
    await open(7, 1);
    assert(one('.stage').textContent.includes('จริง — ผู้ฝึกบันทึก'), 'W8 evidence lost source label');
    click('.stage [data-evidence-source="0"]');
    const source = await waitFor('.play-head');
    assert(source.textContent.includes('สัปดาห์ 3'), 'W8 evidence link did not open its source round');
    click('#menuBtn');
    const confirmBefore = window.confirm;
    window.confirm = () => true;
    try { click('#modal [data-a="drop"]'); } finally { window.confirm = confirmBefore; }
    assert(!setup.worksheets[pid].stock && !setup.worksheets[pid].post && !setup.worksheets[pid].postEvidence, 'Data deletion did not clear current product records');
    assert(!setup.portfolio['w3-stock-water'] && !setup.portfolio['w5-metrics-water'], 'Data deletion did not clear exported copies');
    assert(setup.worksheets.snack.post.views === 8 && setup.rounds['2-0'].stars === 3, 'Data deletion affected other products or stars');
    return;
  }

  click('.product-pick [data-p="' + pid + '"]');
  click('#startBtn');
  Object.assign(setup.settings, { sound: false, tts: false, unlockAll: true });
  await open(2, 0);
  click('[data-worksheet="record"]');
  fill({ start: '2026-11-25', end: '2026-11-26', source0: 'จริง', name0: 'น้ำดื่มทดสอบ', cost0: '๗.๐๕', price0: '๑๓.๑๕',
    opening0: '๕', received0: '๕', sold0: '๙', waste0: '๒', counted0: '๑', cashIn0: '๖๐', cashOut0: '๔๐' });
  submit();
  assert(!setup.worksheets?.[pid]?.stock, 'Worksheet saved sales above available stock');
  fill({ sold0: '๘' });
  submit();
  const stock = setup.worksheets[pid].stock;
  assert(stock.rows.length === 5 && stock.rows[0].cost === 705 && stock.rows[0].price === 1315, 'Mixed worksheet/Thai decimal failed');
  assert(stock.rows[4].source === 'จำลอง', 'Worksheet lost simulated source on example row');
  stock.rows.forEach((row, i) => {
    one('.stage [name="f' + i + '"]').value = String((row.price - row.cost) / 100).replace(/\d/g, (d) => '๐๑๒๓๔๕๖๗๘๙'[d]);
  });
  finish();
  assert(setup.rounds['2-0'].stars === 3 && setup.portfolio['w3-stock-water'].text.includes('น้ำดื่มทดสอบ'), 'W3 Thai answers or portfolio save failed');
  await open(2, 3);
  await waitFor('.stage .opt');
  assert(one('.stage .chat').textContent.includes('five satang'), 'W3 dialogue rounded away satang');

  await open(4, 2);
  click('[data-worksheet="record"]');
  fill({ start: '2026-11-25', end: '2026-11-25', views: '๘', messages: '๙', orders: '๐' });
  submit();
  assert(!setup.worksheets[pid].post, 'Saved more messages than views');
  fill({ views: '๐', messages: '๐' });
  submit();
  for (let i = 0; i < 3; i++) one('.stage [name="f' + i + '"]').value = 'ยังคำนวณไม่ได้';
  finish();
  assert(setup.rounds['4-2'].stars === 3 && setup.portfolio['w5-metrics-water'].text.includes('ตัวหารเป็น 0'), 'W5 zero denominator or portfolio save failed');
  await open(7, 1);
  assert(one('.stage').textContent.includes(stock.id) && one('.stage').textContent.includes(setup.worksheets[pid].post.id), 'W8 does not show saved evidence references');
  setup.worksheets.snack = { post: { views: 8 } };
  M.State.save();
};

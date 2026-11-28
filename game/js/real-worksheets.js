/* ใบงานข้อมูลร้าน สัปดาห์ 3 และ 5 กับการตรวจหลักฐานในสัปดาห์ 8 (GDD §11) */
(function () {
  const M = window.MTL;
  const { $, esc, fmt, readDecimal, State } = M;
  const actual = 'จริง — ผู้ฝึกบันทึก';
  const simulated = 'จำลอง';
  const money = (satang) => fmt(satang / 100);
  const worksheet = (ctx) => ctx.state.worksheets?.[ctx.product.id] || {};
  const portfolioId = (ctx, id) => id + '-' + ctx.product.id;
  const put = (ctx, key, record) => {
    const all = ctx.state.worksheets ||= {};
    (all[ctx.product.id] ||= {})[key] = record;
    if (key === 'stock' || key === 'post' || key === 'postEvidence') delete ctx.state.portfolio[portfolioId(ctx, 'w8-evidence')];
    State.save();
  };
  const table = (title, headers, rows) => '<div class="worksheet-table" role="region" tabindex="0" aria-label="' + esc(title) + '">' +
    '<table class="tbl"><thead><tr>' + headers.map((h) => '<th scope="col">' + esc(h) + '</th>').join('') +
    '</tr></thead><tbody>' + rows.map((row) => '<tr>' + row.map((v) => '<td>' + esc(v) + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div>';
  const input = (id, label, value, attr = '') => '<label>' + esc(label) + '<input name="' + id + '" value="' + esc(value ?? '') + '" ' + attr + '></label>';
  const select = (id, label, options, value) => '<label>' + esc(label) + '<select name="' + id + '">' +
    options.map(([key, text]) => '<option value="' + esc(key) + '"' + (key === value ? ' selected' : '') + '>' + esc(text) + '</option>').join('') + '</select></label>';
  const numberInput = (id, label, value, precision) => input(id, label,
    value == null ? '' : value / 10 ** precision, 'inputmode="' + (precision ? 'decimal' : 'numeric') + '"');
  const rangeInputs = (record) => input('start', 'วันที่เริ่ม', record?.start, 'type="date"') + input('end', 'วันที่สิ้นสุด', record?.end, 'type="date"');
  const periodText = (record) => record.start + ' ถึง ' + record.end;
  const fields = (markup) => '<div class="worksheet-fields">' + markup + '</div>';
  const numericField = (label, answer, unit) => ({ label: esc(label), answer, unit: esc(unit) });

  function readForm(form) {
    let first;
    const control = (name) => form.elements.namedItem(name);
    const value = (name) => control(name).value.trim();
    const error = (name, message) => { if (!first) first = [control(name), message]; };
    const number = (name, max, precision = 0, min = 0) => {
      const result = readDecimal(value(name), precision);
      if (result === null || result < min || result > max * 10 ** precision) {
        error(name, 'กรอก' + (precision ? 'ตัวเลขทศนิยมไม่เกิน 2 ตำแหน่ง' : 'จำนวนเต็ม') + 'ในช่วง ' + fmt(min / 10 ** precision) + ' ถึง ' + fmt(max));
      }
      return result;
    };
    const dates = () => {
      const start = value('start'), end = value('end');
      if (!start) error('start', 'ระบุวันที่เริ่ม');
      if (!end || end < start) error('end', 'ระบุวันสิ้นสุดตั้งแต่วันที่เริ่มเป็นต้นไป');
      return { start, end };
    };
    return { value, error, number, dates, valid() {
      if (!first) return true;
      first[0].setCustomValidity(first[1]);
      first[0].reportValidity();
      return false;
    } };
  }

  function bindForm(el, collect, save) {
    $('form', el).onsubmit = (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      for (const field of form.elements) field.setCustomValidity('');
      const reader = readForm(form);
      const record = collect(reader);
      if (reader.valid()) save(record);
    };
  }

  const editable = [
    ['cost', 'ต้นทุนต่อหน่วย (บาท)', 10000, 2], ['price', 'ราคาขายต่อหน่วย (บาท)', 10000, 2, 1],
    ['opening', 'ยกมา', 10000, 0], ['received', 'รับเข้า', 10000, 0], ['sold', 'ขาย', 10000, 0],
    ['waste', 'เสีย / นำออก', 10000, 0], ['counted', 'ยอดนับ', 10000, 0],
    ['cashIn', 'เงินสดรับ (บาท)', 100000, 2], ['cashOut', 'เงินสดจ่าย (บาท)', 100000, 2],
  ];

  function exampleRow(ctx, index) {
    const item = [...ctx.product.items, ctx.product.small, ctx.product.big][index];
    const opening = 12 + index, received = 8, sold = 5 + index, waste = 1;
    return { name: 'รายการฝึก ' + (index + 1) + ' · ' + item.name, source: simulated, opening, received, sold, waste,
      counted: opening + received - sold - waste, cost: item.cost * 100, price: item.price * 100,
      cashIn: sold * item.price * 100, cashOut: received * item.cost * 100 };
  }

  function stockForm(el, ctx, record, save) {
    el.innerHTML = '<form class="worksheet-form" novalidate><p>บันทึกสินค้า 5 รายการในกลุ่ม ' + esc(ctx.product.th) + ' หน่วย ' + esc(ctx.product.unit) + ' ใช้ช่วงเดียวกันทุกแถว กรอกชื่อสินค้าโดยไม่ใส่ชื่อบุคคล</p>' +
      fields(rangeInputs(record)) + Array.from({ length: 5 }, (_, i) => {
        const row = record?.rows[i];
        return '<fieldset><legend>รายการ ' + (i + 1) + '</legend>' +
          fields(select('source' + i, 'ที่มา', [['จำลอง', simulated], ['จริง', actual]], row?.source === actual ? 'จริง' : 'จำลอง')) +
          '<div data-stock-fields="' + i + '">' + fields(input('name' + i, 'ชื่อสินค้า', row?.source === actual ? row.name : '', 'maxlength="48"') +
          editable.map(([key, label, , precision]) => numberInput(key + i, label, row?.source === actual ? row[key] : null, precision)).join('')) + '</div></fieldset>';
      }).join('') +
      '<fieldset><legend>เลือกสองรายการสำหรับฝึกพูด</legend>' + fields([0, 1].map((i) => select('speech' + i, i ? 'รายการที่สอง' : 'รายการแรก',
        Array.from({ length: 5 }, (_, j) => [String(j), 'รายการ ' + (j + 1)]), String(record?.speech[i] ?? i))).join('')) +
      '</fieldset><button class="btn primary">บันทึกชุดข้อมูลและเริ่มฝึก</button></form>';
    const form = $('form', el);
    for (let i = 0; i < 5; i++) {
      const source = form.elements['source' + i], values = $('[data-stock-fields="' + i + '"]', form);
      const toggle = () => { values.hidden = source.value !== 'จริง'; };
      source.onchange = toggle;
      toggle();
    }
    bindForm(el, (read) => {
      const dates = read.dates();
      const rows = Array.from({ length: 5 }, (_, i) => {
        if (read.value('source' + i) !== 'จริง') return exampleRow(ctx, i);
        const name = read.value('name' + i);
        if (!name) read.error('name' + i, 'ระบุชื่อสินค้า');
        const row = { name, source: actual };
        for (const [key, , max, precision, min] of editable) row[key] = read.number(key + i, max, precision, min);
        if (row.sold + row.waste > row.opening + row.received) read.error('waste' + i, 'ยอดขายและของเสียรวมกันต้องไม่เกินยกมาบวกรับเข้า');
        return row;
      });
      const speech = [Number(read.value('speech0')), Number(read.value('speech1'))];
      if (speech[0] === speech[1]) read.error('speech1', 'เลือกสินค้าคนละรายการ');
      return { ...dates, id: State.newId('stock'), unit: ctx.product.unit, rows, speech };
    }, save);
  }

  function stockSummary(record) {
    return record.rows.reduce((sum, row) => ({
      sales: sum.sales + row.sold * row.price, cogs: sum.cogs + row.sold * row.cost,
      cash: sum.cash + row.cashIn - row.cashOut,
    }), { sales: 0, cogs: 0, cash: 0 });
  }

  function stockExercise(el, round, ctx, finish, record) {
    const { rows, unit } = record, { sales, cogs, cash } = stockSummary(record);
    const header = ['สินค้า', 'ที่มา', 'บาท/หน่วย (ทุน / ขาย)', 'ยกมา', 'เข้า', 'ขาย', 'ออก', 'นับ', 'เงินสดรับ / จ่าย (บาท)'];
    const body = rows.map((r) => [r.name, r.source, money(r.cost) + ' / ' + money(r.price), r.opening, r.received,
      r.sold, r.waste, r.counted, money(r.cashIn) + ' / ' + money(r.cashOut)]);
    const intro = '<p>ชุด ' + esc(record.id) + ' · ' + esc(periodText(record)) + ' · หน่วย ' + esc(unit) + '</p>' + table('ใบงานสินค้า 5 รายการ', header, body);
    const work = { id: portfolioId(ctx, 'w3-stock'), title: 'ใบงานสินค้า 5 รายการ',
      text: 'ชุด ' + record.id + ' · ' + periodText(record) + ' · หน่วย ' + unit + '\n' +
        header.join(' | ') + '\n' + body.map((r) => r.join(' | ')).join('\n') + '\nยอดขาย ' + money(sales) +
        ' · ต้นทุนขาย ' + money(cogs) + ' · กำไรขั้นต้น ' + money(sales - cogs) + ' · เงินสดสุทธิ ' + money(cash) + ' บาท' };
    if (ctx.idx === 3) {
      const priceSpeech = (n) => M.baht(Math.floor(n / 100)) + (n % 100 ? ' and ' + M.words(n % 100) + ' satang' : '');
      const listen = (label, value) => ({ listen: label, options: M.R.shuffle([value, value + 100, value + 200].map((n) => money(n) + ' บาท')), answer: money(value) + ' บาท' });
      const script = record.speech.flatMap((i) => {
        const r = rows[i];
        return [{ them: 'It costs ' + priceSpeech(r.cost) + ' per unit and sells for ' + priceSpeech(r.price) + '.', th: r.name + ' · ' + r.source },
          listen('ต้นทุนต่อหน่วยที่ได้ยินคือเท่าไร', r.cost), listen('ราคาขายต่อหน่วยที่ได้ยินคือเท่าไร', r.price)];
      });
      M.engines.dialogue(el, { ...round, script: () => script }, ctx, finish);
      return;
    }
    const first = rows[0], balance = first.opening + first.received - first.sold - first.waste;
    const tasks = [
      { fields: rows.map((r, i) => numericField('ส่วนต่างต่อหน่วย รายการ ' + (i + 1), (r.price - r.cost) / 100, 'บาท')),
        solution: rows.map((r) => esc(r.name) + ' · ' + money(r.price) + ' − ' + money(r.cost) + ' = ' + money(r.price - r.cost) + ' บาท').join('<br>') },
      { fields: [numericField('ยอดขายรวม', sales / 100, 'บาท'), numericField('ต้นทุนขายรวม', cogs / 100, 'บาท'), numericField('กำไรขั้นต้น', (sales - cogs) / 100, 'บาท')],
        solution: 'รวม (จำนวนขาย × ราคา) = ' + money(sales) + ' บาท · รวม (จำนวนขาย × ต้นทุน) = ' + money(cogs) + ' บาท · กำไรขั้นต้น = ' + money(sales - cogs) + ' บาท' },
      { fields: [numericField('คงเหลือตามบันทึก รายการแรก', balance, unit), numericField('ยอดนับ − คงเหลือตามบันทึก รายการแรก', first.counted - balance, unit), numericField('เงินสดสุทธิรวม 5 รายการ', cash / 100, 'บาท')],
        solution: first.opening + ' + ' + first.received + ' − ' + first.sold + ' − ' + first.waste + ' = ' + balance +
          ' · ยอดนับ ' + first.counted + ' − ' + balance + ' = ' + (first.counted - balance) + ' · รวมเงินสดรับลบเงินสดจ่าย = ' + money(cash) + ' บาท' },
    ];
    M.engines.calc(el, { ...round, gen: () => ({ ...tasks[ctx.idx], intro, portfolio: work, fixed: true }) }, ctx, finish);
  }

  function postForm(el, saved, save) {
    el.innerHTML = '<form class="worksheet-form" novalidate><p>กรอกยอดคนจากโพสต์เดียวกันและช่วงเดียวกัน ใช้ยอดผู้ทักที่สั่งจากกลุ่มคนที่ทักเท่านั้น</p>' +
      fields(rangeInputs(saved) + select('source', 'แหล่งข้อมูล', [['รายงานช่องทาง', 'รายงานช่องทาง'], ['บันทึกทดสอบ', 'บันทึกทดสอบ']], saved?.source) +
      numberInput('views', 'คนเห็น', saved?.views, 0) + numberInput('messages', 'คนทัก', saved?.messages, 0) +
      numberInput('orders', 'ผู้ทักที่สั่ง', saved?.orders, 0)) +
      '<div class="row"><button class="btn primary">บันทึกยอดและเริ่มฝึก</button></div></form>';
    bindForm(el, (read) => {
      const dates = read.dates();
      const views = read.number('views', 1000000), messages = read.number('messages', 1000000), orders = read.number('orders', 1000000);
      if (messages > views) read.error('messages', 'คนทักต้องไม่เกินคนเห็น');
      if (orders > messages) read.error('orders', 'ผู้ทักที่สั่งต้องไม่เกินคนทัก');
      return { ...dates, views, messages, orders, source: read.value('source'), id: State.newId('post'), kind: actual };
    }, save);
  }

  const unavailable = 'ยังคำนวณไม่ได้';
  function rate(label, numerator, denominator) {
    return {
      question: denominator ? { ...numericField(label, numerator / denominator * 100, '%'), tol: 0.06 } :
        { label: esc(label), options: [unavailable, '0%', '100%'], answer: unavailable },
      explanation: label + ' · ' + fmt(numerator, 0) + ' ÷ ' + fmt(denominator, 0) + (denominator ? ' × 100 = ' + fmt(numerator / denominator * 100, 1) + '%' : ' · ' + unavailable + ' เพราะตัวหารเป็น 0'),
    };
  }
  const postSource = (post) => post.kind === actual ? actual + ' · ' + post.source + ' · ' + periodText(post) : simulated;
  const postText = (post) => postSource(post) + ' · เห็น ' + fmt(post.views, 0) + ' คน · ทัก ' + fmt(post.messages, 0) +
    ' คน · ผู้ทักที่สั่ง ' + fmt(post.orders, 0) + ' คน';
  function postExercise(el, round, ctx, finish, post, randomize) {
    const gen = () => {
      if (randomize) post = randomize();
      const results = [rate('อัตราทัก (ตัวหารคือคนเห็น)', post.messages, post.views),
        rate('อัตราสั่ง (ตัวหารคือคนทัก)', post.orders, post.messages), rate('อัตราสั่งเทียบคนเห็น', post.orders, post.views)];
      const text = postText(post) + '\n' + results.map((r) => r.explanation).join('\n');
      return { intro: '<p>' + esc(postText(post)) + '</p>', fields: results.map((r) => r.question),
        solution: results.map((r) => esc(r.explanation)).join('<br>'), fixed: !randomize,
        portfolio: { id: portfolioId(ctx, 'w5-metrics'), title: 'ใบงานวัดผลโพสต์', text },
        onSave: () => put(ctx, 'postEvidence', post) };
    };
    M.engines.calc(el, { ...round, gen }, ctx, finish);
  }

  function review(el, round, ctx, finish) {
    const saved = worksheet(ctx);
    const { baseline, run } = M.RealW4.evidence(ctx);
    const evidence = [];
    const add = (source, value, question, explanation, w, r) => evidence.push({ source, value, question, explanation, w, r });
    const time = (record, duration) => record.period
      ? record.period.day + ' ' + record.period.start + ' ถึง ' + record.period.endDay + ' ' + record.period.end + ' · ' + record.period.duration + ' นาที'
      : (record.slot === 'am' ? '09:00' : '17:00') + ' · ' + duration + ' นาที';
    if (saved.stock) {
      const s = saved.stock, result = stockSummary(s);
      const kind = [...new Set(s.rows.map((row) => row.source))].join(' + ');
      add('ส.3 · ' + kind + ' · ' + periodText(s) + ' · ' + s.id, 'ยอดขาย ' + money(result.sales) + ' · ต้นทุนขาย ' + money(result.cogs) + ' บาท',
        numericField('กำไรขั้นต้นรวม ส.3', (result.sales - result.cogs) / 100, 'บาท'), money(result.sales) + ' − ' + money(result.cogs) + ' = ' + money(result.sales - result.cogs) + ' บาท', 2, 1);
    }
    if (baseline) {
      const summary = baseline.source + ' · ' + time(baseline, baseline.T) + ' · ' + baseline.id;
      add('ส.4 ช่วงปกติ · ' + summary, 'ขาย ' + baseline.N0 + ' หน่วย · ราคา ' + money(baseline.P) + ' · ต้นทุน ' + money(baseline.C) + ' บาท/หน่วย',
        numericField('กำไรขั้นต้นช่วงปกติ ส.4', baseline.G0 / 100, 'บาท'), baseline.N0 + ' × (' + money(baseline.P) + ' − ' + money(baseline.C) + ') = ' + money(baseline.G0) + ' บาท', 3, 0);
    }
    if (run) {
      add('ส.4 ช่วงโปร · ' + run.source + ' · ' + time(run.period ? run : baseline, baseline.T) + ' · ' + run.id,
        run.S + ' ชุด × ' + money(run.B) + ' บาท + ' + run.U + ' เดี่ยว × ' + money(baseline.P) + ' บาท · ต้นทุนขาย ' + money(run.COGS1) + ' · ค่าทำโปร ' + money(run.F) + ' บาท',
        numericField('ผลหลังค่าทำโปร ส.4', run.G1 / 100, 'บาท'), money(run.R1) + ' − ' + money(run.COGS1) + ' − ' + money(run.F) + ' = ' +
        money(run.G1) + ' บาท · ' + (run.kind === 'forecast' ? 'ตามแบบจำลอง: ' : '') + (run.decision || 'หลักฐานยังไม่พอสำหรับสรุปผลโปร'), 3, 2);
    }
    const post = saved.postEvidence || saved.post;
    if (post) {
      const result = rate('อัตราทัก ส.5 (หารด้วยคนเห็น)', post.messages, post.views);
      add('ส.5 · ' + postSource(post) + ' · ' + post.id, postText(post), result.question, result.explanation, 4, 2);
    }
    if (!evidence.length) {
      const original = round.gen({ ...ctx, state: { ...ctx.state, sim: {} } });
      M.engines.calc(el, { ...round, gen: () => ({ ...original, intro: '<p>ชุดฝึกจำลองสำหรับทบทวน เมื่อบันทึกใบงานแล้วจะแสดงหลักฐานของสินค้ากลุ่มนี้</p>' + original.intro, fixed: true }) }, ctx, finish);
      return;
    }
    const links = evidence.map((item, i) => '<li><b>' + esc(item.source) + '</b><br>' + esc(item.value) +
      ' <button type="button" class="btn small ghost" data-evidence-source="' + i + '">ไปรอบต้นทาง</button></li>').join('');
    const work = { id: portfolioId(ctx, 'w8-evidence'), title: 'ตรวจหลักฐานและคำนวณซ้ำ',
      text: evidence.map((item) => item.source + '\n' + item.value + '\n' + item.explanation).join('\n\n') };
    const gen = () => ({ intro: '<ul>' + links + '</ul>', fields: evidence.map((item) => item.question),
      solution: evidence.map((item) => esc(item.explanation)).join('<br>'), portfolio: work, fixed: true });
    M.engines.calc(el, { ...round, gen }, ctx, finish);
    el.querySelectorAll('[data-evidence-source]').forEach((button) => {
      button.onclick = () => {
        const item = evidence[Number(button.dataset.evidenceSource)];
        M.nav.play(item.w, item.r);
      };
    });
  }

  M.RealWorksheets = {
    run(el, round, ctx, finish) {
      if (ctx.week === 7 && ctx.idx === 1) { review(el, round, ctx, finish); return true; }
      // W6R5: โต๊ะอ่านผลประกอบการก่อนคำถามเดิม (ไม่นับดาว) ถ้าโหลดโต๊ะไม่ได้ให้เล่นคำถามเดิมตรง ๆ
      if (ctx.week === 5 && ctx.idx === 4 && M.ReportDesk) { M.ReportDesk.run(el, round, ctx, finish); return true; }
      const inventory = ctx.week === 2 && ctx.idx < 4;
      if (!inventory && !(ctx.week === 4 && ctx.idx === 2)) return false;
      const key = inventory ? 'stock' : 'post';
      const saved = worksheet(ctx)[key];
      el.innerHTML = '<div class="row worksheet-controls">' +
        '<button type="button" class="btn ghost" data-worksheet="sim">เล่นแบบจำลอง</button>' +
        '<button type="button" class="btn ghost" data-worksheet="record">' + (saved ? 'แก้ข้อมูลร้าน' : 'ใช้ข้อมูลร้าน') + '</button>' +
        '<button type="button" class="btn ghost" data-worksheet="saved"' + (saved ? '' : ' hidden') + '>ใช้ชุดที่บันทึก</button></div><div class="worksheet-stage"></div>';
      const stage = $('.worksheet-stage', el);
      const exercise = (record) => inventory ? stockExercise(stage, round, ctx, finish, record) : postExercise(stage, round, ctx, finish, record);
      const sim = () => {
        if (inventory) { M.engines[round.engine](stage, round, ctx, finish); return; }
        const post = ctx.state.sim.post;
        const simPost = post && (!post.productId || post.productId === ctx.product.id);
        const randomize = simPost ? null : () => {
          const views = M.R.int(150, 400), messages = M.R.int(5, 25);
          return { id: State.newId('post'), views, messages, orders: M.R.int(1, messages), kind: simulated };
        };
        postExercise(stage, round, ctx, finish, simPost ? { ...post, id: State.newId('post'), kind: simulated } : null, randomize);
      };
      $('[data-worksheet="sim"]', el).onclick = sim;
      const existingButton = $('[data-worksheet="saved"]', el);
      const recordButton = $('[data-worksheet="record"]', el);
      existingButton.onclick = () => exercise(worksheet(ctx)[key]);
      recordButton.onclick = () => {
        const current = worksheet(ctx)[key];
        const save = (record) => {
          put(ctx, key, record);
          if (!inventory) put(ctx, 'postEvidence', record);
          existingButton.hidden = false;
          recordButton.textContent = 'แก้ข้อมูลร้าน';
          exercise(record);
        };
        if (inventory) stockForm(stage, ctx, current, save);
        else postForm(stage, current, save);
      };
      if (saved) exercise(saved); else sim();
      return true;
    },
    hasReal(pid) {
      const record = State.data.worksheets?.[pid];
      return !!(record?.stock || record?.post);
    },
    drop(pid) {
      const record = State.data.worksheets?.[pid];
      if (record) {
        delete record.stock;
        delete record.post;
        if (record.postEvidence?.kind === actual) delete record.postEvidence;
      }
      if (record?.postEvidence?.kind !== simulated) delete State.data.portfolio['w5-metrics-' + pid];
      for (const id of ['w3-stock', 'w8-evidence']) delete State.data.portfolio[id + '-' + pid];
      State.save();
    },
  };
})();

/* real-w4.js — บันทึกผลจากร้านจริงและเปรียบเทียบโปรตาม GDD §11 */
(function () {
  const M = window.MTL;
  const PM = M.PromoModel;
  const { $, esc, fmt, State } = M;
  const real = 'จริง — ผู้ฝึกบันทึก';
  const calculated = 'คำนวณจากข้อมูลจริง';
  const planned = 'แผน';
  const unknown = 'ไม่ทราบ';
  const insufficient = 'หลักฐานยังไม่พอสำหรับสรุปผลโปร';
  const bt = (satang) => fmt(satang / 100, 2);
  const badge = (text, cls = 'calc') => `<span class="src ${cls}">${text}</span>`;

  const count = (key, label, extra = {}) => ({ key, label, kind: 'count', low: 0, high: 10000, ...extra });
  const money = (key, label, low, high, extra = {}) => ({ key, label, kind: 'money', low, high, ...extra });
  const text = (key, label, extra = {}) => ({ key, label, kind: 'text', ...extra });
  const choose = (key, label, options) => ({ key, label, kind: 'select', options });
  const periodFields = [
    { key: 'day', label: 'วันที่ตามปฏิทินร้าน', kind: 'date' },
    { key: 'start', label: 'เวลาเริ่ม (24 ชั่วโมง)', kind: 'time' },
    count('duration', 'ระยะเวลา (นาที)', { low: 1, high: 120, placeholder: 'เช่น 15' }),
    choose('origin', 'แหล่งข้อมูล', ['บันทึกยอดขายร้าน', 'นับที่ร้าน', 'ใบงานที่ได้รับอนุญาต']),
    text('reference', 'รหัสอ้างอิงที่ไม่ระบุตัวบุคคล', { max: 30, placeholder: 'เช่น OBS-W4-1', pattern: /^[A-Za-z0-9_-]{1,30}$/ }),
    choose('weather', 'อากาศ', [unknown, 'ปกติ', 'ฝนตก', 'อื่น ๆ']),
    choose('supply', 'สินค้าหน้าชั้น', [unknown, 'มีสินค้าตลอด', 'หมดชั่วคราว']),
    choose('competitor', 'โปรของคู่แข่ง', [unknown, 'ไม่มี', 'มีโปร']),
    text('stockNote', 'หมายเหตุสต็อก (ถ้ามีเติมของ ให้ระบุเวลา)', { optional: true, max: 160 }),
    text('note', 'หมายเหตุอื่น (ไม่ใส่ชื่อคนหรือเลขใบเสร็จ)', { optional: true, max: 240 }),
  ];

  function periodAt({ day, start, duration }) {
    const [endDay, endTime] = new Date(Date.parse(`${day}T${start}:00Z`) + duration * 60000).toISOString().split('T');
    return { day, start, duration, endDay, end: endTime.slice(0, 5) };
  }

  function periodText(period) {
    const end = period.endDay !== period.day ? `${period.endDay} ${period.end}` : period.end;
    return `${period.day} ${period.start}–${end} (${period.duration} นาที)`;
  }

  const factorText = (i) => [i.weather, i.supply, i.competitor === unknown ? `คู่แข่ง ${unknown}` : `คู่แข่ง${i.competitor}`, i.stockNote, i.note].filter(Boolean).join(' · ');

  // ฟอร์มบันทึกคนละขั้นกับคำถามคำนวณ ข้อมูลที่ยังตรวจไม่ผ่านจะไม่ถูกเก็บลงเซฟ
  function entry(el, fields, values, action, crosscheck, done) {
    const html = fields.map((f) => {
      const name = esc(f.key), value = values[f.key] ?? '';
      let field;
      if (f.kind === 'select') field = `<select name="${name}" aria-describedby="real-${name}-error"><option value="">— เลือก —</option>${f.options.map((o) => `<option${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      else if (f.kind === 'check') field = `<input type="checkbox" name="${name}" aria-describedby="real-${name}-error"${value ? ' checked' : ''}>`;
      else field = `<input name="${name}" aria-describedby="real-${name}-error" type="${f.kind === 'date' || f.kind === 'time' ? f.kind : 'text'}" value="${esc(f.kind === 'money' && value !== '' ? value / 100 : value)}"${f.kind === 'money' ? ' inputmode="decimal"' : f.kind === 'count' ? ' inputmode="numeric"' : ''}${f.max ? ` maxlength="${f.max}"` : ''} placeholder="${esc(f.placeholder || '')}">`;
      return `<div class="field real-field"><label>${f.kind === 'check' ? `${field} ${esc(f.label)}` : `<span>${esc(f.label)}</span>${field}`}</label><small id="real-${name}-error" class="err" aria-live="polite"></small></div>`;
    }).join('');
    el.innerHTML = `<form class="real-entry" autocomplete="off" novalidate>${html}<div class="row"><button class="btn primary" type="submit">${esc(action)}</button></div></form>`;
    $('.real-entry', el).onsubmit = (event) => {
      event.preventDefault();
      const form = event.currentTarget, data = {}, errors = {};
      fields.forEach((f) => {
        const input = form.elements.namedItem(f.key), raw = input.value.trim();
        const value = f.kind === 'check' ? input.checked : f.kind === 'money' || f.kind === 'count' ? M.readDecimal(raw, f.kind === 'money' ? 2 : 0) : raw;
        data[f.key] = value;
        if (f.kind === 'check') return;
        if (!raw) { if (!f.optional) errors[f.key] = 'กรอกข้อมูลช่องนี้ก่อน'; return; }
        if (f.kind === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(Date.parse(`${raw}T00:00:00Z`)) || new Date(`${raw}T00:00:00Z`).toISOString().slice(0, 10) !== raw)) errors[f.key] = 'เลือกวันที่ตามปฏิทินร้าน';
        if (f.kind === 'time' && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw)) errors[f.key] = 'ใส่เวลาในรูป ชั่วโมง:นาที';
        if (f.kind === 'select' && !f.options.includes(raw)) errors[f.key] = 'เลือกข้อมูลจากรายการ';
        if (f.pattern && !f.pattern.test(raw)) errors[f.key] = 'ใช้ตัวอักษรอังกฤษ ตัวเลข ขีดกลาง หรือขีดล่าง';
        if (typeof f.low === 'number') {
          if (!Number.isSafeInteger(value)) errors[f.key] = f.kind === 'money' ? 'ใส่จำนวนบาท มีทศนิยมได้ไม่เกิน 2 ตำแหน่ง' : 'ใส่จำนวนเต็ม';
          else if (value < f.low || value > f.high) errors[f.key] = `ใส่ค่าระหว่าง ${f.kind === 'money' ? bt(f.low) : fmt(f.low)} ถึง ${f.kind === 'money' ? bt(f.high) : fmt(f.high)}`;
        }
      });
      if (!Object.keys(errors).length && crosscheck) Object.assign(errors, crosscheck(data));
      fields.forEach((f) => {
        const input = form.elements.namedItem(f.key);
        if (errors[f.key]) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
        $(`#real-${f.key}-error`, form).textContent = errors[f.key] || '';
      });
      const firstError = Object.keys(errors)[0];
      if (firstError) form.elements.namedItem(firstError).focus();
      else done(data);
    };
  }

  function exercise(el, intro, fields, label, save, feedback) {
    el.innerHTML = `<div class="calc-intro">${intro}</div><div class="real-exercise"></div>`;
    const box = $('.real-exercise', el);
    M.W4.form(box, fields, (ok, notes) => {
      const out = $('.solution', box);
      out.classList.remove('hidden');
      out.innerHTML = `${notes.length ? `<ul class="diag">${notes.join('')}</ul>` : ''}${feedback}<div class="row"><button class="btn primary save-real">${esc(label)} (${ok}/${fields.length})</button></div>`;
      $('.save-real', out).onclick = (event) => {
        event.currentTarget.disabled = true;
        save(ok / fields.length);
      };
    });
  }

  const problem = (key, label, answer, kind = 'money') => ({ key, label, kind, answer, unit: kind === 'money' ? 'บาท' : 'ชุด', diagnose: () => kind === 'sets' ? showSets(answer) : `คำตอบคือ ${bt(answer)} บาท` });
  const showSets = (n) => n === 'impossible' ? 'ทำไม่ได้ด้วยยอดชุดอย่างเดียว' : `${fmt(n)} ชุด`;
  const portfolioKey = (ctx, step) => `w4-store-${ctx.product.id}-${step}`;
  const withoutPortfolio = (ctx, ...steps) => steps.forEach((step) => { delete ctx.state.portfolio[portfolioKey(ctx, step)]; });
  const storeFor = (ctx) => State.promo(ctx.product.id);
  const sourceMap = (keys, source) => Object.fromEntries(keys.map((key) => [key, source]));
  const realBy = (inputs) => sourceMap(Object.keys(inputs), real);

  function evidence(ctx) {
    const store = ctx.state.sim?.promoV2?.[ctx.product.id];
    const baseline = store?.baseline || null;
    const plan = baseline && store.plan?.baselineId === baseline.id ? store.plan : null;
    const run = plan && store.run?.baselineId === baseline.id && store.run.planId === plan.id ? store.run : null;
    return { baseline, plan, run };
  }

  function pricing(ctx) {
    const { baseline, plan, run } = evidence(ctx);
    const P = baseline?.P ?? PM.satang(ctx.product.promo.price), C = baseline?.C ?? PM.satang(ctx.product.promo.cost);
    if (run?.kind === 'observed') return { P, C, B: run.B, F: run.F, source: real };
    const practicePlan = !baseline && ctx.state.sim?.promoV2?.[ctx.product.id]?.plan;
    const chosenPlan = plan || (practicePlan?.practiceBase && practicePlan);
    if (chosenPlan) return { P, C, B: chosenPlan.B, F: chosenPlan.F, source: planned };
    return { P, C, ...PM.defaults(P, C), source: 'จำลอง' };
  }

  function sayPrice(satang) {
    const whole = Math.floor(satang / 100), rest = satang % 100;
    return `${M.words(whole)} baht${rest ? ` and ${M.words(rest)} satang` : ''}`;
  }

  function baseline(el, ctx, finish, back) {
    const s = storeFor(ctx), previous = s.baseline?.source === real ? s.baseline.inputs : {};
    const unit = ctx.product.unit;
    const fields = [
      money('P', `ราคาปกติ (บาท/${unit})`, 1, 1000000, { placeholder: 'เช่น 18.75' }),
      money('C', `ต้นทุน (บาท/${unit})`, 0, 1000000),
      count('N0', `จำนวนที่ขาย (${unit})`),
      count('K0', `พร้อมขายทั้งหมด (${unit}, เว้นว่างได้)`, { optional: true }),
      ...periodFields,
    ];
    el.innerHTML = `<div class="calc-intro"><b>จดยอดปกติจากร้าน · ${esc(ctx.product.th)}</b> ${badge(real)}<br>ใช้หน่วย ${esc(unit)} เดิมทั้งสองช่วง เก็บข้อมูลเท่าที่ได้รับอนุญาต โดยไม่ใส่ชื่อคนหรือเลขใบเสร็จ</div><div class="real-inputs"></div><div class="row"><button class="btn ghost switch-sim">กลับไปเลือกโหมด</button></div>`;
    $('.switch-sim', el).onclick = back;
    entry($('.real-inputs', el), fields, previous, 'ตรวจข้อมูลและเริ่มคำนวณ', (i) => i.K0 !== null && i.N0 > i.K0 ? { N0: 'จำนวนขายต้องไม่เกินจำนวนพร้อมขาย' } : {}, (i) => {
      const period = periodAt(i), { P, C, N0, K0 } = i;
      const R0 = N0 * P, COGS0 = N0 * C, G0 = R0 - COGS0;
      const snapshot = {
        id: State.newId('base'), version: 2, source: real, period, inputs: i,
        sourceByField: { ...realBy(i), ...sourceMap(['R0', 'COGS0', 'G0'], calculated) },
        seed: 1 + Math.floor(Math.random() * 2147483645), T: period.duration,
        slot: Number(period.start.slice(0, 2)) < 12 ? 'am' : 'pm', P, C, N0, K0, R0, COGS0, G0, at: Date.now(),
      };
      const intro = `<b>${esc(periodText(period))}</b> ${badge(real)} · ขาย ${fmt(N0)} ${esc(unit)}<br>ราคา ${bt(P)} · ต้นทุน ${bt(C)} บาท/${esc(unit)} · พร้อมขาย ${K0 === null ? unknown : fmt(K0)}<br>แหล่งข้อมูล ${esc(i.origin)} · รหัส ${esc(i.reference)}<br>${esc(factorText(i))}${C >= P ? '<br><span class="warn">ส่วนต่างปกติต่อหน่วยเป็นศูนย์หรือติดลบ</span>' : ''}`;
      exercise(el, intro, [problem('r0', 'ยอดขาย = จำนวน × ราคา', R0), problem('c0', 'ต้นทุนขาย = จำนวน × ทุน', COGS0), problem('g0', 'กำไรขั้นต้น = ยอดขาย − ต้นทุนขาย', G0)], 'บันทึกยอดปกติ', (score) => {
        if (s.baseline || s.plan || s.run) s.history.push({ baseline: s.baseline, plan: s.plan, run: s.run });
        Object.assign(s, { id: snapshot.id, period, inputs: i, sourceByField: snapshot.sourceByField, seed: snapshot.seed, baseline: snapshot, plan: null, run: null });
        withoutPortfolio(ctx, 'plan', 'run');
        State.addPortfolio(portfolioKey(ctx, 'base'), 4, 'ยอดปกติจากร้าน',
          `[${real}] ${ctx.product.th} · ${periodText(period)} · ${i.origin} (${i.reference})\nขาย ${fmt(N0)} ${unit} · ราคา ${bt(P)} · ต้นทุน ${bt(C)} บาท/${unit}\n[${calculated}] ยอดขาย ${bt(R0)} · ต้นทุนขาย ${bt(COGS0)} · กำไรขั้นต้น ${bt(G0)} บาท\n${factorText(i)}\nอ้างฐาน ${snapshot.id}`);
        finish(score, `บันทึกยอดปกติจากร้าน · กำไรขั้นต้น ${bt(G0)} บาท`);
      }, `<p>ยอดขาย = ${fmt(N0)} × ${bt(P)} = ${bt(R0)} บาท · ต้นทุนขาย = ${fmt(N0)} × ${bt(C)} = ${bt(COGS0)} บาท<br>G0 = ${bt(R0)} − ${bt(COGS0)} = <b>${bt(G0)} บาท</b> ${badge(calculated)}</p>`);
    });
  }

  function plan(el, ctx, finish) {
    const s = storeFor(ctx), b = s.baseline;
    const { P, C, G0 } = b;
    const previous = s.plan?.baselineId === b.id ? s.plan : PM.defaults(P, C);
    const fields = [money('B', 'ราคาชุด 2 หน่วย (บาท)', 1, 2 * P), money('F', 'ค่าทำโปรที่วางไว้ (บาท)', 0, 10000000), count('K1', 'สต็อกเปิดช่วงที่วางไว้ (เว้นว่างได้)', { optional: true })];
    el.innerHTML = `<div class="calc-intro"><b>วางแผนโปรจากยอดปกติของร้าน</b> ${badge(planned, 'plan')}<br>ราคา ${bt(P)} · ต้นทุน ${bt(C)} บาท/${esc(ctx.product.unit)} · G0 = ${bt(G0)} บาท ${badge(calculated)}<br>${esc(periodText(b.period))} · อ้างฐาน ${esc(b.id)}</div><div class="real-inputs"></div>`;
    entry($('.real-inputs', el), fields, previous, 'ล็อกราคาและเริ่มคำนวณ', null, ({ B, F, K1 }) => {
      const v = PM.plan({ P, C, B, F, G0, K1 });
      const warning = v.M <= 0 ? 'ส่วนต่างต่อชุดเป็นศูนย์หรือติดลบ' : v.coverStockShort || v.matchStockShort ? 'สต็อกที่วางไว้อาจไม่พอถึงเป้าหมาย' : '';
      exercise(el, `<b>โปร 2 หน่วย ${bt(B)} บาท · ค่าทำโปร ${bt(F)} บาท</b> ${badge(planned, 'plan')}<br>ต้นทุนต่อชุด = 2 × ${bt(C)} บาท · กำไรขั้นต้นช่วงปกติ ${bt(G0)} บาท ${badge(calculated)}${warning ? `<br><span class="warn">${warning}</span>` : ''}`, [
        problem('margin', 'ส่วนต่างต่อชุด = ราคาชุด − 2 × ต้นทุน', v.M),
        problem('cover', 'จำนวนชุดที่พอคืนค่าทำโปร (F)', v.cover, 'sets'),
        problem('match', 'จำนวนชุดที่ผลหลังค่าทำโปรเท่าหรือเกินช่วงปกติ (G0 + F)', v.match, 'sets'),
      ], 'บันทึกแผน', (score) => {
        s.plan = { id: State.newId('plan'), baselineId: b.id, source: planned, B, F, K1, ...v, sourceByField: sourceMap(['B', 'F', 'K1'], planned), at: Date.now() };
        s.run = null;
        withoutPortfolio(ctx, 'run');
        State.addPortfolio(portfolioKey(ctx, 'plan'), 4, 'แผนโปรจากยอดจริง',
          `[${planned}] โปร 2 หน่วย ${bt(B)} บาท · ค่าทำโปร ${bt(F)} บาท · สต็อกเปิดช่วง ${K1 === null ? unknown : fmt(K1)}\nส่วนต่าง ${bt(v.M)} บาท/ชุด · คืนค่าทำโปร ${showSets(v.cover)} · เท่าช่วงปกติ ${showSets(v.match)}\nอ้างฐาน ${b.id} · รหัสแผน ${s.plan.id}`);
        finish(score, `บันทึกแผนโปร 2 หน่วย ${bt(B)} บาท`);
      }, `<p>ส่วนต่างต่อชุด = ${bt(B)} − 2 × ${bt(C)} = <b>${bt(v.M)} บาท</b><br>เป้าคืนค่าทำโปร ${bt(F)} บาท ใช้ <b>${showSets(v.cover)}</b><br>เป้าเท่าช่วงปกติ ${bt(G0)} + ${bt(F)} บาท ใช้ <b>${showSets(v.match)}</b></p>`);
    });
  }

  function comparable(base, inputs) {
    return inputs.matches && base.period.duration === inputs.duration && base.period.start === inputs.start &&
      ['weather', 'supply', 'competitor'].every((key) => base.inputs[key] !== unknown && base.inputs[key] === inputs[key]);
  }

  function compare(el, ctx, finish, b, p, d) {
    const store = storeFor(ctx), forecast = d.kind === 'forecast';
    const v = PM.evaluate({ ...d, P: b.P, C: b.C, N0: b.N0 });
    const usable = forecast || comparable(b, d.inputs);
    const verdict = usable ? v.decision : insufficient;
    const caption = forecast ? 'ผลโปรจำลอง' : 'ผลโปรจริง';
    const decisionText = forecast ? `${verdict} ตามแบบจำลอง` : verdict;
    const simNotes = `อากาศปกติ · สต็อกเปิดช่วง ${fmt(d.K1)}${p.K1 === null ? ' หน่วย (สมมติ 60 หน่วยต่อ 30 นาที)' : ' หน่วยตามแผน'} · seed ${b.seed}`;
    const promoLabel = forecast ? 'จำลอง' : real;
    const expenseLabel = forecast ? planned : real;
    const note = forecast ? simNotes : `${d.inputs.origin} (${d.inputs.reference}) · ${factorText(d.inputs)}${d.inputs.changeReason ? ` · เหตุผลที่ต่างจากแผน: ${d.inputs.changeReason}` : ''}`;
    const rows = [
      { label: 'ยอดขาย', a: v.R0, b: v.R1 },
      { label: 'ต้นทุนขาย', a: v.COGS0, b: v.COGS1 },
      { label: 'ค่าทำโปร', a: 0, b: d.F },
      { label: 'ผลหลังค่าใช้จ่าย', a: v.G0, b: v.G1 },
    ];
    const intro = `<b>เปรียบเทียบยอดปกติจริงกับ${caption}</b><br>ปกติ ${esc(periodText(b.period))} ${badge(real)} · ขาย ${fmt(b.N0)} ${esc(ctx.product.unit)}<br>ช่วงโปร ${esc(periodText(d.period))} ${badge(promoLabel, forecast ? 'sim' : 'calc')} · ขาย ${fmt(d.S)} ชุดและ ${fmt(d.U)} หน่วยเดี่ยว<br>ราคาชุด ${bt(d.B)} บาท · ค่าทำโปร ${bt(d.F)} บาท ${badge(expenseLabel, forecast ? 'plan' : 'calc')}<br>ยอดขายปกติ ${bt(v.R0)} · ต้นทุนปกติ ${bt(v.COGS0)} · ผลปกติ ${bt(v.G0)} บาท ${badge(calculated)}<br>ยอดขายช่วงโปร ${bt(v.R1)} บาท ${badge(forecast ? 'จำลอง' : calculated, forecast ? 'sim' : 'calc')}<br>${esc(note)}`;
    const questions = [problem('c1', 'ต้นทุนขายช่วงโปร = (2 × จำนวนชุด + หน่วยเดี่ยว) × ทุน', v.COGS1), problem('g1', 'ผลหลังค่าทำโปร = ยอดขาย − ต้นทุนขาย − ค่าทำโปร', v.G1),
      { key: 'dec', label: 'สรุปจากหลักฐานที่มี', kind: 'choice', options: ['ทำต่อ', 'ปรับ', 'หยุด', insufficient], answer: verdict, diagnose: () => usable ? `ผลช่วงโปร ${bt(v.G1)} บาท · ผลต่างจากปกติ ${bt(v.delta)} บาท → ${decisionText}` : `${insufficient} เพราะต้องตรวจเวลา สภาพอากาศ สินค้า และคู่แข่งให้เทียบกันได้` }];
    const feedback = `${M.W4.chart(rows, 'ยอดปกติจริง', caption, `ผลปกติ ${calculated} · ผลโปร ${forecast ? 'จำลอง' : calculated}`)}<p>G1 = ${bt(v.R1)} − ${bt(v.COGS1)} − ${bt(d.F)} = <b>${bt(v.G1)} บาท</b><br>G1 − G0 = ${bt(v.delta)} บาท · <b>${esc(decisionText)}</b></p><label class="ws">สิ่งที่ควรเก็บเพิ่ม (เว้นว่างได้)<textarea class="real-followup" rows="2" maxlength="240"></textarea></label>`;
    exercise(el, intro, questions, 'บันทึกผลเทียบ', (score) => {
      const followup = $('.real-followup', el).value.trim();
      store.run = {
        id: State.newId('run'), baselineId: b.id, planId: p.id, source: promoLabel, ...d, ...v, decision: usable ? v.decision : null,
        comparable: usable && !forecast, followup, sourceByField: {
          ...(forecast ? sourceMap(['S', 'U', 'K1'], promoLabel) : realBy(d.inputs)),
          ...sourceMap(['B', 'F'], expenseLabel), ...sourceMap(['R1', 'COGS1', 'G1'], forecast ? 'จำลอง' : calculated),
        }, at: Date.now(),
      };
      State.addPortfolio(portfolioKey(ctx, 'run'), 4, `เทียบยอดปกติจริงกับ${caption}`,
        `[${real}] ${periodText(b.period)} · ${b.inputs.origin} (${b.inputs.reference}) · ขาย ${fmt(b.N0)} ${ctx.product.unit}\n[${calculated}] ยอดขาย ${bt(v.R0)} · ต้นทุนขาย ${bt(v.COGS0)} · G0 ${bt(v.G0)} บาท\n[${promoLabel}] ${periodText(d.period)} · ${fmt(d.S)} ชุด + ${fmt(d.U)} หน่วยเดี่ยว · ชุดละ ${bt(d.B)} บาท\n[${forecast ? 'จำลอง' : calculated}] ยอดขาย ${bt(v.R1)} · ต้นทุนขาย ${bt(v.COGS1)} · ค่าทำโปร ${bt(d.F)} [${expenseLabel}] · G1 ${bt(v.G1)} บาท\nผลต่าง ${bt(v.delta)} บาท · ${decisionText}\n${note}${followup ? `\nเก็บเพิ่ม: ${followup}` : ''}\nอ้างฐาน ${b.id} · แผน ${p.id} · ผล ${store.run.id}`);
      finish(score, `ผลช่วงโปร ${bt(v.G1)} บาท เทียบปกติ ${bt(v.G0)} บาท · ${decisionText}`);
    }, feedback);
  }

  function run(el, ctx, finish) {
    const { baseline: b, plan: p } = evidence(ctx);
    if (!p) {
      el.innerHTML = '<div class="calc-intro">ยอดปกติชุดล่าสุดยังไม่มีแผนโปร คำนวณและบันทึกแผนก่อนเปรียบเทียบผล</div><button class="btn primary to-plan">ไปรอบ 2 ออกแบบโปร →</button>';
      $('.to-plan', el).onclick = () => M.nav.play(ctx.week, 1);
      return;
    }
    el.innerHTML = `<div class="calc-intro"><b>เลือกผลช่วงโปร</b><br>ยอดปกติจริง ${esc(periodText(b.period))} · โปรตามแผน ${bt(p.B)} บาท/ชุด · ค่าทำโปร ${bt(p.F)} บาท</div><div class="row"><button class="btn primary actual-run">กรอกผลที่ทดลองจริง</button><button class="btn forecast-run">สร้างผลคาดการณ์</button></div><div class="real-inputs"></div>`;
    $('.forecast-run', el).onclick = () => {
      const K1 = p.K1 ?? Math.round((60 * b.T) / 30);
      const result = PM.simulatePair({ seed: b.seed, P: b.P, C: b.C, B: p.B, T: b.T, K0: b.K0 ?? K1, K1, slot: b.slot, event: 'none' }).promo;
      compare(el, ctx, finish, b, p, { kind: 'forecast', period: b.period, B: p.B, F: p.F, K1, S: result.S, U: result.U, seed: b.seed });
    };
    $('.actual-run', el).onclick = () => {
      const fields = [
        money('B', 'ราคาชุดจริง (บาท)', 1, 2 * b.P), money('F', 'ค่าทำโปรจริง (บาท)', 0, 10000000),
        count('S', 'จำนวนชุด 2 หน่วยที่ขาย'), count('U', 'จำนวนหน่วยเดี่ยวที่ขาย'),
        count('K1', 'พร้อมขายทั้งหมด (เว้นว่างได้)', { optional: true }), ...periodFields,
        text('changeReason', 'เหตุผลที่ราคา/ค่าทำโปรต่างจากแผน (ถ้ามี)', { optional: true, max: 160 }),
        { key: 'matches', label: 'ตรวจแล้วว่าสินค้า ราคาต่อหน่วย ต้นทุนต่อหน่วย และปัจจัยอื่นเทียบกับช่วงปกติได้', kind: 'check' },
      ];
      const previous = evidence(ctx).run;
      const values = previous?.kind === 'observed' ? previous.inputs : { start: b.period.start, duration: b.period.duration, B: p.B, F: p.F };
      entry($('.real-inputs', el), fields, values, 'ตรวจข้อมูลและเปรียบเทียบผล', (i) => {
        const errors = {};
        if (i.K1 !== null && 2 * i.S + i.U > i.K1) errors.K1 = 'จำนวนพร้อมขายต้องไม่น้อยกว่า 2 × จำนวนชุด + หน่วยเดี่ยว';
        if ((p.B !== i.B || p.F !== i.F) && !i.changeReason) errors.changeReason = 'ระบุเหตุผลที่ต่างจากแผนก่อน';
        return errors;
      }, (i) => compare(el, ctx, finish, b, p, { kind: 'observed', period: periodAt(i), inputs: i, B: i.B, F: i.F, K1: i.K1, S: i.S, U: i.U }));
    };
  }

  function hasReal(pid) {
    const store = State.data.sim?.promoV2?.[pid];
    return Boolean(store?.baseline?.source === real || store?.history?.some((item) => item.baseline?.source === real));
  }

  function drop(pid) {
    if (!hasReal(pid)) return false;
    const store = State.data.sim.promoV2[pid];
    if (store.baseline?.source === real) {
      Object.assign(store, { baseline: null, plan: null, run: null });
      for (const key of ['id', 'period', 'inputs', 'sourceByField', 'seed']) delete store[key];
    }
    store.history = (store.history || []).filter((item) => item.baseline?.source !== real);
    withoutPortfolio({ product: { id: pid }, state: State.data }, 'base', 'plan', 'run');
    State.save();
    return true;
  }

  M.RealW4 = { baseline, plan, run, evidence, pricing, sayPrice, hasReal, drop, periodAt, comparable, real };
})();

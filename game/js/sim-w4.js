/*
 * sim-w4.js — ต้นแบบสัปดาห์ 4: baseline → plan → run (Claude)
 * ตาม docs/GDD.md §5 (โมเดล) และ §11 (การเก็บ promoV2 และป้ายที่มา)
 * แทนที่ E.sim เดิมของ v0.1 · ยังเขียนค่า sim.baseline/plan/run แบบเดิมไว้ให้รอบ W4R4 และ W8 ใช้ต่อ
 */
(function () {
  const M = window.MTL;
  const { esc, fmt, $, $$, sfx, State } = M;
  const PM = M.PromoModel;
  const T = 30, K = 60;
  // กลุ่มลูกค้าในโมเดล §5 → ภาพ Blender (docs/ART_SPEC.md)
  const GROUP_SPRITE = { rush: 'customer_1', home: 'customer_2', student: 'customer_3', compare: 'customer_4' };

  // ---------- ตัวช่วยเงิน (สตางค์) ----------
  const bt = (s) => fmt(s / 100, 2);                       // สตางค์ → "18.75"
  const THAI = '๐๑๒๓๔๕๖๗๘๙';
  const norm = (v) => String(v ?? '').trim().replace(/[๐-๙]/g, (c) => THAI.indexOf(c)).replace(/[,\s]/g, '').replace(/[−–]/g, '-');
  const parseMoney = (v) => { const s = norm(v); return /^-?\d+(\.\d{1,2})?$/.test(s) ? Math.round(parseFloat(s) * 100) : NaN; };
  const parseInt0 = (v) => { const s = norm(v); return /^-?\d+$/.test(s) ? parseInt(s, 10) : NaN; };
  const LBL = { sim: '<span class="src sim">จำลอง</span>', plan: '<span class="src plan">แผน</span>', calc: '<span class="src calc">คำนวณ</span>' };

  const productMoney = (ctx) => {
    const p = ctx.product.promo;
    const P = PM.satang(p.price), C = PM.satang(p.cost);
    return { p, P, C, ...PM.defaults(P, C) };
  };

  // ---------- กราฟแท่งเทียบสองช่วง (สเกลเดียวกัน แสดงค่าติดลบได้) ----------
  function chart(rows, normalName = 'ช่วงปกติ', promoName = 'ช่วงโปร', sources) {
    // rows: [{label, a, b}] สตางค์ · a = ช่วงปกติ, b = ช่วงโปร
    const vals = rows.flatMap((r) => [r.a, r.b]);
    const max = Math.max(0, ...vals), min = Math.min(0, ...vals), span = max - min || 1;
    const W = 640, H = 260, top = 24, bot = 54, left = 8, h = H - top - bot;
    const y = (v) => top + ((max - v) / span) * h;
    const gw = (W - left * 2) / rows.length, bw = Math.min(46, gw / 3);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟเทียบช่วงปกติกับช่วงโปร หน่วยบาท">`;
    s += `<line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="#2a2622" stroke-width="1.5"/>`;
    rows.forEach((r, i) => {
      const cx = left + gw * i + gw / 2;
      [[r.a, 'a', -1], [r.b, 'b', 1]].forEach(([v, cls, side]) => {
        if (v == null) return;
        const x = cx + (side < 0 ? -bw - 3 : 3), y0 = y(Math.max(0, v)), hh = Math.max(1, Math.abs(y(v) - y(0)));
        s += `<rect class="bar ${cls}" x="${x}" y="${y0}" width="${bw}" height="${hh}" rx="3"/>`;
        s += `<text x="${x + bw / 2}" y="${v >= 0 ? y0 - 5 : y0 + hh + 14}" text-anchor="middle" class="v">${bt(v)}</text>`;
      });
      s += `<text x="${cx}" y="${H - bot + 34}" text-anchor="middle" class="l">${esc(r.label)}</text>`;
    });
    s += `</svg><div class="legend"><span><i class="a"></i>${esc(normalName)}</span><span><i class="b"></i>${esc(promoName)}</span><span class="muted">หน่วย: บาท · ${sources ? esc(sources) : `${LBL.sim} ค่าจากเกม`}</span></div>`;
    return s;
  }

  // ---------- ฟอร์มตรวจคำตอบ พร้อมวินิจฉัยเมื่อผิด ----------
  // field: { key, label, unit, kind:'money'|'int'|'sets'|'choice', answer, options?, diagnose?(value)->string }
  function form(el, fields, onDone) {
    el.innerHTML = `<form class="calc-form" autocomplete="off" novalidate>${fields.map((f) => `
      <div class="field w4"><label for="w4-${f.key}">${f.label}</label>
        ${f.kind === 'choice'
          ? `<select name="${f.key}" id="w4-${f.key}" aria-describedby="w4-${f.key}-error"><option value="">— เลือก —</option>${f.options.map((o) => `<option>${esc(o)}</option>`).join('')}</select><em></em>`
          : `<input name="${f.key}" id="w4-${f.key}" aria-describedby="w4-${f.key}-error" inputmode="${f.kind === 'money' ? 'decimal' : 'numeric'}" placeholder="0"><em>${f.unit || ''}</em>`}
        <b class="mark"></b>
        ${f.kind === 'sets' ? `<label class="imp"><input type="checkbox" name="${f.key}_imp"> ทำไม่ได้ด้วยยอดชุดอย่างเดียว</label>` : ''}
        <small class="err" id="w4-${f.key}-error" aria-live="polite"></small></div>`).join('')}
      <div class="row"><button class="btn primary chk">ตรวจคำตอบ</button></div></form><div class="solution hidden"></div>`;
    const fm = $('form', el);
    fm.onsubmit = (e) => {
      e.preventDefault();
      // ตรวจรูปแบบก่อน (ไม่นับเป็นคำตอบผิด)
      let bad = false;
      fields.forEach((f) => {
        const inp = fm[f.key], v = inp.value, er = inp.closest('.field').querySelector('.err');
        er.textContent = '';
        if (f.kind === 'sets' && fm[`${f.key}_imp`].checked) return;
        if (f.kind === 'choice') { if (!v) { er.textContent = 'เลือกคำตอบก่อน'; bad = true; } return; }
        if (norm(v) === '') { er.textContent = 'ยังไม่ได้กรอก'; bad = true; return; }
        const n = f.kind === 'money' ? parseMoney(v) : parseInt0(v);
        if (!Number.isFinite(n)) { er.textContent = f.kind === 'money' ? 'ใส่ตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง' : 'ใส่จำนวนเต็ม'; bad = true; }
      });
      if (bad) { sfx.play('wrong'); return; }
      let ok = 0; const notes = [];
      fields.forEach((f) => {
        const inp = fm[f.key], fld = inp.closest('.field');
        let given, good;
        if (f.kind === 'choice') { given = inp.value; good = given === f.answer; }
        else if (f.kind === 'sets') {
          const imp = fm[`${f.key}_imp`].checked;
          given = imp ? 'impossible' : parseInt0(inp.value);
          good = given === f.answer;
          fm[`${f.key}_imp`].disabled = true;
        } else { given = f.kind === 'money' ? parseMoney(inp.value) : parseInt0(inp.value); good = given === f.answer; }
        if (good) ok++;
        else notes.push(`<li><b>${f.label}</b> — ${f.diagnose ? f.diagnose(given) : 'ลองดูสูตรด้านล่างอีกครั้ง'}</li>`);
        inp.disabled = true;
        fld.querySelector('.mark').textContent = good ? '✅' : '❌';
        fld.classList.add(good ? 'ok' : 'no');
      });
      $('.chk', el).disabled = true;
      sfx.play(ok === fields.length ? 'correct' : ok ? 'note' : 'wrong');
      onDone(ok, notes);
    };
  }

  // ---------- ฉากจำลอง 30 นาที ----------
  function play(el, ctx, pair, isPromo, B, onEnd) {
    const run = isPromo ? pair.promo : pair.normal;
    const ev = PM.EVENTS[pair.event];
    const start = pair.slot === 'am' ? 9 * 60 : 17 * 60;
    const label = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    el.innerHTML = `<div class="hud">
        <div class="stat">ช่วง<b>${isPromo ? 'ทดลองโปร' : 'ปกติ'} ${label(start)}–${label(start + T)}</b></div>
        <div class="stat">ลูกค้าเข้า<b class="c1">0</b></div>
        <div class="stat">ขาย (ชิ้น)<b class="c2">0</b></div>
        ${isPromo ? '<div class="stat">ชุดโปร<b class="c3">0</b></div>' : ''}
        <div class="stat">ยอดขาย<b class="c4">0 ฿</b></div>
        <div class="stat">สต็อก<b class="c5">${isPromo ? pair.K1 : pair.K0}</b></div>
        <div class="stat ev">ปัจจัยอื่น<b>${ev.icon} ${ev.th}</b></div></div>
      <div class="scene-wrap"><canvas></canvas></div>
      <div class="row"><button class="btn primary go">▶ เริ่มจำลอง ${T} นาที</button><button class="btn ghost skip" disabled>⏩ ข้ามไปดูผล</button>
      <span class="muted">${LBL.sim} ลูกค้าชุดเดียวกันทั้งสองช่วง (seed ${pair.seed})</span></div>`;
    const outLo = Math.floor(T / 3), outHi = Math.ceil((2 * T) / 3);
    let minute = 0, idx = 0, units = 0, sets = 0, sales = 0, entered = 0, stock = isPromo ? pair.K1 : pair.K0, timer, finished = false;
    const signText = () => (pair.event === 'shelfOut' && minute >= outLo && minute < outHi ? 'ของหน้าชั้นหมดชั่วคราว' : isPromo ? `โปร 2 ชิ้น ${bt(B)} บาท` : null);
    const scene = new M.StoreScene($('canvas', el), {
      product: ctx.product, minutesPerSec: 0, startMinute: start, speedMul: 1.8,
      sign: signText(),
      overlay: (g, W, H) => {
        if (pair.event !== 'rain') return;
        g.strokeStyle = 'rgba(80,120,200,.35)'; g.lineWidth = 2;
        for (let k = 0; k < 40; k++) { const x = (k * 53 + performance.now() / 4) % W, y = (k * 97 + performance.now() / 2) % H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 6, y + 16); g.stroke(); }
      },
      onArrive: (c, step) => {
        if (step !== 2 || !c.data.r) return;
        const r = c.data.r, u = r.sets * 2 + r.singles;
        if (u) {
          const amt = r.sets * B + r.singles * pair.P;
          units += u; sets += r.sets; sales += amt; stock -= u;
          scene.float(c.x, c.y, `+${bt(amt)}฿`); sfx.play('coin');
        } else scene.float(c.x, c.y, r.note === 'shelfOut' ? 'ไม่มีของหน้าชั้น' : r.wanted ? 'ของไม่พอ' : 'ไม่ซื้อ', '#999');
        paint();
      },
    });
    const paint = () => {
      $('.c1', el).textContent = entered; $('.c2', el).textContent = units;
      if (isPromo) $('.c3', el).textContent = sets;
      $('.c4', el).textContent = bt(sales) + ' ฿'; $('.c5', el).textContent = stock;
    };
    scene.draw();
    const end = () => {
      if (finished) return; finished = true;
      clearInterval(timer); scene.stop(); M.sfx.stopBgm();
      // ใช้ผลจากโมเดลเป็นหลัก (แอนิเมชันอ่านผลเดียวกัน) — กันกรณีกดข้าม
      units = run.N; sets = run.S; sales = run.S * B + run.U * pair.P; entered = run.customers; stock = run.stockLeft; paint();
      $('.go', el).disabled = true; $('.skip', el).disabled = true;
      sfx.play('levelup'); onEnd();
    };
    M.onLeave = () => { finished = true; scene.stop(); clearInterval(timer); M.sfx.stopBgm(); };
    $('.go', el).onclick = (e) => {
      e.target.disabled = true; $('.skip', el).disabled = false; sfx.play(pair.event === 'rain' ? 'rain' : 'click'); scene.start(); M.sfx.startBgm();
      const msPerMin = 600;
      timer = setInterval(() => {
        scene.clock = start + minute; scene.sign = signText();
        while (idx < run.sales.length && run.sales[idx].minute <= minute) {
          const rec = run.sales[idx++];
          scene.spawn({ r: rec, sprite: GROUP_SPRITE[rec.group], shelfWait: 0.4, counterWait: 0.3 }); entered++; paint();
        }
        minute++;
        if (minute > T && scene.customers.length === 0) end();
      }, msPerMin);
    };
    $('.skip', el).onclick = end;
  }

  const factorText = (pair, run) => {
    const ev = PM.EVENTS[pair.event];
    const bits = [`${ev.icon} ${ev.th}`];
    if (run.lostEvent) bits.push(`ขายไม่ได้เพราะเหตุการณ์ ${run.lostEvent} ชิ้น`);
    if (run.lostStock) bits.push(`ขอแต่สต็อกไม่พอ ${run.lostStock} ชิ้น`);
    if (run.shortBundle) bits.push(`ชุดโปรมีของไม่พอ ${run.shortBundle} ครั้ง`);
    return bits.join(' · ');
  };

  const worksheet = (el, id, prompt) => {
    el.insertAdjacentHTML('beforeend', `<label class="ws"><b>📝 ใบงาน (ไม่นับคะแนน)</b> ${prompt}<textarea rows="3" maxlength="600" class="wsText" placeholder="เช่น ฝนตกช่วงทดลอง ควรลองซ้ำวันที่อากาศเหมือนกัน"></textarea></label>`);
    return () => ($('.wsText', el) || {}).value?.trim() || '';
  };

  const finishBtn = (el, label, cb) => {
    el.insertAdjacentHTML('beforeend', `<div class="row"><button class="btn primary sv">${label}</button></div>`);
    $('.sv', el).onclick = cb;
  };

  // ================= รอบ 1 baseline =================
  function baseline(el, round, ctx, finish) {
    const pm = productMoney(ctx), store = State.promo(ctx.product.id);
    const seed = 1 + Math.floor(Math.random() * 2147483645);
    const slot = Math.random() < 0.5 ? 'am' : 'pm';
    const pair = PM.simulatePair({ seed, P: pm.P, C: pm.C, B: null, T, K0: K, K1: K, slot });
    const r = pair.normal;
    el.innerHTML = `<div class="calc-intro"><b>${esc(pm.p.name)}</b> ราคาปกติ ${bt(pm.P)} บาท/${ctx.product.unit} · ต้นทุน ${bt(pm.C)} บาท/${ctx.product.unit} · สต็อกเปิดช่วง ${K} ${ctx.product.unit} ${LBL.sim}<br>
      <span class="muted">จดให้ครบ: วัน เวลา ระยะเวลา ราคา ทุน และเหตุการณ์ — ตัวเลขที่ไม่มีเวลากำกับเทียบกับช่วงโปรไม่ได้</span></div><div class="scn"></div><div class="after"></div>`;
    play($('.scn', el), ctx, pair, false, 0, () => {
      const R0 = r.N * pm.P, COGS0 = r.N * pm.C, G0 = R0 - COGS0;
      const after = $('.after', el);
      after.innerHTML = `<div class="calc-intro"><b>บันทึกช่วงปกติ</b> ${LBL.sim}<table>
        <tr><th>ช่วงเวลา</th><td>${pair.slot === 'am' ? '09:00–09:30' : '17:00–17:30'} (${T} นาที)</td></tr>
        <tr><th>ขายได้</th><td><b>${r.N}</b> ${ctx.product.unit} จากลูกค้า ${r.customers} คน</td></tr>
        <tr><th>ปัจจัยอื่น</th><td>${factorText(pair, r)}</td></tr></table></div><div class="fm"></div>`;
      form($('.fm', after), [
        { key: 'r0', label: 'ยอดขาย = จำนวน × ราคา', unit: 'บาท', kind: 'money', answer: R0,
          diagnose: (v) => v === COGS0 ? `นี่คือต้นทุนขาย ยอดขายใช้ราคาขาย ${bt(pm.P)} บาท` : v === G0 ? 'นี่คือกำไรขั้นต้น ยอดขายยังไม่หักอะไร' : `${r.N} × ${bt(pm.P)} = ${bt(R0)} บาท` },
        { key: 'c0', label: 'ต้นทุนขาย = จำนวน × ทุน', unit: 'บาท', kind: 'money', answer: COGS0,
          diagnose: (v) => v === R0 ? `ใช้ราคาขายแทนทุน ทุนต่อชิ้นคือ ${bt(pm.C)} บาท` : v === K * pm.C ? 'คิดจากสต็อกทั้งหมด ต้นทุนขายนับเฉพาะชิ้นที่ขายได้' : `${r.N} × ${bt(pm.C)} = ${bt(COGS0)} บาท` },
        { key: 'g0', label: 'กำไรขั้นต้นช่วงปกติ (G0)', unit: 'บาท', kind: 'money', answer: G0,
          diagnose: (v) => v === R0 ? 'ยังไม่หักต้นทุนขาย' : `${r.N} × (${bt(pm.P)} − ${bt(pm.C)}) = ${bt(G0)} บาท` },
      ], (ok, notes) => {
        const sol = $('.solution', after); sol.classList.remove('hidden');
        sol.innerHTML = `${notes.length ? `<ul class="diag">${notes.join('')}</ul>` : ''}<b>วิธีคิด</b> ${r.N} × ${bt(pm.P)} = <b>${bt(R0)}</b> · ${r.N} × ${bt(pm.C)} = <b>${bt(COGS0)}</b> · G0 = <b>${bt(G0)}</b> บาท`;
        const getWs = worksheet(sol, 'w4r1', 'ปัจจัยอื่นที่เห็นในช่วงนี้ และถ้าเก็บที่ร้านจริงจะจดอะไรเพิ่ม');
        finishBtn(sol, `บันทึกยอดปกติ (${ok}/3)`, () => {
          const rec = { id: State.newId('base'), version: 2, source: 'จำลอง', seed, slot, event: pair.event, T, K0: K, P: pm.P, C: pm.C,
            N0: r.N, R0, COGS0, G0, customers: r.customers, lostEvent: r.lostEvent, note: getWs(), at: Date.now() };
          if (store.baseline || store.plan || store.run) store.history.push({ baseline: store.baseline, plan: store.plan, run: store.run });
          store.baseline = rec; store.plan = null; store.run = null;
          // ข้อมูลกำกับของฐานจริงอยู่ในประวัติผ่าน rec เดิมแล้ว
          for (const key of ['id', 'period', 'inputs', 'sourceByField', 'seed']) delete store[key];
          ctx.state.sim.baseline = { units: r.N, sales: R0 / 100, rain: pair.event === 'rain' }; // สำหรับรอบเดิม
          ctx.state.sim.plan = null; ctx.state.sim.run = null;
          State.addPortfolio('w4-baseline', 4, 'ยอดขายช่วงปกติ',
            `[จำลอง] ${pair.slot === 'am' ? '09:00' : '17:00'} · ${T} นาที · ${pm.p.name} ราคา ${bt(pm.P)} ทุน ${bt(pm.C)} บาท\nขาย ${r.N} ชิ้น · ยอดขาย ${bt(R0)} · ต้นทุนขาย ${bt(COGS0)} · กำไรขั้นต้น ${bt(G0)} บาท\nปัจจัยอื่น: ${factorText(pair, r)}${rec.note ? `\nบันทึก: ${rec.note}` : ''}\nรหัสอ้างอิง ${rec.id} · seed ${seed}`);
          State.save();
          finish(ok / 3, `ยอดปกติ ${r.N} ชิ้น · กำไรขั้นต้น ${bt(G0)} บาท`);
        });
      });
    });
  }

  // ฐานสำหรับรอบ 2–3 เมื่อยังไม่ได้เล่นรอบ 1 (กำกับว่าเป็นโจทย์ฝึก)
  function ensureBaseline(ctx) {
    const store = State.promo(ctx.product.id);
    if (store.baseline) return { b: store.baseline, practice: false };
    const pm = productMoney(ctx), seed = 4002;
    const pair = PM.simulatePair({ seed, P: pm.P, C: pm.C, B: null, slot: 'pm', event: 'none' });
    const N0 = pair.normal.N;
    return { practice: true, b: { id: 'practice-4002', source: 'จำลอง', seed, slot: 'pm', event: 'none', T, K0: K, P: pm.P, C: pm.C, N0, R0: N0 * pm.P, COGS0: N0 * pm.C, G0: N0 * (pm.P - pm.C) } };
  }

  // ================= รอบ 2 plan =================
  function plan(el, round, ctx, finish) {
    const pm = productMoney(ctx), store = State.promo(ctx.product.id);
    const { b, practice } = ensureBaseline(ctx);
    const F = pm.F, lo = Math.max(100, 2 * pm.C - 400), hi = 2 * pm.P;
    const startB = store.plan && store.plan.baselineId === b.id ? store.plan.B : pm.B;
    el.innerHTML = `<div class="calc-intro"><b>${esc(pm.p.name)}</b> ราคา ${bt(pm.P)} · ทุน ${bt(pm.C)} บาท/${ctx.product.unit} · ค่าทำโปร (ป้าย) F = <b>${bt(F)}</b> บาท ${LBL.plan}<br>
      ${practice ? `<span class="warn">ยังไม่มียอดปกติของคุณ — ใช้โจทย์ฝึก ${LBL.sim} ขาย ${b.N0} ชิ้น · เล่นรอบ 1 ก่อนเพื่อใช้ยอดของตัวเอง</span>`
        : `ยอดปกติ (รอบ 1): ขาย <b>${b.N0}</b> ชิ้น · G0 = <b>${bt(b.G0)}</b> บาท ${LBL.sim}`}</div>
      <div class="slider"><span>ราคาโปร "ซื้อ 2 ชิ้น" (B)</span><input type="range" min="${lo}" max="${hi}" step="100" value="${startB}"><b class="bv"></b></div>
      <p class="muted dd"></p>
      <p class="muted">เปลี่ยนเพียงตัวแปรเดียวคือราคาชุด · ต้นทุนต่อชุด = 2 × ${bt(pm.C)} = ${bt(2 * pm.C)} บาท</p>
      <div class="fm"></div>`;
    const range = $('input[type=range]', el);
    const upd = () => {
      const B = +range.value, d = (2 * pm.P - B) / (2 * pm.P);
      $('.bv', el).textContent = bt(B) + ' บาท';
      $('.dd', el).innerHTML = `ลูกค้าจ่ายเฉลี่ย ${bt(B / 2)} บาท/ชิ้น · ส่วนลด ${fmt(d * 100, 1)}%${B - 2 * pm.C <= 0 ? ' · <b class="bad-t">ราคาชุดไม่เกินต้นทุน 2 ชิ้น</b>' : ''}`;
    };
    range.oninput = upd; upd();
    // ฟอร์มสร้างตอนกดตรวจ (ใช้ราคาที่เลือก ณ ตอนนั้น)
    const fmEl = $('.fm', el);
    fmEl.innerHTML = `<div class="row"><button class="btn primary lock">🔒 ล็อกราคาและเริ่มคำนวณ</button></div>`;
    $('.lock', el).onclick = () => {
      range.disabled = true; sfx.play('click');
      const B = +range.value, pl = PM.plan({ P: pm.P, C: pm.C, B, F, G0: b.G0, K1: K });
      const Mx = pl.M;
      const setsDiag = (target, ans, name) => (v) => {
        if (ans === 'impossible') return `ส่วนต่างต่อชุด ${bt(Mx)} บาท ไม่เป็นบวก ยิ่งขายชุดยิ่งไม่ได้เพิ่ม จึงไปไม่ถึงเป้า ${bt(target)} บาท`;
        if (v === 'impossible') return `ส่วนต่างต่อชุดเป็นบวก (${bt(Mx)}) จึงหาจำนวนชุดได้`;
        if (v === Math.floor(target / Mx)) return `ต้องปัดขึ้น ⌈${bt(target)} ÷ ${bt(Mx)}⌉ = ${ans} ชุด`;
        if (name === 'match' && v === pl.cover) return `ช่องนี้เป้าคือ G0 + F = ${bt(b.G0)} + ${bt(F)} ไม่ใช่ค่าป้ายอย่างเดียว`;
        if (name === 'cover' && v === pl.match) return `ช่องนี้เป้าคือค่าป้าย F = ${bt(F)} อย่างเดียว`;
        return `⌈${bt(target)} ÷ ${bt(Mx)}⌉ = ${ans} ชุด`;
      };
      form(fmEl, [
        { key: 'm', label: 'ส่วนต่างต่อชุด M = B − 2 × ทุน', unit: 'บาท', kind: 'money', answer: Mx,
          diagnose: (v) => v === B - pm.C ? 'ชุดมี 2 ชิ้น ต้องหักทุน 2 ชิ้น' : v === 2 * pm.P - B ? 'นั่นคือส่วนลดต่อชุด ไม่ใช่ส่วนต่าง' : `${bt(B)} − 2 × ${bt(pm.C)} = ${bt(Mx)} บาท` },
        { key: 'cover', label: 'จำนวนชุดที่คุ้มค่าป้าย (เป้า F)', unit: 'ชุด', kind: 'sets', answer: pl.cover, diagnose: setsDiag(F, pl.cover, 'cover') },
        { key: 'match', label: 'จำนวนชุดที่ผลหลังค่าป้าย ≥ ช่วงปกติ (เป้า G0 + F)', unit: 'ชุด', kind: 'sets', answer: pl.match, diagnose: setsDiag(b.G0 + F, pl.match, 'match') },
      ], (ok, notes) => {
        const sol = $('.solution', fmEl); sol.classList.remove('hidden');
        const show = (k) => (k === 'impossible' ? 'ทำไม่ได้ด้วยยอดชุดอย่างเดียว' : `${k} ชุด (${2 * k} ชิ้น)`);
        const stockWarn = [pl.coverStockShort && 'คุ้มค่าป้าย', pl.matchStockShort && 'เท่าช่วงปกติ'].filter(Boolean);
        sol.innerHTML = `${notes.length ? `<ul class="diag">${notes.join('')}</ul>` : ''}<b>วิธีคิด</b><br>
          M = ${bt(B)} − 2 × ${bt(pm.C)} = <b>${bt(Mx)}</b> บาท<br>
          คุ้มค่าป้าย: ${Mx > 0 ? `⌈${bt(F)} ÷ ${bt(Mx)}⌉ = ` : ''}<b>${show(pl.cover)}</b><br>
          เท่าช่วงปกติ: ${Mx > 0 ? `⌈(${bt(b.G0)} + ${bt(F)}) ÷ ${bt(Mx)}⌉ = ` : ''}<b>${show(pl.match)}</b><br>
          <span class="muted">คิดจากชุดโปรล้วน ยังไม่นับกำไรจากชิ้นเดี่ยว</span>
          ${stockWarn.length ? `<br><span class="warn">⚠️ สต็อก ${K} ชิ้นไม่พอถึงเป้า${stockWarn.join(' และ ')}</span>` : ''}
          ${Mx <= 0 ? '<br><span class="warn">ยิ่งขายชุด ส่วนต่างรวมยิ่งไม่เพิ่ม ลองขยับราคาชุดขึ้น</span>' : ''}`;
        finishBtn(sol, `บันทึกแผน (${ok}/3)`, () => {
          const rec = { id: State.newId('plan'), baselineId: b.id, practiceBase: practice, B, F, M: Mx, cover: pl.cover, match: pl.match, at: Date.now() };
          store.plan = rec; store.run = null;
          ctx.state.sim.plan = { bundle: B / 100, sign: F / 100, margin: Mx / 100, breakeven: pl.cover, target: pl.match };
          ctx.state.sim.run = null;
          State.addPortfolio('w4-plan', 4, 'แผนโปรโมชัน',
            `[แผน] โปร 2 ชิ้น ${bt(B)} บาท (ส่วนลด ${fmt(((2 * pm.P - B) / (2 * pm.P)) * 100, 1)}%) · ค่าทำโปร ${bt(F)} บาท\nส่วนต่าง/ชุด ${bt(Mx)} · คุ้มค่าป้าย ${show(pl.cover)} · เท่าช่วงปกติ ${show(pl.match)}\nอ้างฐาน ${b.id}${practice ? ' (โจทย์ฝึก)' : ''} · รหัสแผน ${rec.id}`);
          State.save();
          finish(ok / 3, `ราคาโปร ${bt(B)} บาท · คำนวณถูก ${ok}/3`);
        });
      });
    };
  }

  // ================= รอบ 3 run =================
  function runRound(el, round, ctx, finish) {
    const pm = productMoney(ctx), store = State.promo(ctx.product.id);
    const { b, practice } = ensureBaseline(ctx);
    let p = store.plan, stale = '';
    // GDD §11: ฐานของผู้เล่นเปลี่ยนแล้ว ต้องคำนวณแผนใหม่ก่อนเทียบผล
    if (!practice && (!p || p.baselineId !== b.id)) {
      el.innerHTML = `<div class="calc-intro"><span class="warn">📌 ยอดปกติชุดล่าสุด (${esc(b.id)}) ยังไม่มีแผนโปร — คำนวณแผนในรอบ 2 ก่อน แล้วจึงทดลองเทียบผล</span>
        <div class="row"><button class="btn primary toPlan">ไปรอบ 2 ออกแบบโปร →</button></div></div>`;
      $('.toPlan', el).onclick = () => M.nav && M.nav.play(ctx.week, 1);
      return;
    }
    if (!p) stale = 'ยังไม่มีแผนจากรอบ 2 — ใช้ราคาชุดตั้งต้น (ส่วนลด 10%)';
    else if (p.baselineId !== b.id) { p = null; stale = 'แผนเดิมอ้างฐานชุดอื่น — ใช้ราคาชุดตั้งต้น (ส่วนลด 10%)'; }
    const B = p ? p.B : pm.B, F = p ? p.F : pm.F;
    const pair = PM.simulatePair({ seed: b.seed, P: pm.P, C: pm.C, B, T, K0: b.K0, K1: K, slot: b.slot, event: b.event });
    const r = pair.promo;
    el.innerHTML = `<div class="calc-intro"><b>ทดลองโปร 2 ชิ้น ${bt(B)} บาท</b> ${LBL.plan} · ค่าทำโปร ${bt(F)} บาท · ช่วงเวลา ระยะเวลา เหตุการณ์ และสต็อกเปิดช่วงเดียวกับช่วงปกติ ${LBL.sim}
      ${stale ? `<br><span class="warn">${stale}</span>` : ''}${practice ? `<br><span class="warn">ฐานเป็นโจทย์ฝึก — เล่นรอบ 1 เพื่อใช้ยอดของตัวเอง</span>` : ''}</div><div class="scn"></div><div class="after"></div>`;
    play($('.scn', el), ctx, pair, true, B, () => {
      const v = PM.evaluate({ P: pm.P, C: pm.C, B, F, N0: b.N0, S: r.S, U: r.U });
      const after = $('.after', el);
      after.innerHTML = `<div class="calc-intro"><b>เทียบสองช่วง</b> ${LBL.sim}
        <table><tr><th></th><th>ช่วงปกติ</th><th>ช่วงโปร</th></tr>
        <tr><td>จำนวนขาย</td><td>${b.N0} ชิ้น</td><td>${v.N1} ชิ้น = 2 × ${r.S} ชุด + ${r.U} เดี่ยว</td></tr>
        <tr><td>ยอดขาย</td><td>${b.N0} × ${bt(pm.P)} = ${bt(v.R0)}</td><td>${r.S} × ${bt(B)} + ${r.U} × ${bt(pm.P)} = ${bt(v.R1)}</td></tr>
        <tr><td>ต้นทุนขาย</td><td>${bt(v.COGS0)}</td><td class="q">?</td></tr>
        <tr><td>ค่าใช้จ่ายเพิ่มจากโปร</td><td>0</td><td>${bt(F)} ${LBL.plan}</td></tr>
        <tr><td>ผลหลังค่าใช้จ่าย</td><td>G0 = ${bt(v.G0)}</td><td class="q">?</td></tr>
        <tr><td>ปัจจัยอื่น</td><td colspan="2">${factorText(pair, r)}</td></tr></table></div><div class="fm"></div>`;
      const wrongN = r.S * pm.C + r.U * pm.C;
      form($('.fm', after), [
        { key: 'c1', label: 'ต้นทุนขายช่วงโปร = N1 × ทุน', unit: 'บาท', kind: 'money', answer: v.COGS1,
          diagnose: (x) => x === wrongN && r.S ? `ชุดหนึ่งมี 2 ชิ้น: N1 = 2 × ${r.S} + ${r.U} = ${v.N1} ชิ้น` : x === v.R1 ? 'ใช้ยอดขายแทนต้นทุน' : `${v.N1} × ${bt(pm.C)} = ${bt(v.COGS1)} บาท` },
        { key: 'g1', label: 'ผลหลังค่าทำโปร G1 = ยอดขาย − ต้นทุนขาย − F', unit: 'บาท', kind: 'money', answer: v.G1,
          diagnose: (x) => x === v.G1 + F ? `ยังไม่หักค่าทำโปร ${bt(F)} บาท` : x === v.R1 - F ? 'ยังไม่หักต้นทุนขาย' : `${bt(v.R1)} − ${bt(v.COGS1)} − ${bt(F)} = ${bt(v.G1)} บาท` },
        { key: 'dec', label: 'คำตัดสิน', kind: 'choice', options: ['ทำต่อ', 'ปรับ', 'หยุด'], answer: v.decision,
          diagnose: () => v.G1 <= 0 ? `G1 = ${bt(v.G1)} ไม่เกิน 0 → หยุด` : v.delta >= 0 ? `G1 − G0 = ${bt(v.delta)} ไม่ติดลบ → ทำต่อ` : `ยอดขายอาจเพิ่ม แต่ G1 − G0 = ${bt(v.delta)} ยังติดลบ → ปรับ (ลองเทียบผลหลังหักค่าป้ายกับช่วงปกติอีกครั้ง)` },
      ], (ok, notes) => {
        $$('td.q', after)[0].textContent = bt(v.COGS1); $$('td.q', after)[1].textContent = `G1 = ${bt(v.G1)}`;
        const sol = $('.solution', after); sol.classList.remove('hidden');
        sol.innerHTML = `${notes.length ? `<ul class="diag">${notes.join('')}</ul>` : ''}
          ${chart([
            { label: 'ยอดขาย', a: v.R0, b: v.R1 },
            { label: 'ต้นทุนขาย', a: v.COGS0, b: v.COGS1 },
            { label: 'ค่าใช้จ่ายเพิ่ม', a: 0, b: F },
            { label: 'ผลหลังค่าใช้จ่าย', a: v.G0, b: v.G1 },
          ])}
          <p><b>เกณฑ์</b> G1 ≤ 0 → หยุด · G1 > 0 และ G1 − G0 ≥ 0 → ทำต่อ · G1 > 0 แต่ G1 − G0 < 0 → ปรับ<br>
          ผลต่าง G1 − G0 = ${bt(v.G1)} − ${bt(v.G0)} = <b>${bt(v.delta)}</b> บาท → <b>${v.decision}</b>
          ${pair.event !== 'none' ? `<br><span class="warn">${PM.EVENTS[pair.event].icon} ${PM.EVENTS[pair.event].th} เกิดทั้งสองช่วง — ร้านจริงควรลองซ้ำในวันที่เงื่อนไขปกติก่อนสรุป</span>` : ''}</p>`;
        const getWs = worksheet(sol, 'w4r3', 'ปัจจัยอื่นที่อาจทำให้ผลคลาดเคลื่อน และถ้าลองซ้ำจะเปลี่ยนหรือคุมอะไร');
        finishBtn(sol, `บันทึกผลทดลอง (${ok}/3)`, () => {
          const rec = { id: State.newId('run'), baselineId: b.id, planId: p ? p.id : null, source: 'จำลอง', B, F, S: r.S, U: r.U, N1: v.N1,
            R1: v.R1, COGS1: v.COGS1, G1: v.G1, G0: v.G0, delta: v.delta, decision: v.decision, event: pair.event, note: getWs(), at: Date.now() };
          store.run = rec;
          ctx.state.sim.run = { sets: r.S, singles: r.U, units: v.N1, sales: v.R1 / 100, profit: v.G1 / 100, baseProfit: v.G0 / 100, rain: pair.event === 'rain' };
          State.addPortfolio('w4-run', 4, 'ผลทดลองโปรโมชัน',
            `[จำลอง] ปกติ ${b.N0} ชิ้น G0 ${bt(v.G0)} บาท | โปร ${bt(B)} บาท/2 ชิ้น: ${r.S} ชุด + ${r.U} เดี่ยว ยอดขาย ${bt(v.R1)} ต้นทุนขาย ${bt(v.COGS1)} ค่าทำโปร ${bt(F)} [แผน] → G1 ${bt(v.G1)} บาท\nผลต่าง ${bt(v.delta)} บาท · คำตัดสิน: ${v.decision}\nปัจจัยอื่น: ${factorText(pair, r)}${rec.note ? `\nบันทึก: ${rec.note}` : ''}\nอ้างฐาน ${b.id} · แผน ${rec.planId || '-'} · ผล ${rec.id}`);
          State.save();
          finish(ok / 3, `G1 ${bt(v.G1)} บาท เทียบ G0 ${bt(v.G0)} บาท → ${v.decision}`);
        });
      });
    });
  }

  function chooseMode(el, round, ctx, finish) {
    el.innerHTML = `<div class="calc-intro"><b>เลือกแหล่งข้อมูลยอดปกติ</b><br>เริ่มจากฉากจำลองได้ทันที หรือใช้ยอดที่สังเกตจากร้านเพื่อเทียบกับช่วงโปรในรอบถัดไป</div>
      <div class="row"><button class="btn primary use-sim">เล่นแบบจำลอง</button><button class="btn use-real">ใช้ข้อมูลร้าน</button></div>`;
    $('.use-sim', el).onclick = () => baseline(el, round, ctx, finish);
    $('.use-real', el).onclick = () => M.RealW4.baseline(el, ctx, finish, () => chooseMode(el, round, ctx, finish));
  }

  M.engines.sim = (el, round, ctx, finish) => {
    if (round.mode === 'baseline') return chooseMode(el, round, ctx, finish);
    const real = State.promo(ctx.product.id).baseline?.source === M.RealW4.real;
    if (round.mode === 'plan') return real ? M.RealW4.plan(el, ctx, finish) : plan(el, round, ctx, finish);
    return real ? M.RealW4.run(el, ctx, finish) : runRound(el, round, ctx, finish);
  };
  M.W4 = { chart, form, parseMoney, parseInt0 };
})();

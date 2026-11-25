/*
 * engines.js — กลไกเล่นแต่ละแบบ (Claude)
 * ทุก engine: (el, round, ctx, finish) แล้วเรียก finish(คะแนน 0..1, ข้อความสรุป)
 */
(function () {
  const M = (window.MTL = window.MTL || {});
  const { R, esc, fmt, $, $$, sfx } = M;
  const E = (M.engines = {});

  const feedback = (ok, text) => `<div class="msg">${ok ? '✅ <b>ถูกต้อง</b>' : '❌ <b>ยังไม่ใช่</b>'} — ${text || ''}</div>`;

  // ---------- MCQ ----------
  E.mcq = (el, round, ctx, finish) => {
    const qs = (typeof round.questions === 'function' ? round.questions(ctx) : round.questions).map((q) => ({ ...q, order: R.shuffle(q.options.map((_, i) => i)) }));
    let i = 0, correct = 0;
    const show = () => {
      const q = qs[i];
      el.innerHTML = `<div class="q-count">ข้อ ${i + 1} / ${qs.length}</div><div class="q">${q.q}</div>
        <div class="opts">${q.order.map((k) => `<button class="opt" data-k="${k}">${q.options[k]}</button>`).join('')}</div><div class="feedback"></div>`;
      $$('.opt', el).forEach((b) => (b.onclick = () => {
        const k = +b.dataset.k, ok = k === q.answer;
        if (ok) correct++;
        sfx.play(ok ? 'correct' : 'wrong');
        $$('.opt', el).forEach((x) => { x.disabled = true; if (+x.dataset.k === q.answer) x.classList.add('right'); });
        if (!ok) b.classList.add('bad');
        const last = i === qs.length - 1;
        $('.feedback', el).innerHTML = feedback(ok, q.explain) + `<div class="row"><button class="btn primary nx">${last ? 'ดูผล' : 'ข้อต่อไป →'}</button></div>`;
        $('.nx', el).onclick = () => { sfx.play('click'); i++; i < qs.length ? show() : finish(correct / qs.length, `ตอบถูก ${correct} จาก ${qs.length} ข้อ`); };
      }));
    };
    show();
  };

  // ---------- CALC (โจทย์ตัวเลขสุ่มได้) ----------
  E.calc = (el, round, ctx, finish) => {
    let first = true;
    const setup = () => {
      const g = round.gen(ctx, first); first = false;
      el.innerHTML = `<div class="calc-intro">${g.intro}</div>
        <form class="calc-form" autocomplete="off">
          ${g.fields.map((f, i) => `<label class="field"><span>${f.label}</span>${
            f.options
              ? `<select name="f${i}"><option value="">— เลือก —</option>${f.options.map((o) => `<option>${esc(o)}</option>`).join('')}</select><em></em>`
              : `<input name="f${i}" inputmode="decimal" placeholder="0"><em>${f.unit || ''}</em>`
          }<b class="mark"></b></label>`).join('')}
          <div class="row"><button class="btn primary chk">ตรวจคำตอบ</button><button type="button" class="btn ghost new">🎲 สุ่มโจทย์ใหม่</button></div>
        </form><div class="solution hidden"></div>`;
      const form = $('form', el);
      $('.new', el).onclick = () => { sfx.play('whoosh'); setup(); };
      form.onsubmit = (e) => {
        e.preventDefault();
        let ok = 0;
        g.fields.forEach((f, i) => {
          const inp = form[`f${i}`], v = inp.value.trim();
          let good;
          if (f.options) good = v === f.answer;
          else {
            const n = parseFloat(v.replace(/,/g, '').replace('−', '-'));
            good = v !== '' && isFinite(n) && Math.abs(n - f.answer) <= (f.tol ?? 0.01) + 1e-9;
          }
          if (good) ok++;
          inp.disabled = true;
          inp.closest('.field').querySelector('.mark').textContent = good ? '✅' : '❌';
        });
        const frac = ok / g.fields.length;
        sfx.play(frac === 1 ? 'correct' : frac > 0 ? 'note' : 'wrong');
        const sol = $('.solution', el);
        sol.classList.remove('hidden');
        sol.innerHTML = `<b>วิธีคิด</b><br>${g.solution}<div class="row"><button class="btn primary sv">บันทึกผล (${ok}/${g.fields.length})</button><button class="btn ghost again">🎲 ลองโจทย์ใหม่</button></div>`;
        $('.chk', el).disabled = true;
        $('.again', el).onclick = () => { sfx.play('whoosh'); setup(); };
        $('.sv', el).onclick = () => {
          if (g.portfolio) M.State.addPortfolio(g.portfolio.id, ctx.week + 1, g.portfolio.title, g.portfolio.text);
          if (g.onSave) g.onSave(frac);
          finish(frac, `ตอบถูก ${ok} จาก ${g.fields.length} ช่อง`);
        };
      };
    };
    setup();
  };

  // ---------- SORT (คลิกเลือกแล้วคลิกกล่อง) ----------
  E.sort = (el, round, ctx, finish) => {
    const cfg = round.gen(ctx);
    const items = R.shuffle(cfg.items).map((x, i) => ({ ...x, i, at: null }));
    let sel = null, checked = false;
    const chip = (it) => `<button class="chip ${sel === it.i ? 'sel' : ''} ${checked ? (it.at === it.bucket ? 'right' : 'bad') : ''}" data-i="${it.i}">${esc(it.text)}</button>`;
    const render = () => {
      const pool = items.filter((x) => x.at === null);
      el.innerHTML = `<p class="muted">${pool.length ? 'คลิกการ์ด แล้วคลิกกล่องที่ต้องการวาง (คลิกการ์ดในกล่องเพื่อนำออก)' : 'วางครบแล้ว กดตรวจคำตอบได้'}</p>
        <div class="sort-pool">${pool.map(chip).join('') || '<span class="muted">✓ ว่าง</span>'}</div>
        <div class="buckets">${cfg.buckets.map((b, bi) => `<div class="bucket ${sel !== null ? 'armed' : ''}" data-b="${bi}"><h4>${esc(b)}</h4><div class="chips">${items.filter((x) => x.at === b).map(chip).join('')}</div></div>`).join('')}</div>
        <div class="feedback"></div>
        <div class="row"><button class="btn primary chk" ${pool.length || checked ? 'disabled' : ''}>ตรวจคำตอบ</button></div>`;
      $$('.chip', el).forEach((c) => (c.onclick = (e) => {
        e.stopPropagation(); if (checked) return;
        const it = items[+c.dataset.i];
        if (it.at !== null) { it.at = null; sel = it.i; } else sel = sel === it.i ? null : it.i;
        sfx.play('click'); render();
      }));
      $$('.bucket', el).forEach((b) => (b.onclick = () => {
        if (checked || sel === null) return;
        items[sel].at = cfg.buckets[+b.dataset.b]; sel = null; sfx.play('note'); render();
      }));
      const chk = $('.chk', el);
      chk.onclick = () => {
        checked = true;
        const ok = items.filter((x) => x.at === x.bucket).length;
        sfx.play(ok === items.length ? 'correct' : 'wrong');
        render();
        const wrong = items.filter((x) => x.at !== x.bucket);
        $('.feedback', el).innerHTML = `<div class="msg">วางถูก <b>${ok}/${items.length}</b>${wrong.length ? '<br>' + wrong.map((w) => `• “${esc(w.text)}” → <b>${esc(w.bucket)}</b>${w.why ? ` (${esc(w.why)})` : ''}`).join('<br>') : ''}</div>
          <div class="row"><button class="btn primary sv">บันทึกผล</button></div>`;
        $('.sv', el).onclick = () => {
          const text = cfg.buckets.map((b) => `- ${b}: ${items.filter((x) => x.bucket === b).map((x) => x.text).join(' / ')}`).join('\n');
          M.State.addPortfolio(`w${ctx.week + 1}r${ctx.idx + 1}`, ctx.week + 1, round.title, text);
          finish(ok / items.length, `วางถูก ${ok} จาก ${items.length} ใบ`);
        };
      };
    };
    render();
  };

  // ---------- DIALOGUE (บทสนทนา + ฟังตัวเลข) ----------
  E.dialogue = (el, round, ctx, finish) => {
    const steps = round.script(ctx);
    let i = 0, tries = 0, wrong = 0;
    el.innerHTML = `<div class="chat"></div><div class="choices"></div><div class="feedback"></div>`;
    const chat = $('.chat', el), box = $('.choices', el);
    const add = (cls, en, th, speakText) => {
      const d = document.createElement('div');
      d.className = `bubble ${cls}`;
      d.innerHTML = `${esc(en)}${cls !== 'sys' ? `<button class="say" title="ฟังอีกครั้ง">🔊</button>` : ''}${th ? `<span class="th">${esc(th)}</span>` : ''}`;
      const say = d.querySelector('.say'); if (say) say.onclick = () => M.speak(speakText || en);
      chat.appendChild(d); chat.scrollTop = chat.scrollHeight;
    };
    const next = () => {
      box.innerHTML = '';
      if (i >= steps.length) {
        tries = steps.filter((s) => s.choices || s.listen).length;
        const score = Math.max(0, (tries - wrong) / tries);
        $('.feedback', el).innerHTML = `<div class="msg">จบบทสนทนา ตอบถูกในครั้งแรก <b>${tries - wrong}/${tries}</b> · ลองพูดตามทุกประโยคอีกรอบให้คล่อง</div><div class="row"><button class="btn primary sv">บันทึกผล</button></div>`;
        $('.sv', el).onclick = () => finish(score, `ตอบถูกครั้งแรก ${tries - wrong} จาก ${tries}`);
        return;
      }
      const s = steps[i];
      if (s.them) {
        add('them', s.them, s.th, s.speakText);
        M.speak(s.speakText || s.them.replace(/\(.*?\)/g, ''));
        i++; setTimeout(next, 450); return;
      }
      if (s.listen) {
        box.innerHTML = `<div class="q">🎧 ${esc(s.listen)}</div>` + s.options.map((o) => `<button class="opt">${esc(o)}</button>`).join('');
        let miss = false;
        $$('.opt', box).forEach((b) => (b.onclick = () => {
          if (b.textContent === s.answer) {
            sfx.play('correct'); add('me', `✓ ${s.answer}`); i++; next();
          } else { sfx.play('wrong'); b.classList.add('bad'); b.disabled = true; if (!miss) { wrong++; miss = true; } }
        }));
        return;
      }
      if (s.choices) {
        const opts = R.shuffle(s.choices);
        box.innerHTML = opts.map((c, k) => `<button class="opt" data-k="${k}">${esc(c.en)}</button>`).join('');
        let miss = false;
        $$('.opt', box).forEach((b) => (b.onclick = () => {
          const c = opts[+b.dataset.k];
          if (c.ok) {
            sfx.play('correct'); add('me', c.en, c.th); M.speak(c.en); i++; setTimeout(next, 500);
          } else {
            sfx.play('wrong'); b.classList.add('bad'); b.disabled = true;
            add('sys', `✗ ${c.why || 'ยังไม่ถูก'}`);
            if (!miss) { wrong++; miss = true; }
          }
        }));
      }
    };
    next();
  };

  // ---------- OBSERVE (ฉากร้าน: สังเกตลูกค้า) ----------
  E.observe = (el, round, ctx, finish) => {
    const need = round.need || 5;
    const pool = R.shuffle(M.behaviors(ctx.product));
    const notes = [];
    let k = 0, pending = null;
    el.innerHTML = `<div class="hud"><div class="stat">จดแล้ว<b class="cnt">0 / ${need}</b></div><div class="stat">วิธีเล่น<b style="font-size:14px">คลิกลูกค้าที่มี ❗</b></div></div>
      <div class="scene-wrap"><canvas></canvas></div><div class="pop"></div>
      <div class="notes"><table class="tbl"><tr><th>ครั้ง</th><th>เวลา</th><th>สิ่งที่เห็นหรือได้ยิน</th></tr><tbody class="nb"></tbody></table></div>`;
    const scene = new M.StoreScene($('canvas', el), {
      product: ctx.product, minutesPerSec: 1.2,
      onArrive: (c, step) => { if (step === 1 && c.data.b) { c.bubble = '!'; c.bubbleColor = '#ffde59'; } if (step === 2) c.bubble = null; },
      onCustomerClick: (c) => {
        if (!c.data.b || c.data.noted || c.bubble !== '!') return;
        sfx.play('click');
        pending = c;
        $('.pop', el).innerHTML = `<div class="note-pop"><b>🕒 ${scene.timeLabel()}</b> — ${esc(c.data.b.see)}<div class="row"><button class="btn primary nt">📝 จดลงตาราง</button><button class="btn ghost sk">ข้าม</button></div></div>`;
        c.wait = 99; // หยุดให้จด
        $('.nt', el).onclick = () => {
          c.data.noted = true; c.bubble = '✓'; c.bubbleColor = '#cdeccf'; c.wait = 0.4;
          notes.push({ time: scene.timeLabel(), b: c.data.b });
          sfx.play('note');
          $('.nb', el).insertAdjacentHTML('beforeend', `<tr><td>${notes.length}</td><td>${notes[notes.length - 1].time}</td><td>${esc(c.data.b.see)}</td></tr>`);
          $('.cnt', el).textContent = `${notes.length} / ${need}`;
          $('.pop', el).innerHTML = '';
          if (notes.length >= need) { scene.stop(); clearInterval(spawner); phase2(); }
        };
        $('.sk', el).onclick = () => { c.wait = 0.3; c.bubble = null; $('.pop', el).innerHTML = ''; };
      },
    });
    scene.start(); M.sfx.startBgm();
    const spawn = () => {
      const withB = R.chance(0.75);
      scene.spawn(withB ? { b: pool[k++ % pool.length], shelfWait: 7 } : { shelfWait: 1 });
    };
    spawn();
    const spawner = setInterval(() => { if (scene.customers.length < 4) spawn(); }, 2200);
    M.onLeave = () => { scene.stop(); clearInterval(spawner); M.sfx.stopBgm(); };

    const phase2 = () => {
      M.sfx.stopBgm();
      let j = 0, ok = 0;
      const all = M.behaviors(ctx.product);
      const ask = () => {
        if (j >= notes.length) {
          const text = notes.map((n, x) => `| ${x + 1} | ${n.time} | ${n.b.see} | ${n.b.good} |`).join('\n');
          M.State.addPortfolio('w1-observe', 1, 'ตารางสังเกตลูกค้า', `| ครั้ง | เวลา | สิ่งที่เห็นหรือได้ยิน | เหตุผลที่เป็นไปได้ |\n|---|---|---|---|\n${text}\n(ข้อมูลจำลองจากเกม)`);
          finish(ok / notes.length, `เลือกเหตุผลที่สมเหตุสมผล ${ok} จาก ${notes.length} เหตุการณ์`);
          return;
        }
        const n = notes[j];
        const other = R.pick(all.filter((x) => x.good !== n.b.good));
        const opts = R.shuffle([{ t: n.b.good, ok: true }, { t: R.pick(M.badReasons), ok: false, why: 'เป็นการตัดสินตัวลูกค้า ไม่มีหลักฐานจากสิ่งที่เห็น' }, { t: other.good, ok: false, why: 'ไม่ได้มาจากเหตุการณ์นี้' }]);
        $('.pop', el).innerHTML = `<div class="note-pop"><div class="q-count">ขั้นที่ 2: ตีความ (${j + 1}/${notes.length})</div><div class="q">ข้อสังเกต: “${esc(n.b.see)}” — เหตุผลที่เป็นไปได้คือ</div><div class="opts">${opts.map((o, x) => `<button class="opt" data-x="${x}">${esc(o.t)}</button>`).join('')}</div><div class="feedback"></div></div>`;
        $('.pop', el).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        $$('.pop .opt', el).forEach((b) => (b.onclick = () => {
          const o = opts[+b.dataset.x];
          if (o.ok) ok++;
          sfx.play(o.ok ? 'correct' : 'wrong');
          $$('.pop .opt', el).forEach((x) => { x.disabled = true; if (opts[+x.dataset.x].ok) x.classList.add('right'); });
          if (!o.ok) b.classList.add('bad');
          $('.pop .feedback', el).innerHTML = feedback(o.ok, o.ok ? 'โยงกับสิ่งที่เห็นโดยตรง' : o.why) + `<div class="row"><button class="btn primary nx">ต่อไป →</button></div>`;
          $('.pop .nx', el).onclick = () => { j++; ask(); };
        }));
      };
      ask();
    };
  };

  // ---------- SIM (จำลองโปรโมชัน 30 นาที) ----------
  // โมเดลอุปสงค์ (ปรับได้ใน docs/GDD.md §5): ลูกค้าเข้าร้าน ~ 18–26 คน/30 นาที
  function simulate(P, bundle) {
    const rain = R.chance(0.25);
    const disc0 = bundle ? Math.max(0, (P.price - bundle / 2) / P.price) : 0;
    // ป้ายโปรดึงคนเดินผ่านเข้าร้านเพิ่มตามขนาดส่วนลด
    const n = Math.round(R.int(18, 26) * (rain ? 0.75 : 1) * (1 + 2 * disc0));
    const out = [];
    for (let i = 0; i < n; i++) {
      let buy = R.chance(bundle ? 0.78 : 0.68);
      let sets = 0, singles = 0;
      if (buy) {
        if (bundle) {
          const disc = (P.price - bundle / 2) / P.price; // ส่วนลดต่อชิ้น
          const take = Math.max(0, Math.min(0.85, 0.12 + disc * 3.2));
          if (R.chance(take)) sets = R.chance(0.15) ? 2 : 1; else singles = 1;
        } else singles = R.chance(0.2) ? 2 : 1;
      }
      out.push({ sets, singles });
    }
    return { rain, customers: out };
  }

  E.sim = (el, round, ctx, finish) => {
    const P = ctx.product.promo, S = ctx.state.sim, mode = round.mode;
    const unitM = P.price - P.cost;

    if (mode === 'plan') {
      const base = S.baseline;
      const sign = 30;
      el.innerHTML = `<div class="calc-intro"><b>${esc(P.name)}</b> ต้นทุน ${P.cost} บาท ราคาปกติ ${P.price} บาท/ชิ้น · ค่าป้ายโปร <b>${sign}</b> บาท<br>
        ${base ? `ช่วงปกติ (รอบก่อน): ขาย <b>${base.units}</b> ชิ้น กำไรขั้นต้น <b>${base.units * unitM}</b> บาท` : '<span class="muted">ยังไม่มีข้อมูลช่วงปกติ — ใช้ 15 ชิ้นเป็นค่าเริ่มต้น</span>'}</div>
        <div class="slider"><span>ราคาโปร "ซื้อ 2 ชิ้น"</span><input type="range" min="${2 * P.cost + 1}" max="${2 * P.price}" value="${2 * P.price - 4}"><b class="bv"></b></div>
        <p class="muted">เปลี่ยนเพียงอย่างเดียวคือราคา ต้นทุนผันแปรต่อชุด = 2 × ${P.cost} = ${2 * P.cost} บาท</p>
        <form class="calc-form" autocomplete="off">
          <label class="field"><span>ส่วนต่างต่อชุด</span><input name="a" inputmode="decimal"><em>บาท</em><b class="mark"></b></label>
          <label class="field"><span>จำนวนชุดที่ครอบคลุมค่าป้าย</span><input name="b" inputmode="decimal"><em>ชุด</em><b class="mark"></b></label>
          <label class="field"><span>จำนวนชุดที่ได้ผลหลังค่าป้าย ≥ ช่วงปกติ</span><input name="c" inputmode="decimal"><em>ชุด</em><b class="mark"></b></label>
          <div class="row"><button class="btn primary">ตรวจและบันทึกแผน</button></div></form><div class="solution hidden"></div>`;
      const range = $('input[type=range]', el), bv = $('.bv', el);
      const upd = () => (bv.textContent = range.value + ' บาท'); range.oninput = upd; upd();
      $('form', el).onsubmit = (e) => {
        e.preventDefault();
        const B = +range.value, m = B - 2 * P.cost, units = base ? base.units : 15, gp = units * unitM;
        const ans = [m, Math.ceil(sign / m), Math.ceil((gp + sign) / m)];
        let ok = 0;
        ['a', 'b', 'c'].forEach((k, i) => { const inp = e.target[k]; const g = parseFloat(inp.value) === ans[i]; if (g) ok++; inp.disabled = true; inp.closest('.field').querySelector('.mark').textContent = g ? '✅' : '❌'; });
        range.disabled = true;
        S.plan = { bundle: B, sign, margin: m, breakeven: ans[1], target: ans[2] }; M.State.save();
        sfx.play(ok === 3 ? 'correct' : 'note');
        const sol = $('.solution', el); sol.classList.remove('hidden');
        sol.innerHTML = `ส่วนต่างต่อชุด = ${B} − ${2 * P.cost} = <b>${m}</b> บาท<br>คุ้มค่าป้าย = ⌈${sign} ÷ ${m}⌉ = <b>${ans[1]}</b> ชุด<br>เท่าช่วงปกติ = ⌈(${gp} + ${sign}) ÷ ${m}⌉ = <b>${ans[2]}</b> ชุด<br>
          <i>${ans[2] > 15 ? '⚠️ ต้องขายหลายชุดมาก ราคาโปรอาจต่ำเกินไป' : 'เป้าหมายนี้เป็นไปได้ถ้าลูกค้าสนใจโปร'}</i><div class="row"><button class="btn primary sv">บันทึกผล</button></div>`;
        $('.sv', el).onclick = () => {
          M.State.addPortfolio('w4-plan', 4, 'แผนโปรโมชัน', `โปร 2 ชิ้น ${B} บาท · ส่วนต่าง/ชุด ${m} · คุ้มค่าป้าย ${ans[1]} ชุด · เท่าช่วงปกติ ${ans[2]} ชุด`);
          finish(ok / 3, `คำนวณถูก ${ok}/3 · ราคาโปร ${B} บาท`);
        };
      };
      return;
    }

    // baseline / run: ฉากจำลองเวลา 30 นาที
    const promo = mode === 'run' ? S.plan || { bundle: 2 * P.price - 4, sign: 30 } : null;
    el.innerHTML = `<div class="hud">
        <div class="stat">ช่วงเวลา<b class="tm">${mode === 'run' ? 'ทดลองโปร' : 'ปกติ'} 30 นาที</b></div>
        <div class="stat">ลูกค้าเข้า<b class="c1">0</b></div>
        <div class="stat">ขาย (ชิ้น)<b class="c2">0</b></div>
        ${promo ? '<div class="stat">ชุดโปร<b class="c3">0</b></div>' : ''}
        <div class="stat">ยอดขาย<b class="c4">0 ฿</b></div></div>
      <div class="scene-wrap"><canvas></canvas></div>
      <div class="row"><button class="btn primary go">▶ เริ่มจำลอง 30 นาที</button><span class="muted">เวลาในเกม 1 นาที ≈ 0.6 วินาที</span></div><div class="after"></div>`;
    const result = simulate(P, promo && promo.bundle);
    let idx = 0, units = 0, sets = 0, singles = 0, sales = 0, entered = 0;
    const scene = new M.StoreScene($('canvas', el), {
      product: ctx.product, minutesPerSec: 1.7, startMinute: 17 * 60, speedMul: 1.6,
      sign: promo ? `โปร 2 ชิ้น ${promo.bundle} บาท` : null,
      onArrive: (c, step) => {
        if (step !== 2) return;
        const r = c.data.r; if (!r) return;
        const u = r.sets * 2 + r.singles;
        if (u) {
          const amt = r.sets * (promo ? promo.bundle : 0) + r.singles * P.price;
          units += u; sets += r.sets; singles += r.singles; sales += amt;
          scene.float(c.x, c.y, `+${amt}฿`); sfx.play('coin');
        } else { scene.float(c.x, c.y, 'ไม่ซื้อ', '#999'); }
        $('.c2', el).textContent = units; if (promo) $('.c3', el).textContent = sets; $('.c4', el).textContent = sales + ' ฿';
      },
    });
    scene.draw();
    let timer;
    M.onLeave = () => { scene.stop(); clearInterval(timer); M.sfx.stopBgm(); };
    $('.go', el).onclick = (e) => {
      e.target.disabled = true; sfx.play('click'); scene.start(); M.sfx.startBgm();
      const total = result.customers.length, dur = 30 / 1.7; // วินาทีจริง
      timer = setInterval(() => {
        if (idx < total) {
          scene.spawn({ r: result.customers[idx++], shelfWait: 0.5, counterWait: 0.4 }); entered++;
          $('.c1', el).textContent = entered;
        }
        if (idx >= total && scene.customers.length === 0) { clearInterval(timer); scene.stop(); M.sfx.stopBgm(); done(); }
      }, (dur * 1000) / total);
    };
    const done = () => {
      sfx.play('levelup');
      const note = result.rain ? '🌧️ เหตุการณ์ประกอบ: ฝนตกช่วงนี้ คนเดินผ่านน้อยลง' : '☀️ เหตุการณ์ประกอบ: อากาศปกติ';
      if (mode === 'baseline') {
        S.baseline = { units, sales, rain: result.rain }; M.State.save();
        E.calc($('.after', el), { gen: () => ({
          intro: `<b>ผลช่วงปกติ (ข้อมูลจำลอง)</b> ${note}<br>ขาย ${units} ชิ้น ราคา ${P.price} บาท ต้นทุน ${P.cost} บาท/ชิ้น`,
          fields: [
            { label: 'ยอดขาย', answer: units * P.price, unit: 'บาท' },
            { label: 'ต้นทุนขาย', answer: units * P.cost, unit: 'บาท' },
            { label: 'กำไรขั้นต้น (ฐานเทียบ)', answer: units * unitM, unit: 'บาท' },
          ],
          solution: `${units}×${P.price} = <b>${units * P.price}</b> · ${units}×${P.cost} = <b>${units * P.cost}</b> · กำไรขั้นต้น <b>${units * unitM}</b> บาท`,
          portfolio: { id: 'w4-baseline', title: 'ยอดขายช่วงปกติ', text: `30 นาที · ขาย ${units} ชิ้น · ยอดขาย ${units * P.price} · กำไรขั้นต้น ${units * unitM} บาท · ${note} (จำลอง)` },
        }) }, ctx, finish);
        $('.after .new', el).remove();
        return;
      }
      // run
      const base = S.baseline || { units: 15 };
      const baseProfit = base.units * unitM;
      const cogs = units * P.cost, profit = sales - cogs - promo.sign;
      const decision = profit >= baseProfit ? 'ทำต่อ' : profit > 0 ? 'ปรับ' : 'หยุด';
      S.run = { sets, singles, units, sales, profit, baseProfit, rain: result.rain }; M.State.save();
      E.calc($('.after', el), { gen: () => ({
        intro: `<b>ผลช่วงทดลอง (ข้อมูลจำลอง)</b> ${note}${'<table><tr><th></th><th>ช่วงปกติ</th><th>ช่วงทดลอง</th></tr>'}
          <tr><td>จำนวนขาย</td><td>${base.units} ชิ้น</td><td>${units} ชิ้น (${sets} ชุด + ${singles} เดี่ยว)</td></tr>
          <tr><td>ยอดขาย</td><td>${base.units * P.price}</td><td>${sales}</td></tr>
          <tr><td>ค่าใช้จ่ายเพิ่มจากโปร</td><td>0</td><td>${promo.sign}</td></tr></table>`,
        fields: [
          { label: 'ต้นทุนขายช่วงทดลอง', answer: cogs, unit: 'บาท' },
          { label: 'ผลหลังหักต้นทุนและค่าทำโปร', answer: profit, unit: 'บาท' },
          { label: 'ตัดสินใจ', options: ['ทำต่อ', 'ปรับ', 'หยุด'], answer: decision },
        ],
        solution: `${units}×${P.cost} = <b>${cogs}</b> · ${sales} − ${cogs} − ${promo.sign} = <b>${profit}</b> บาท เทียบช่วงปกติ ${baseProfit} บาท<br>
          เกณฑ์: ≥ ช่วงปกติ → <b>ทำต่อ</b> · มากกว่า 0 แต่ต่ำกว่าช่วงปกติ → <b>ปรับ</b> (เช่น ขยับราคาโปร) · ≤ 0 → <b>หยุด</b><br>คำตอบ: <b>${decision}</b>${result.rain ? ' — แต่ฝนตกเป็นปัจจัยอื่น ควรทดลองซ้ำก่อนสรุป' : ''}`,
        portfolio: { id: 'w4-run', title: 'ผลทดลองโปรโมชัน', text: `ปกติ: ${base.units} ชิ้น กำไร ${baseProfit} | ทดลอง: ${sets} ชุด + ${singles} เดี่ยว ยอดขาย ${sales} ผลหลังค่าป้าย ${profit} บาท | ตัดสินใจ: ${decision} | ${note} (จำลอง)` },
      }) }, ctx, finish);
      $('.after .new', el).remove();
    };
  };

  // ---------- POST (สร้างโพสต์และทดสอบ) ----------
  E.post = (el, round, ctx, finish) => {
    const P = ctx.product, it = P.small;
    const parts = [
      { k: 'name', t: `บอกสินค้าและขนาด: ${it.name}`, good: true, line: `🛒 ${it.name}` },
      { k: 'price', t: `บอกราคา: ${it.price} บาท`, good: true, line: `💰 ราคา ${it.price} บาท` },
      { k: 'benefit', t: 'บอกประโยชน์ 1 ข้อ: พกง่าย หยิบเร็ว', good: true, line: '✨ พกง่าย หยิบเร็ว เหมาะกับคนรีบเดินทาง' },
      { k: 'how', t: 'บอกวิธีสั่ง: ทักแชต สั่งแล้วรับที่ร้าน', good: true, line: '📩 ทักแชตสั่งได้ รับที่เคาน์เตอร์หน้าร้าน' },
      { k: 'pic', t: 'แนบภาพสินค้าที่ถ่ายจริง ชัด สว่าง', good: true, line: '[📷 ภาพสินค้าจริง]' },
      { k: 'en', t: 'บรรทัดอังกฤษ: Message us to check availability.', good: true, line: 'Message us to check availability.' },
      { k: 'long', t: 'ใส่ประวัติร้านยาว 5 ย่อหน้า', good: false, line: 'ร้านของเราก่อตั้งมานานมาก … (ยาว 5 ย่อหน้า)' },
      { k: 'fake', t: 'เขียนว่า "ถูกที่สุดในประเทศ" (ไม่มีหลักฐาน)', good: false, line: '🔥 ถูกที่สุดในประเทศ!!!' },
    ];
    const on = new Set();
    el.innerHTML = `<div class="grid g2"><div><h3>ส่วนประกอบโพสต์</h3><div class="checks">${parts.map((p) => `<label><input type="checkbox" data-k="${p.k}"> ${esc(p.t)}</label>`).join('')}</div></div>
      <div><h3>ตัวอย่างโพสต์</h3><div class="post-preview"></div><div class="row"><button class="btn primary go">🚀 ทดสอบกับผู้ชมจำลอง</button></div></div></div><div class="after"></div>`;
    const prev = $('.post-preview', el);
    const upd = () => { prev.textContent = parts.filter((p) => on.has(p.k)).map((p) => p.line).join('\n') || '(ยังว่าง — เลือกส่วนประกอบทางซ้าย)'; };
    $$('input[type=checkbox]', el).forEach((c) => (c.onchange = () => { c.checked ? on.add(c.dataset.k) : on.delete(c.dataset.k); sfx.play('click'); upd(); }));
    upd();
    $('.go', el).onclick = (e) => {
      const good = parts.filter((p) => p.good && on.has(p.k)).length, bad = parts.filter((p) => !p.good && on.has(p.k)).length;
      const q = Math.max(0, Math.min(1, good / 6 - bad * 0.2));
      const views = R.int(150, 320), messages = Math.max(1, Math.round(views * (0.01 + 0.07 * q) * (0.8 + Math.random() * 0.4)));
      const orders = Math.max(0, Math.min(messages, Math.round(messages * (0.15 + 0.45 * q))));
      ctx.state.sim.post = { views, messages, orders, q }; M.State.save();
      e.target.disabled = true; $$('input[type=checkbox]', el).forEach((c) => (c.disabled = true));
      sfx.play('levelup');
      const miss = parts.filter((p) => p.good && !on.has(p.k)).map((p) => p.t.split(':')[0]);
      const extra = parts.filter((p) => !p.good && on.has(p.k)).map((p) => p.t);
      $('.after', el).innerHTML = `<div class="solution"><b>ผลทดสอบ (ข้อมูลจำลอง)</b><div class="hud"><div class="stat">คนเห็น<b>${views}</b></div><div class="stat">คนทัก<b>${messages}</b></div><div class="stat">ผู้ทักที่สั่ง<b>${orders}</b></div><div class="stat">คะแนนโพสต์<b>${Math.round(q * 100)}%</b></div></div>
        ${miss.length ? `ยังขาด: ${miss.map(esc).join(' · ')}<br>` : '✅ ครบทุกส่วนที่จำเป็น<br>'}${extra.length ? `ควรตัดออก: ${extra.map(esc).join(' · ')}<br>` : ''}
        <i>รอบถัดไปจะใช้ตัวเลขชุดนี้คำนวณอัตราทัก</i><div class="row"><button class="btn primary sv">บันทึกผล</button></div></div>`;
      $('.sv', el).onclick = () => {
        M.State.addPortfolio('w5-post', 5, 'โพสต์ขายสินค้า', prev.textContent + `\n\nผลทดสอบจำลอง: เห็น ${views} · ทัก ${messages} · สั่ง ${orders}`);
        finish(q, `คะแนนโพสต์ ${Math.round(q * 100)}%`);
      };
    };
  };

  // ---------- PITCH (นำเสนอ 60 วินาที) ----------
  E.pitch = (el, round, ctx, finish) => {
    const P = ctx.product, S = ctx.state.sim, E2 = P.en;
    const run = S.run, plan = S.plan;
    const segs = [
      { s: 15, t: 'ลูกค้ากับปัญหา', en: `Our customers are ${E2.cust}. They want a ${E2.small} that is easy to carry.` },
      { s: 20, t: 'ข้อเสนอและวิธีทดลอง', en: `We tested a two-${E2.unit} offer for ${M.baht(plan ? plan.bundle : 36)} for thirty minutes. We recorded the number of ${E2.units} sold and the profit after the cost of the sign.` },
      { s: 15, t: 'ผล', en: run ? `In our practice data, we sold ${M.words(run.sets)} sets and earned ${M.words(Math.abs(run.profit))} baht ${run.profit < 0 ? 'less than zero ' : ''}after that cost. Regular sales earned ${M.words(run.baseProfit)} baht.` : 'In our practice data, we sold six sets and earned forty-two baht after that cost.' },
      { s: 10, t: 'สิ่งที่จะทำต่อ', en: 'Next time, we will test the offer again during the same time of day and compare it with regular sales.' },
    ];
    const script = segs.map((x) => x.en).join(' ');
    el.innerHTML = `<div class="pitch-seg">${segs.map((x, i) => `<div data-i="${i}">${x.t}<br><b>${x.s} วิ</b></div>`).join('')}</div>
      <div class="script">${segs.map((x, i) => `<p data-p="${i}">${esc(x.en)}</p>`).join('')}</div>
      <div class="row"><span class="timer">0:00</span><button class="btn primary go">⏱ เริ่มจับเวลา</button><button class="btn ghost hear">🔊 ฟังตัวอย่าง</button><button class="btn ghost rec">🎙️ อัดเสียง</button><audio controls class="hidden"></audio></div>
      <h3 style="margin-top:18px">ประเมินตัวเอง (ให้คนฟังช่วยติ๊กได้)</h3>
      <div class="checks">${['พูดจบใน 50–70 วินาที', 'ผู้ฟังบอกได้ว่าลูกค้าเป้าหมายคือใคร', 'ผู้ฟังบอกได้ว่าทดลองอะไรและได้ผลเท่าไร (มีหน่วย)', 'ปิดโน้ตแล้วตอบ What will you do next? ได้'].map((t) => `<label><input type="checkbox"> ${t}</label>`).join('')}</div>
      <div class="row"><button class="btn primary sv">บันทึกผล</button></div>`;
    let t0 = 0, tick;
    const tm = $('.timer', el);
    $('.go', el).onclick = (e) => {
      if (tick) { clearInterval(tick); tick = null; e.target.textContent = '⏱ เริ่มใหม่'; return; }
      t0 = performance.now(); e.target.textContent = '⏹ หยุด'; sfx.play('click');
      tick = setInterval(() => {
        const s = (performance.now() - t0) / 1000;
        tm.textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
        let acc = 0, cur = 3; for (let i = 0; i < 4; i++) { acc += segs[i].s; if (s < acc) { cur = i; break; } }
        $$('.pitch-seg div', el).forEach((d) => d.classList.toggle('on', +d.dataset.i === cur));
        $$('.script p', el).forEach((p) => (p.style.background = +p.dataset.p === cur ? '#fff3c4' : ''));
        if (Math.floor(s) === 60 && s - 60 < 0.12) sfx.play('tick');
      }, 100);
    };
    $('.hear', el).onclick = () => { const old = M.State.data.settings.tts; M.State.data.settings.tts = true; M.speak(script); M.State.data.settings.tts = old; };
    let rec = null, chunks = [];
    $('.rec', el).onclick = async (e) => {
      if (rec && rec.state === 'recording') { rec.stop(); e.target.textContent = '🎙️ อัดใหม่'; return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        rec = new MediaRecorder(stream); chunks = [];
        rec.ondataavailable = (ev) => chunks.push(ev.data);
        rec.onstop = () => { const a = $('audio', el); a.src = URL.createObjectURL(new Blob(chunks)); a.classList.remove('hidden'); stream.getTracks().forEach((t) => t.stop()); };
        rec.start(); e.target.textContent = '⏹ หยุดอัด';
      } catch (err) { e.target.textContent = '🎙️ อัดไม่ได้ (ใช้โทรศัพท์อัดแทน)'; e.target.disabled = true; }
    };
    M.onLeave = () => { clearInterval(tick); if (rec && rec.state === 'recording') rec.stop(); };
    $('.sv', el).onclick = () => {
      clearInterval(tick);
      const n = $$('.checks input:checked', el).length;
      M.State.addPortfolio('w8-pitch', 8, 'บทนำเสนอภาษาอังกฤษ 60 วินาที', script);
      finish(n / 4, `ผ่านเกณฑ์ ${n}/4 ข้อ`);
    };
  };
})();

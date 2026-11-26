/*
 * lesson-kit.js — บทเรียนก่อนเล่น: ภาพประกอบ + ตัวอย่างทีละขั้นจากง่ายไปยาก (Claude)
 * ตัวช่วยภาพ (M.LV) คืนค่าเป็นสตริง HTML ไม่แตะ DOM → tools/check.js โหลดตรวจได้
 * ตัวเล่นบทเรียน M.playLesson(el, steps, done) ใช้ DOM เฉพาะตอนเรียก
 *
 * ชนิดขั้น (step):
 *   { type:'say',    text, visual }                         อ่านและดูภาพ
 *   { type:'reveal', text, visual, parts:[{btn, html}] }      แตะเปิดทีละส่วน (ตัวอย่างทำให้ดู)
 *   { type:'try',    text, visual, ask, answer, unit, hints:[], explain }   ลองคำนวณเอง มีคำใบ้
 *   { type:'pick',   text, visual, ask, options, answer, explain }          เลือกคำตอบ
 *   ทุกชนิดใส่ say:'English sentence' เพื่อมีปุ่ม 🔊 ได้ · level: 'ง่าย'|'กลาง'|'ของจริง'
 */
(function () {
  const M = (window.MTL = window.MTL || {});
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const spr = (key) => (typeof window !== 'undefined' && window.MTL_SPRITE_MANIFEST || {})[key];
  const num = (n) => (Math.round(n * 100) / 100).toLocaleString('th-TH', { maximumFractionDigits: 2 });

  const LV = (M.LV = {
    num,
    itemKey: (P) => `item_${P.id}_${P.id === 'water' ? 'big' : 'small'}`,
    /** สินค้า n ชิ้น (ภาพ Blender หรืออีโมจิ) */
    items(P, n, opt = {}) {
      const src = spr(LV.itemKey(P)), em = P.emoji ? P.emoji[P.id === 'water' ? 'big' : 'small'] : '📦';
      const one = src ? `<img class="lv-item" src="${src}" alt="">` : `<span class="lv-item e">${em}</span>`;
      const cls = opt.faded ? ' faded' : '';
      return `<span class="lv-items${cls}">${one.repeat(Math.max(0, n))}</span>`;
    },
    /** ชุดโปร 2 ชิ้นในกรอบ + ชิ้นเดี่ยว */
    bundles(P, sets, singles = 0, price) {
      const set = `<span class="lv-set">${LV.items(P, 2)}${price != null ? `<em>${num(price)}฿</em>` : ''}</span>`;
      return `<span class="lv-bundles">${set.repeat(sets)}${singles ? `<span class="lv-single">${LV.items(P, singles)}</span>` : ''}</span>`;
    },
    tag(text, kind = '') { return `<span class="lv-tag ${kind}">${esc(text)}</span>`; },
    /** แถบเงินแนวนอน: parts [{v, label, cls:'cost'|'profit'|'sign'|'loss'|'sales'}] สเกลเดียวกันด้วย max */
    bar(title, parts, max) {
      const tot = parts.reduce((a, p) => a + Math.max(0, p.v), 0);
      const m = max || tot || 1;
      return `<div class="lv-bar"><span class="t">${esc(title)}</span><span class="track">${parts.map((p) =>
        `<i class="${p.cls || ''}" style="width:${(Math.max(0, p.v) / m) * 100}%" title="${esc(p.label)}"><b>${esc(p.label)}</b></i>`).join('')}</span></div>`;
    },
    /** ฉากร้านย่อ: ชั้นวาง เคาน์เตอร์ ลูกค้า ป้าย ฝน เวลา */
    scene(P, o = {}) {
      const shelf = spr('shelf'), counter = spr('counter');
      const cust = (o.customers ?? 2);
      const people = Array.from({ length: cust }, (_, i) => {
        const s = spr(`customer_${(i % 5) + 1}`);
        return s ? `<img class="lv-cust" style="left:${30 + i * 13}%" src="${s}" alt="">` : `<span class="lv-cust e" style="left:${30 + i * 13}%">🧑</span>`;
      }).join('');
      return `<div class="lv-scene${o.rain ? ' rain' : ''}">
        ${shelf ? `<img class="lv-shelf" src="${shelf}" alt="">` : '<span class="lv-shelf e">🗄️</span>'}
        <span class="lv-shelf-items">${LV.items(P, 4)}</span>
        ${o.sign ? `<span class="lv-sign">${esc(o.sign)}</span>` : ''}
        ${counter ? `<img class="lv-counter" src="${counter}" alt="">` : '<span class="lv-counter e">🧾</span>'}
        ${people}
        ${o.clock ? `<span class="lv-clock">🕔 ${esc(o.clock)}</span>` : ''}
        ${o.bubble ? `<span class="lv-bubble" style="left:${30 + ((o.bubbleAt ?? 0) * 13)}%">${esc(o.bubble)}</span>` : ''}
        ${o.label ? `<span class="lv-label">${esc(o.label)}</span>` : ''}
      </div>`;
    },
    /** สมุดจด: rows [[หัว, ค่า]] */
    note(title, rows) {
      return `<div class="lv-note"><b>📒 ${esc(title)}</b>${rows.map(([k, v]) => `<div class="r"><span>${esc(k)}</span><span>${v}</span></div>`).join('')}</div>`;
    },
    /** ใบเสร็จ: lines [[รายการ, จำนวนเงิน]] */
    receipt(title, lines, total, totalLabel = 'รวม') {
      return `<div class="lv-receipt"><b>${esc(title)}</b>${lines.map(([k, v]) => `<div class="r"><span>${esc(k)}</span><span>${v}</span></div>`).join('')}
        <div class="r tot"><span>${esc(totalLabel)}</span><span>${total}</span></div></div>`;
    },
    /** เอกสารกระดาษ */
    doc(title, sub, use, stamp) {
      return `<div class="lv-doc"><div class="h">${esc(title)}</div><div class="s">${esc(sub)}</div><div class="lines"><i></i><i></i><i></i></div>
        ${stamp ? `<span class="stamp">${esc(stamp)}</span>` : ''}<div class="u">ใช้เมื่อ: ${esc(use)}</div></div>`;
    },
    /** สองฝั่งเทียบกัน */
    vs(a, b, la = 'วันปกติ', lb = 'วันโปร') {
      return `<div class="lv-vs"><div><h5>${esc(la)}</h5>${a}</div><div class="mid">เทียบ</div><div><h5>${esc(lb)}</h5>${b}</div></div>`;
    },
    /** ก้อนเงินเติมเป้าหมาย: เป้า target · ก้อนละ step · แสดงว่าต้องกี่ก้อน */
    fill(target, step, unit = 'ชุด') {
      const n = step > 0 ? Math.ceil(target / step) : 0;
      const blocks = Array.from({ length: n }, (_, i) => {
        const got = Math.min(step, target - i * step);
        return `<i style="flex:${step}" class="${got < step ? 'part' : ''}">${unit} ${i + 1}<br>+${num(step)}</i>`;
      }).join('');
      return `<div class="lv-fill"><div class="goal" style="width:${n ? (target / (n * step)) * 100 : 100}%">เป้า ${num(target)} บาท</div><div class="blocks">${blocks}</div>
        <div class="muted">ต้องขาย <b>${n} ${unit}</b>${n * step > target ? ` (ก้อนสุดท้ายเกินเป้า เพราะขายครึ่ง${unit}ไม่ได้)` : ''}</div></div>`;
    },
    light(kind, text) { return `<div class="lv-light ${kind}"><span class="dot"></span>${text}</div>`; },
    eq(html) { return `<div class="lv-eq">${html}</div>`; },
  });

  // ---------- ตัวเล่นบทเรียน ----------
  const THAI = '๐๑๒๓๔๕๖๗๘๙';
  const parse = (v) => { const s = String(v).trim().replace(/[๐-๙]/g, (c) => THAI.indexOf(c)).replace(/[,\s]/g, '').replace(/[−–]/g, '-'); return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN; };

  M.playLesson = (el, steps, done, opt = {}) => {
    const { $, $$, sfx } = M;
    let i = 0;
    const show = () => {
      const s = steps[i], last = i === steps.length - 1;
      const dots = steps.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`).join('');
      el.innerHTML = `<div class="lesson card">
        <div class="lesson-top"><b>📖 บทเรียน</b>${s.level ? `<span class="lv-level ${s.level === 'ง่าย' ? 'e' : s.level === 'กลาง' ? 'm' : 'r'}">${esc(s.level)}</span>` : ''}
          <span class="dots">${dots}</span><span class="muted">${i + 1}/${steps.length}</span></div>
        <div class="mentor"><span class="avatar">🧑‍💼</span><div class="say-b">${s.text}${s.say ? ` <button class="sayit" title="ฟัง">🔊</button>` : ''}</div></div>
        ${s.visual ? `<div class="lv-visual">${s.visual}</div>` : ''}
        <div class="lv-act"></div>
        <div class="row lesson-nav"><button class="btn ghost small prev" ${i ? '' : 'disabled'}>← ย้อน</button>
          <button class="btn primary nx">${last ? (opt.finishLabel || 'เข้าใจแล้ว ไปลงมือ →') : 'ต่อไป →'}</button>
          ${opt.canSkip ? '<button class="btn ghost small skip">ข้ามบทเรียน</button>' : ''}</div></div>`;
      const act = $('.lv-act', el), nx = $('.nx', el);
      const say = $('.sayit', el); if (say) say.onclick = () => M.speak(s.say);
      $('.prev', el).onclick = () => { if (i > 0) { i--; sfx.play('click'); show(); } };
      const skip = $('.skip', el); if (skip) skip.onclick = () => { sfx.play('click'); done(true); };
      nx.onclick = () => { sfx.play('click'); if (last) done(false); else { i++; show(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
      const lock = (on) => { nx.disabled = on; };

      if (s.type === 'reveal') {
        let k = 0;
        lock(true);
        const step = () => {
          if (k >= s.parts.length) { lock(false); return; }
          act.insertAdjacentHTML('beforeend', `<button class="btn lv-rev">👆 ${esc(s.parts[k].btn)}</button>`);
          $('.lv-rev', act).onclick = (e) => {
            sfx.play('note'); e.target.remove();
            act.insertAdjacentHTML('beforeend', `<div class="lv-part pop-in">${s.parts[k].html}</div>`);
            k++; step();
          };
        };
        step();
      }
      if (s.type === 'try') {
        lock(true);
        let miss = 0;
        act.innerHTML = `<div class="lv-try"><div class="q">✏️ ${s.ask}</div>
          <div class="row"><input class="ans" inputmode="decimal" placeholder="?"><span class="muted">${esc(s.unit || '')}</span><button class="btn primary ck">ตรวจ</button></div>
          <div class="fb"></div></div>`;
        const inp = $('.ans', act), fb = $('.fb', act);
        const reveal = (good) => {
          inp.disabled = true; $('.ck', act).disabled = true; lock(false);
          fb.innerHTML = `<div class="msg ${good ? 'ok' : ''}">${good ? '✅ <b>ถูกต้อง!</b>' : `💡 คำตอบคือ <b>${num(s.answer)} ${esc(s.unit || '')}</b>`}<br>${s.explain || ''}</div>`;
        };
        const check = () => {
          const v = parse(inp.value);
          if (!Number.isFinite(v)) { fb.innerHTML = '<div class="msg">ใส่เป็นตัวเลขนะ</div>'; return; }
          if (Math.abs(v - s.answer) < 0.005) { sfx.play('correct'); reveal(true); return; }
          sfx.play('wrong'); miss++;
          const h = (s.hints || [])[miss - 1];
          if (h) fb.innerHTML = `<div class="msg">❌ ยังไม่ใช่ — คำใบ้ ${miss}: ${h}</div>`;
          else reveal(false);
        };
        $('.ck', act).onclick = check;
        inp.onkeydown = (e) => { if (e.key === 'Enter') check(); };
      }
      if (s.type === 'pick') {
        lock(true);
        act.innerHTML = `<div class="lv-try"><div class="q">👉 ${s.ask}</div><div class="opts">${s.options.map((o, k) => `<button class="opt" data-k="${k}">${o}</button>`).join('')}</div><div class="fb"></div></div>`;
        $$('.opt', act).forEach((b) => (b.onclick = () => {
          const ok = +b.dataset.k === s.answer;
          sfx.play(ok ? 'correct' : 'wrong');
          b.classList.add(ok ? 'right' : 'bad'); b.disabled = true;
          if (ok) { $$('.opt', act).forEach((x) => (x.disabled = true)); lock(false); }
          $('.fb', act).innerHTML = `<div class="msg ${ok ? 'ok' : ''}">${ok ? '✅ <b>ใช่เลย!</b> ' : '❌ ลองใหม่อีกที — '}${ok ? s.explain || '' : (s.why && s.why[+b.dataset.k]) || 'ดูภาพอีกครั้ง'}</div>`;
        }));
      }
    };
    show();
  };
})();

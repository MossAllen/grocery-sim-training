/* w4r3-walk.js — W4R3 ทดลองโปรในร้านแบบเดิน (handoff/2026-11-28_gpt-to-claude_w4r3-walk.md)
 * จุดหลักฐาน 3 จุด: ป้ายราคา → สต็อก → เคาน์เตอร์ · ผลทั้งหมดมาจาก PromoModel.simulatePair ผ่าน M.W4.runSetup
 * ใบสรุป คำถาม 3 ข้อ และการบันทึกใช้ M.W4.runSummary ชุดเดียวกับแบบเดิม ผลและคะแนนจึงตรงกันทุกทาง */
(function () {
  const M = window.MTL;
  const { $, $$, esc, sfx } = M;
  const START = { x: 0, z: 2.3, yaw: 0 };
  const MINUTE_SECONDS = 0.45;     // วินาทีจริงต่อ 1 นาทีในเกม (30 นาที ≈ 14 วินาที)
  const WALK_SPEED = 2.6, STRIDE_LENGTH = 1.1;
  const POINTS = [
    { id: 'w4r3-sign', station: 'a', place: 'ป้ายราคาชั้น A', go: { x: -3.25, z: 4.3 } },
    { id: 'w4r3-stock', station: 'b', place: 'สต็อกชั้น B', go: { x: 0, z: 4.3 } },
    { id: 'w4r3-counter', station: 'checkout', place: 'เคาน์เตอร์', go: { x: 3.25, z: 4.3 } },
  ];

  M.playW4R3Walk = (el, ctx, finish, classic) => {
    const W4 = M.W4, bt = W4.bt, T = W4.T;
    const setup = W4.runSetup(ctx);
    if (setup.blocked) return W4.blockedRun(el, ctx, setup.b);
    const { pm, b, p, B, F, pair, r, practice } = setup;
    const unit = ctx.product.unit, sprites = window.MTL_SPRITE_MANIFEST || {};
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startMinute = pair.slot === 'am' ? 9 * 60 : 17 * 60;
    const clockText = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const outLo = Math.floor(T / 3), outHi = Math.ceil((2 * T) / 3);
    const rows = new Map();
    let signUp = false, periodDone = false, running = false, closed = false, minute = 0, frame = 0;
    const tally = { entered: 0, units: 0, sets: 0, singles: 0, sales: 0, stock: pair.K1 };

    el.innerHTML = `<section class="w4r3-walk" aria-label="ภารกิจทดลองโปรในร้าน">
      <div class="walk-brief"><p><strong>ภารกิจ</strong> ติดป้ายโปรตามแผน ดูลูกค้าช่วงโปร ${T} นาที จดสต็อก แล้วเปิดใบสรุปที่เคาน์เตอร์เพื่อตัดสินใจ</p>
        <button type="button" class="btn small ghost" data-walk-classic>เล่นแบบเดิม</button></div>
      <p class="ow-example">${W4.runIntro(setup)}</p>
      <div class="ow-hud" role="group" aria-label="สถานะช่วงโปร"><span class="ow-tag">${practice ? 'โจทย์ฝึก · จำลอง' : 'จำลอง'}</span>
        <span>ช่วงโปร</span><b class="ow-clock" data-w4-clock>${clockText(startMinute)}</b>
        <span>ลูกค้า <b data-w4-entered>0</b></span><span>ขาย <b data-w4-units>0</b> ${esc(unit)} (<b data-w4-sets>0</b> ชุด)</span>
        <span>ยอด <b data-w4-sales>0.00</b> บาท</span><span>สต็อก <b data-w4-stock>${pair.K1}</b></span></div>
      <div class="walk-world"><div class="ow-stage"><div class="walk-viewport" tabindex="0" role="region"
          aria-label="ร้านมุมมองบุคคลที่หนึ่ง ใช้ลูกศรหรือ WASD เดิน Q หรือ R หัน และ E ทำงานที่จุดตรงหน้า">
        <canvas width="960" height="540" aria-hidden="true"></canvas><span class="walk-reticle" aria-hidden="true">+</span></div>
        <div class="ow-caption" aria-live="polite" aria-atomic="true"></div></div>
        <div class="walk-controls">${M.WalkControls.pad()}
          <div class="walk-act"><button type="button" class="btn primary" data-w4-action disabled>เข้าใกล้ป้าย สต็อก หรือเคาน์เตอร์</button>
            <div class="row ow-actions"><button type="button" class="btn" data-w4-start disabled>▶ เริ่มช่วงโปร ${T} นาที</button>
            <button type="button" class="btn ghost" data-w4-skip disabled>⏩ ข้ามไปดูผล</button></div>
            <small class="muted">ลูกศร / WASD เดิน · Q/R หัน · E ทำงานที่จุดตรงหน้า</small></div></div>
        <p class="walk-hint"></p>
        <div class="w4-panel" data-w4-panel></div>
        <section class="ow-list" aria-labelledby="w4-list-title"><h3 id="w4-list-title">จุดเก็บหลักฐาน</h3><ul></ul></section>
        <section class="walk-notebook" aria-labelledby="w4-book-title"><h3 id="w4-book-title">สมุดหลักฐาน</h3>
          <table class="tbl ow-book"><thead><tr><th scope="col">จุด</th><th scope="col">สิ่งที่จด</th></tr></thead><tbody></tbody></table></section>
      </div><section class="w4-summary hidden" aria-label="ใบสรุปคู่ช่วง"></section></section>`;

    const viewport = $('.walk-viewport', el), caption = $('.ow-caption', el), hint = $('.walk-hint', el);
    const action = $('[data-w4-action]', el), startBtn = $('[data-w4-start]', el), skipBtn = $('[data-w4-skip]', el);
    const panel = $('[data-w4-panel]', el), world = $('.walk-world', el), summary = $('.w4-summary', el);
    $('[data-walk-classic]', el).onclick = classic;

    const sign = { id: 'a', price: bt(pm.P), sizeText: pm.p.name, icon: ctx.product.emoji.small, sprite: sprites[`item_${ctx.product.id}_small`] };
    const stockShelf = { id: 'b', price: null, sizeText: `สต็อก ${pair.K1} ${unit}`, icon: '📦', sprite: sprites[`item_${ctx.product.id}_big`] };
    const scene = M.ShelfWalkScene.create($('canvas', viewport), { stations: [sign, stockShelf, { id: 'checkout' }], start: START, actors: [] });
    let controls = null;
    if (scene) {
      controls = M.WalkControls.attach({ root: el, viewport, scene, onMove: update, onInteract: () => { if (!action.disabled) act(currentPoint()); } });
    } else {
      $('.ow-stage', el).classList.add('hidden');
      hint.textContent = 'เครื่องนี้เปิดฉากร้านไม่ได้ ใช้ปุ่มจุดเก็บหลักฐานด้านล่างได้ครบทุกขั้น';
    }
    M.onLeave = () => { closed = true; cancelAnimationFrame(frame); controls?.destroy(); M.sfx.stopBgm(); };
    action.onclick = () => act(currentPoint());
    startBtn.onclick = startPeriod;
    skipBtn.onclick = endPeriod;
    fillList();
    fillBook();
    update();
    if (scene) viewport.focus({ preventScroll: true });

    // ---------- จุดหลักฐานและสถานะ ----------
    function currentPoint() {
      if (!scene) return null;
      const id = scene.target();
      return POINTS.find((point) => point.station === id) || null;
    }
    // จุดนี้ทำอะไรได้ตอนนี้ · คืนข้อความปุ่มและเหตุผลเมื่อยังทำไม่ได้
    function stateOf(point) {
      if (rows.has(point.id)) return { label: `${point.place} · จดแล้ว`, ready: true };
      if (point.id === 'w4r3-sign') return { label: 'อ่านป้ายเดิมและติดป้ายโปร', ready: true };
      if (point.id === 'w4r3-stock') return periodDone ? { label: 'จดสต็อกทั้งสองช่วง', ready: true } : { label: 'จบช่วงโปรก่อนจดสต็อก', ready: false };
      return rows.has('w4r3-stock') ? { label: 'เปิดใบสรุปคู่ช่วง', ready: true } : { label: 'จดสต็อกก่อนเปิดใบสรุป', ready: false };
    }
    function update() {
      const point = currentPoint();
      viewport.dataset.target = point ? point.id : '';
      const state = point && stateOf(point);
      action.disabled = !point;
      action.dataset.target = point ? point.id : '';
      action.textContent = point ? state.label : 'เข้าใกล้ป้าย สต็อก หรือเคาน์เตอร์';
      startBtn.disabled = !signUp || running || periodDone;
      skipBtn.disabled = !running;
      const next = POINTS.find((entry) => !rows.has(entry.id));
      hint.textContent = !signUp ? 'เดินไปชั้น A (ซ้าย) อ่านป้ายเดิมแล้วติดป้ายโปร' :
        !periodDone ? (running ? 'ลูกค้ากำลังเข้าร้าน ดูการหยิบและการจ่าย หรือกดข้ามไปดูผล' : 'ติดป้ายแล้ว กด “เริ่มช่วงโปร”') :
        next ? `ช่วงโปรจบแล้ว ไปที่${next.place}` : 'เก็บหลักฐานครบแล้ว';
    }
    function fillList() {
      $('.ow-list ul', el).innerHTML = POINTS.map((point) => {
        const state = stateOf(point);
        return `<li><button type="button" class="btn small" data-w4-go="${point.id}">ไปที่${esc(point.place)}</button>
          <span class="ow-state">${rows.has(point.id) ? '✓ จดแล้ว' : state.ready ? '! พร้อมจด' : esc(state.label)}</span></li>`;
      }).join('');
      for (const button of $$('[data-w4-go]', el)) button.onclick = () => goTo(POINTS.find((point) => point.id === button.dataset.w4Go));
    }
    function fillBook(flash) {
      $('.ow-book tbody', el).innerHTML = POINTS.filter((point) => rows.has(point.id)).map((point) =>
        `<tr data-row="${point.id}"${point.id === flash ? ' class="ow-flash"' : ''}><th scope="row">${esc(point.place)}</th><td>${esc(rows.get(point.id))}</td></tr>`).join('') ||
        '<tr><td colspan="2" class="muted">ยังไม่มีแถว เริ่มที่ป้ายราคาชั้น A</td></tr>';
    }
    function note(point, text) {
      const added = !rows.has(point.id);
      if (added) { rows.set(point.id, text); sfx.play('notebook'); }
      fillBook(point.id);
      fillList();
      update();
      caption.textContent = added ? `📝 จดแล้ว · ${point.place}` : `📒 จุดนี้จดแล้ว · ${point.place}`;
    }
    // ปุ่มรายการพาไปยืนหน้าจุด หรือทำงานที่จุดทันทีเมื่อเปิดฉากเดินไม่ได้
    function goTo(point) {
      if (!scene) return act(point);
      scene.place({ x: point.go.x, z: point.go.z, yaw: 0 });
      scene.draw();
      update();
      action.focus({ preventScroll: true });
    }

    // ---------- งานที่แต่ละจุด ----------
    function act(point) {
      if (!point || closed) return;
      const state = stateOf(point);
      if (rows.has(point.id)) return note(point, rows.get(point.id));
      if (!state.ready) { caption.textContent = state.label; return; }
      if (point.id === 'w4r3-sign') return signPanel(point);
      if (point.id === 'w4r3-stock') return note(point, stockText());
      return openSummary(point);
    }

    function signPanel(point) {
      panel.innerHTML = `<div class="calc-intro w4-sign" role="group" aria-label="ป้ายราคา"><b>ป้ายเดิม</b> ${esc(pm.p.name)} ${bt(pm.P)} บาท/${esc(unit)}<br>
        <b>ป้ายใหม่ตามแผน</b> โปร 2 ชิ้น <b>${bt(B)}</b> บาท · ซื้อเดี่ยว ${bt(pm.P)} บาท · ค่าทำโปร ${bt(F)} บาท ${W4.LBL.plan}
        ${p ? '' : '<br><span class="warn">ยังไม่มีแผนจากรอบ 2 ใช้ราคาชุดตั้งต้น ถ้าต้องการเปลี่ยนตัวเลขให้กลับไปบันทึกแผนรอบ 2 ก่อน</span>'}
        <div class="row"><button type="button" class="btn primary" data-w4-sign>ยืนยันติดป้ายใหม่</button></div></div>`;
      const confirm = $('[data-w4-sign]', panel);
      confirm.onclick = () => {
        signUp = true;
        sign.price = bt(B);
        sign.sizeText = `โปร 2 ชิ้น · เดี่ยว ${bt(pm.P)}`;
        scene?.draw();
        panel.innerHTML = '';
        sfx.play('shelf_pick');
        note(point, `ป้ายเดิม ${bt(pm.P)} บาท/ชิ้น → โปร 2 ชิ้น ${bt(B)} บาท · เดี่ยว ${bt(pm.P)} บาท · ค่าทำโปร ${bt(F)} บาท`);
        startBtn.focus({ preventScroll: true });
      };
      confirm.focus({ preventScroll: true });
    }

    const stockText = () => {
      const events = [];
      if (pair.event === 'shelfOut') events.push(`${clockText(startMinute + outLo)}–${clockText(startMinute + outHi)} ของหน้าชั้นหมดชั่วคราว ขายไม่ได้ ${r.lostEvent} ${unit}`);
      else if (pair.event !== 'none') events.push(`${M.PromoModel.EVENTS[pair.event].th} ทั้งสองช่วง`);
      if (r.lostStock) events.push(`สต็อกไม่พอ ขาด ${r.lostStock} ${unit}`);
      return `เปิดช่วง ปกติ ${pair.K0} · โปร ${pair.K1} ${unit} | เหลือ ปกติ ${pair.normal.stockLeft} · โปร ${r.stockLeft} ${unit} | เหตุการณ์: ${events.join(' · ') || 'ไม่มีเหตุการณ์'}`;
    };

    function openSummary(point) {
      const R0 = b.N0 * pm.P, R1 = r.S * B + r.U * pm.P;
      note(point, `ปกติ ${b.N0} ${unit} ยอด ${bt(R0)} บาท | โปร ${r.S} ชุด + ${r.U} เดี่ยว = ${2 * r.S + r.U} ${unit} ยอด ${bt(R1)} บาท | นับ ${clockText(startMinute)}–${clockText(startMinute + T)} หน่วยบาท · ฐาน ${b.id} · แผน ${p ? p.id : 'ตั้งต้น'}`);
      cancelAnimationFrame(frame);
      controls?.destroy();
      world.classList.add('hidden');
      summary.classList.remove('hidden');
      summary.innerHTML = '<h3 tabindex="-1">ใบสรุปคู่ช่วงที่เคาน์เตอร์</h3><div class="after"></div>';
      const evidence = POINTS.map((entry) => ({ id: entry.id, text: rows.get(entry.id) }));
      W4.runSummary($('.after', summary), ctx, setup, finish, { route: 'walk', evidence });
      const heading = $('h3', summary);
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: 'start' });
    }

    // ---------- ช่วงโปร 30 นาที: ลูกค้าจากรายการขายของแบบจำลอง ----------
    const paint = () => {
      $('[data-w4-entered]', el).textContent = tally.entered;
      $('[data-w4-units]', el).textContent = tally.units;
      $('[data-w4-sets]', el).textContent = tally.sets;
      $('[data-w4-sales]', el).textContent = bt(tally.sales);
      $('[data-w4-stock]', el).textContent = tally.stock;
      $('[data-w4-clock]', el).textContent = clockText(startMinute + Math.min(T, Math.floor(minute)));
    };
    // ขายเมื่อถึงเคาน์เตอร์ ครั้งเดียวต่อรายการ
    const checkout = (rec) => {
      if (rec.counted) return;
      rec.counted = true;
      const got = rec.sets * 2 + rec.singles;
      if (!got) return;
      tally.units += got; tally.sets += rec.sets; tally.singles += rec.singles;
      tally.sales += rec.sets * B + rec.singles * pm.P; tally.stock -= got;
      sfx.play('scanner');
      paint();
    };

    function startPeriod() {
      if (!signUp || running || periodDone) return;
      running = true;
      update();
      sfx.play('door');
      if (reducedMotion || !scene) return endPeriod();
      M.sfx.startBgm();
      const queue = r.sales.map((rec, i) => ({ ...rec, i }));
      let last = 0;
      const tick = (now) => {
        if (closed || !running) return;
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
        last = now;
        minute += dt / MINUTE_SECONDS;
        // ลูกค้าเข้าร้านตามนาทีของแบบจำลอง
        while (queue.length && queue[0].minute <= minute) spawn(queue.shift());
        // หน้าชั้นหมดชั่วคราวช่วงกลางเวลา (GDD §5)
        const out = pair.event === 'shelfOut' && minute >= outLo && minute < outHi;
        stockShelf.sizeText = out ? 'หน้าชั้นหมดชั่วคราว' : `สต็อก ${tally.stock} ${unit}`;
        moveActors(dt, now / 1000);
        scene.draw();
        paint();
        if (minute >= T && !queue.length && !scene.actors.length) return endPeriod();
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    function spawn(rec) {
      const sprite = W4.GROUP_SPRITE[rec.group] || 'customer_5';
      const jitter = ((rec.i * 37) % 7 - 3) * 0.12;
      scene.actors.push({
        id: `c${rec.i}`, rec, x: -5.8, z: 4.5 + jitter * 0.5, sprite: sprites[sprite], walkSprite: sprites[`${sprite}_walk`] || sprites[sprite],
        standSprite: sprites[sprite], bubble: null, path: [
          { x: -3.25 + jitter, z: 5.95, wait: 0.35, at: 'shelf' },
          { x: 2.8 + jitter, z: 5.75, wait: 0.3, at: 'counter' },
          { x: 6.0, z: 3.4, at: 'exit' },
        ], wait: 0, walked: 0, motion: { puffs: [] },
      });
      tally.entered++;
    }

    function moveActors(dt, seconds) {
      for (const actor of scene.actors.slice()) {
        const motion = actor.motion;
        motion.puffs = motion.puffs.filter((puff) => (puff.age += dt) < 0.5);
        if (actor.wait > 0) {
          actor.wait -= dt;
          actor.sprite = actor.standSprite;
          Object.assign(motion, { flip: false, lift: 0, sx: 1, sy: M.StudMotion.idle(seconds, actor.rec.i), sparkle: 0 });
          continue;
        }
        const goal = actor.path[0];
        const dx = goal.x - actor.x, dz = goal.z - actor.z, distance = Math.hypot(dx, dz), move = WALK_SPEED * dt;
        actor.walked += Math.min(distance, move);
        if (distance <= move) {
          actor.x = goal.x; actor.z = goal.z;
          actor.path.shift();
          actor.wait = goal.wait || 0;
          if (goal.at === 'shelf') {
            const got = actor.rec.sets * 2 + actor.rec.singles;
            actor.bubble = actor.rec.note === 'shelfOut' ? '✗' : got ? (actor.rec.sets ? '2' : '1') : '…';
            actor.bubbleColor = got ? '#cdeccf' : '#f3d6cf';
            if (got) sfx.play('shelf_pick');
          } else if (goal.at === 'counter') checkout(actor.rec);
          if (!actor.path.length) scene.actors.splice(scene.actors.indexOf(actor), 1);
          continue;
        }
        actor.x += dx / distance * move;
        actor.z += dz / distance * move;
        const step = M.StudMotion.walk(actor.walked, STRIDE_LENGTH);
        actor.sprite = step.frame === 'walk' ? actor.walkSprite : actor.standSprite;
        if (step.step !== motion.step) motion.puffs.push({ age: 0, side: step.step ? 1 : -1 });
        Object.assign(motion, { step: step.step, flip: step.flip, lift: step.lift, sx: 1, sy: step.squash, sparkle: 0 });
      }
    }

    // จบหรือกดข้าม: ใช้ยอดจากแบบจำลองเป็นหลักเหมือนแบบเดิม
    function endPeriod() {
      if (periodDone) return;
      cancelAnimationFrame(frame);
      running = false; periodDone = true; minute = T;
      M.sfx.stopBgm();
      if (scene) scene.actors.splice(0, scene.actors.length);
      Object.assign(tally, { entered: r.customers, units: r.N, sets: r.S, singles: r.U, sales: r.S * B + r.U * pm.P, stock: r.stockLeft });
      stockShelf.sizeText = `เหลือ ${r.stockLeft} ${unit}`;
      scene?.draw();
      paint();
      sfx.play('levelup');
      caption.textContent = `ช่วงโปรจบ ${clockText(startMinute + T)} · ขาย ${r.N} ${unit} (${r.S} ชุด + ${r.U} เดี่ยว) · ไปจดสต็อกที่ชั้น B`;
      fillList();
      update();
    }
  };
})();

/*
 * limit-desk.js — โต๊ะคำสั่ง Limit จำลอง W5R5 (GDD §8) หน้าจอและการบันทึก
 * เปิดก่อนคำถามเดิมของรอบ: อ่านบัตรกติกา ส่ง Limit ซื้อด้วยเงินสมมติ 3 ภารกิจ (ง่าย → ยาก)
 * เดินเวลาดูสถานะรอ จับคู่บางส่วน จับคู่ครบ หรือสิ้นสุด แล้วอธิบายเหตุผลก่อนบันทึกลงแฟ้มผลงานสัปดาห์ 5
 * โต๊ะนี้ไม่นับดาว ดาวมาจากคำถามเดิม 4 ข้อ (M.engines.mcq) ผ่าน finish ตัวเดียวกับทุกรอบ
 * ข้อมูลและกติกาตรวจอยู่ใน js/limit-desk-model.js
 */
(function () {
  const M = window.MTL;
  const D = M.LimitDeskModel;
  if (!D) return; // โมเดลโหลดไม่ได้: ไม่ลงทะเบียนโต๊ะ รอบนี้จึงเล่นคำถามเดิม
  const { $, $$, esc, sfx, State } = M;

  const radios = (name, legend, options, errorId) => `<fieldset class="ld-group" aria-describedby="${errorId}"><legend>${legend}</legend>
    ${options.map(([value, label]) => `<label class="ld-opt"><input type="radio" name="${name}" value="${esc(value)}"><span>${esc(label)}</span></label>`).join('')}
    <small class="err" id="${errorId}" aria-live="polite"></small></fieldset>`;
  const picked = (root, name) => $(`input[name="${name}"]:checked`, root)?.value || '';
  const chip = (status) => `<span class="ld-chip ld-${status}">${esc(D.STATUS[status])}</span>`;

  // ---------- บัตรกติกา ----------
  function rulesHtml(company) {
    return `<h4 id="ld-rules-h">📋 บัตรกติกา · ${esc(company.name)} (${esc(company.code)})</h4>
      <p class="muted">${esc(company.business)} · บริษัทสมมติ ไม่ใช่บริษัทจริง</p>
      <dl class="ld-rules">
        <dt>ราคาปิดวันก่อน</dt><dd>${D.price(D.PREV_CLOSE)} บาท</dd>
        <dt>กรอบราคาของวัน</dt><dd>${D.price(D.BAND.floor)}–${D.price(D.BAND.ceiling)} บาท (±${D.BAND_PCT}% จากราคาปิดวันก่อน)</dd>
        <dt>ช่วงราคา</dt><dd>${D.TICKS.map((t) => esc(t.label)).join('<br>')}</dd>
        <dt>หน่วยซื้อขาย</dt><dd>${D.LOT} หุ้น (ส่งได้ 100, 200, 300 …)</dd>
        <dt>เวลา</dt><dd>${esc(D.SESSION.label)}</dd>
      </dl>
      <p class="warn" role="note">ตัวเลขในบัตรนี้เป็น<b>${esc(D.PRACTICE)}</b> ไม่ใช่ค่าปัจจุบันของตลาด ให้ตรวจค่าจริงจากเว็บ SET แล้วจดพร้อมวันที่ตรวจ</p>
      <details class="ld-set"><summary>จดค่าจริงจากเว็บ SET (ไม่บังคับ)</summary>
        <ul>${D.LINKS.map((link) => `<li><a href="${esc(link.url)}" target="_blank" rel="noopener">${esc(link.label)}</a></li>`).join('')}</ul>
        <div class="ld-set-form">
          <label for="ld-set-date">วันที่ตรวจ</label><input id="ld-set-date" type="date" aria-describedby="ld-set-err">
          ${D.SET_FIELDS.map((field) => `<label for="ld-set-${field.id}">${esc(field.label)}</label><input id="ld-set-${field.id}" type="text" maxlength="80" autocomplete="off" aria-describedby="ld-set-err">`).join('')}
          <small class="err" id="ld-set-err" aria-live="polite"></small>
        </div></details>`;
  }

  // ---------- กระดานคำสั่ง ----------
  function boardHtml(board, mine, label) {
    const bids = board.bids.slice(0, 4), asks = board.asks.slice(0, 4), n = Math.max(bids.length, asks.length, 1);
    // ช่องละหนึ่งระดับราคา: ราคา (บาท) และจำนวนหุ้นที่รออยู่ ให้พอดีจอ 320 พิกเซลโดยไม่ต้องเลื่อนข้าง
    const tag = (o) => o.mine ? '<small class="ld-mine">คำสั่งของคุณ</small>' : mine && o.early && o.price === mine.price ? '<small class="muted">ส่งก่อนคุณ</small>' : '';
    const cell = (o, side) => !o ? '<td></td>' : `<td class="${side}"><b>${D.price(o.price)}</b> <span class="ld-qty-cell">${D.count(o.qty)} หุ้น</span>${side === 'bid' ? tag(o) : ''}</td>`;
    const rows = Array.from({ length: n }, (_, i) => `<tr>${cell(bids[i], 'bid')}${cell(asks[i], 'ask')}</tr>`).join('');
    return `<div class="ld-board" role="region" tabindex="0" aria-label="${esc(label)}"><table class="tbl"><caption>${esc(label)} <small class="muted">(ตัวเลขจำลอง)</small></caption>
      <thead><tr><th scope="col">คนอยากซื้อ<small>ราคา (บาท) · จำนวน</small></th><th scope="col">คนอยากขาย<small>ราคา (บาท) · จำนวน</small></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }
  const startBoard = (mission) => ({
    bids: [...mission.bids].sort((a, b) => b.price - a.price).map((o) => ({ ...o, early: true })),
    asks: [...mission.asks].sort((a, b) => a.price - b.price),
  });

  function walletHtml(w, code) {
    return `<h4>💼 พอร์ตสมมติ</h4><p>เงินสด <b>${D.baht(w.cash)} บาท</b> · ถือ ${esc(code)} <b>${D.count(w.shares)} หุ้น</b>
      <small class="muted">(เริ่มต้น ${D.baht(w.cash0)} บาท · ยังไม่คิดค่าธรรมเนียมและภาษี)</small></p>`;
  }

  function run(el, round, ctx, finish) {
    const product = ctx.product;
    const company = D.companyOf(product.id);
    const runs = [];              // ภารกิจที่ผ่านแล้ว { missionId, attempts, result }
    const attempts = {};          // จำนวนครั้งที่ส่งคำสั่งของแต่ละภารกิจ
    let index = 0;
    const saved = ctx.state.portfolio?.[D.portfolioKey(product.id)];
    const savedNote = saved ? '<p class="muted ld-saved">เคยบันทึกใบงานโต๊ะนี้ไว้แล้ว บันทึกใหม่จะทับฉบับเดิม</p>' : '';

    el.innerHTML = `<section class="limit-desk" aria-labelledby="ld-title">
      <h3 id="ld-title">📈 โต๊ะคำสั่ง Limit จำลอง</h3>
      <p class="ld-safety" role="note">⚠️ ${esc(D.SAFETY)}</p>
      <p>ใช้เงินสมมติส่งคำสั่ง <b>Limit ซื้อ</b> หุ้นของบริษัทสมมติในธุรกิจ${esc(product.th)} 3 ภารกิจ จากง่ายไปยาก แล้วเดินเวลาดูว่าคำสั่ง<b>รอ จับคู่ หรือสิ้นสุด</b> ขั้นนี้<b>ไม่นับดาว</b> เมื่อครบจะบันทึกลงแฟ้มผลงานสัปดาห์ 5 แล้วไปทำคำถาม 4 ข้อ (นับดาวเหมือนเดิม) หรือข้ามไปทำคำถามเลยก็ได้</p>${savedNote}
      <section class="card ld-card" aria-labelledby="ld-rules-h">${rulesHtml(company)}</section>
      <section class="card ld-card ld-wallet" aria-live="polite"></section>
      <ol class="ld-steps" aria-label="ภารกิจ">${D.MISSIONS.map((m) => `<li data-m="${m.id}">ภารกิจ ${m.id} · ${esc(m.level)}</li>`).join('')}</ol>
      <section class="card ld-card ld-mission" aria-labelledby="ld-m-h"></section>
      <section class="card ld-card ld-final" aria-labelledby="ld-final-h" hidden>
        <h4 id="ld-final-h">สรุปก่อนบันทึก</h4>
        ${D.FINAL.map((item) => radios(`ld-final-${item.id}`, esc(item.q), item.options, `ld-final-${item.id}-err`)).join('')}
      </section>
      <div class="row ld-actions"><button type="button" class="btn primary ld-save" hidden>บันทึกลงแฟ้มผลงานและไปทำคำถาม</button><button type="button" class="btn ghost ld-skip">ข้ามโต๊ะนี้ ไปทำคำถามเลย</button></div>
      <p class="err ld-status" role="status" aria-live="polite"></p></section>`;

    const panel = $('.ld-mission', el);
    const status = (message, good) => {
      const box = $('.ld-status', el);
      box.textContent = message;
      box.classList.toggle('ld-ok', !!good);
    };
    const quiz = () => {
      el.scrollIntoView?.({ block: 'start' });
      M.engines[round.engine](el, round, ctx, finish);
    };
    const drawWallet = () => { $('.ld-wallet', el).innerHTML = walletHtml(D.wallet(runs), company.code); };
    const drawSteps = () => $$('.ld-steps li', el).forEach((li) => {
      const id = +li.dataset.m;
      li.classList.toggle('done', runs.some((r) => r.missionId === id));
      li.classList.toggle('now', D.MISSIONS[index]?.id === id);
      if (D.MISSIONS[index]?.id === id) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });

    // ---------- ภารกิจ: ตั้งคำสั่ง ----------
    function orderPhase() {
      const mission = D.MISSIONS[index];
      const cash = D.wallet(runs).cash;
      status('');
      drawSteps();
      panel.innerHTML = `<h4 id="ld-m-h">ภารกิจ ${mission.id} · ${esc(mission.title)} <span class="tag">${esc(mission.level)}</span></h4>
        <p class="muted">${esc(mission.day)} · เวลา ${esc(mission.submitAt)}</p>
        <p class="ld-story">${esc(mission.story)}</p>
        ${boardHtml(startBoard(mission), null, `กระดานคำสั่ง ${company.code} เวลา ${mission.submitAt}`)}
        <p class="ld-hint">💡 ${esc(mission.hint)}</p>
        <form class="ld-order" novalidate aria-label="ตั้งคำสั่ง Limit ซื้อ ภารกิจ ${mission.id}">
          <p>คำสั่ง: <b>Limit ซื้อ</b> หุ้น ${esc(company.code)}</p>
          <div class="ld-field"><label for="ld-price">ราคาสูงสุดที่ยอมจ่าย (บาทต่อหุ้น)</label>
            <div class="ld-stepper"><button type="button" class="btn small ld-price-down" aria-label="ลดราคาหนึ่งช่วงราคา">−</button>
              <input id="ld-price" type="text" inputmode="decimal" autocomplete="off" placeholder="เช่น ${D.price(mission.bids[0].price)}" aria-describedby="ld-price-err">
              <button type="button" class="btn small ld-price-up" aria-label="เพิ่มราคาหนึ่งช่วงราคา">+</button></div>
            <small class="err" id="ld-price-err" aria-live="polite"></small></div>
          <div class="ld-field"><label for="ld-qty">จำนวนหุ้น</label>
            <div class="ld-stepper"><button type="button" class="btn small ld-qty-down" aria-label="ลดจำนวน ${D.LOT} หุ้น">−</button>
              <input id="ld-qty" type="text" inputmode="numeric" autocomplete="off" placeholder="ทวีคูณของ ${D.LOT}" aria-describedby="ld-qty-err">
              <button type="button" class="btn small ld-qty-up" aria-label="เพิ่มจำนวน ${D.LOT} หุ้น">+</button></div>
            <small class="err" id="ld-qty-err" aria-live="polite"></small></div>
          <p class="ld-reserve muted" aria-live="polite">เงินในพอร์ต ${D.baht(cash)} บาท</p>
          <small class="err" id="ld-cash-err" aria-live="polite"></small>
          <div class="row"><button type="submit" class="btn primary ld-send">ส่งคำสั่งจำลอง</button></div>
        </form>`;
      const form = $('.ld-order', panel), priceIn = $('#ld-price', form), qtyIn = $('#ld-qty', form);
      const reserve = () => {
        const p = D.parsePrice(priceIn.value), q = D.parseQty(qtyIn.value);
        $('.ld-reserve', form).textContent = Number.isFinite(p) && Number.isFinite(q) && q > 0
          ? `ต้องกันเงิน ${D.baht(p * q)} บาท จากเงินในพอร์ต ${D.baht(cash)} บาท` : `เงินในพอร์ต ${D.baht(cash)} บาท`;
      };
      const nudge = (input, fn, start) => {
        const now = input === priceIn ? D.parsePrice(input.value) : D.parseQty(input.value);
        const next = Number.isFinite(now) ? fn(now) : start;
        input.value = input === priceIn ? D.price(Math.min(Math.max(next, D.BAND.floor), D.BAND.ceiling)) : String(Math.max(D.LOT, next));
        sfx.play('click');
        reserve();
      };
      $('.ld-price-up', form).onclick = () => nudge(priceIn, D.stepUp, mission.bids[0].price);
      $('.ld-price-down', form).onclick = () => nudge(priceIn, D.stepDown, mission.bids[0].price);
      $('.ld-qty-up', form).onclick = () => nudge(qtyIn, (q) => q - (q % D.LOT) + D.LOT, D.LOT);
      $('.ld-qty-down', form).onclick = () => nudge(qtyIn, (q) => (q % D.LOT ? q - (q % D.LOT) : q - D.LOT), D.LOT);
      priceIn.oninput = reserve;
      qtyIn.oninput = reserve;
      form.onsubmit = (event) => {
        event.preventDefault();
        const check = D.validateOrder(mission, { price: priceIn.value, qty: qtyIn.value }, cash);
        $('#ld-price-err', form).textContent = check.errors.price || '';
        $('#ld-qty-err', form).textContent = check.errors.qty || '';
        $('#ld-cash-err', form).textContent = check.errors.cash || '';
        if (!check.ok) {
          sfx.play('wrong');
          (check.errors.price ? priceIn : check.errors.qty ? qtyIn : priceIn).focus();
          return;
        }
        attempts[mission.id] = (attempts[mission.id] || 0) + 1;
        const result = D.simulate(mission, check.order, { orderId: `SIM-ORD-${mission.id}-${attempts[mission.id]}` });
        sfx.play('click');
        playPhase(mission, result);
      };
    }

    // ---------- ภารกิจ: เดินเวลา ----------
    function playPhase(mission, result) {
      let shown = 0;
      const mine = result.order;
      panel.innerHTML = `<h4 id="ld-m-h">ภารกิจ ${mission.id} · ${esc(mission.title)} <span class="tag">${esc(mission.level)}</span></h4>
        <p>คำสั่ง <b>${esc(result.orderId)}</b> · Limit ซื้อ ${D.count(mine.qty)} หุ้น ที่ ${D.price(mine.price)} บาท</p>
        <p class="ld-now" aria-live="polite"></p>
        <div class="ld-board-slot"></div>
        <ol class="ld-timeline" aria-label="ไทม์ไลน์คำสั่ง"></ol>
        <div class="row"><button type="button" class="btn primary ld-next"></button></div>
        <div class="ld-explain"></div>`;
      const next = $('.ld-next', panel);
      const draw = () => {
        const step = result.steps[shown - 1];
        $('.ld-now', panel).innerHTML = `เวลา <b>${esc(step.at)}</b> · สถานะ ${chip(step.status)} · จับคู่แล้ว ${D.count(step.filled)}/${D.count(mine.qty)} หุ้น`;
        $('.ld-board-slot', panel).innerHTML = boardHtml(step.board, mine, `กระดานคำสั่งเวลา ${step.at}`);
        $('.ld-timeline', panel).innerHTML = result.steps.slice(0, shown).map((s) =>
          `<li><b>${esc(s.at)}</b> ${chip(s.status)} ${esc(s.text)}</li>`).join('');
        const more = shown < result.steps.length;
        next.hidden = !more;
        if (more) next.textContent = `เดินเวลาไป ${result.steps[shown].at}${result.steps[shown].kind === 'close' ? ' (ปิดช่วงซื้อขาย)' : ''}`;
        else explainPhase(mission, result);
      };
      next.onclick = () => {
        shown++;
        const step = result.steps[shown - 1];
        sfx.play(step.fills.length ? 'coin' : step.kind === 'close' && step.expired ? 'wrong' : 'tick');
        draw();
        if (!next.hidden) next.focus();
      };
      shown = 1;
      sfx.play(result.steps[0].fills.length ? 'coin' : 'tick');
      draw();
      if (!next.hidden) next.focus();
    }

    // ---------- ภารกิจ: อธิบายเหตุผล ----------
    function explainPhase(mission, result) {
      const box = $('.ld-explain', panel);
      const summary = result.filled
        ? `จับคู่ ${D.count(result.filled)} หุ้น ราคาเฉลี่ย ${D.price(Math.round(result.avgPrice))} บาท รวม ${D.baht(result.cost)} บาท${result.expired ? ` · สิ้นสุด ${D.count(result.expired)} หุ้น` : ''}`
        : `ไม่ได้จับคู่ · สิ้นสุด ${D.count(result.expired)} หุ้น ไม่ได้ใช้เงิน`;
      box.innerHTML = `<div class="ld-result"><p>สถานะสุดท้าย ${chip(result.status)} · ${esc(summary)}</p>
        <p class="muted">สถานะที่ผ่าน: ${result.seen.map((s) => esc(D.STATUS[s])).join(' → ')}</p></div>
        ${radios('ld-cause', 'ข้อใดอธิบายผลของคำสั่งนี้ได้ตรงที่สุด', D.CAUSES.map((c) => [c.id, c.text]), 'ld-cause-err')}
        <div class="row"><button type="button" class="btn primary ld-check">ตรวจเหตุผล</button></div>
        <div class="ld-after" aria-live="polite"></div>`;
      $('.ld-check', box).onclick = () => {
        const answer = D.checkCause(result, picked(box, 'ld-cause'));
        $('#ld-cause-err', box).textContent = answer.error;
        if (!answer.ok) { sfx.play('wrong'); $('input[name="ld-cause"]', box).focus(); return; }
        sfx.play('correct');
        $$('input[name="ld-cause"]', box).forEach((input) => { input.disabled = true; });
        $('.ld-check', box).hidden = true;
        const after = $('.ld-after', box);
        if (!D.passed(mission, result, true)) {
          after.innerHTML = `<p class="warn">✔️ อธิบายถูก แต่ยังไม่ผ่านภารกิจ · ${esc(D.retryHint(mission, result))}</p>
            <div class="row"><button type="button" class="btn primary ld-retry">ตั้งคำสั่งใหม่</button></div>`;
          $('.ld-retry', after).onclick = () => { sfx.play('click'); orderPhase(); $('#ld-price', panel).focus(); };
          $('.ld-retry', after).focus();
          return;
        }
        runs.push({ missionId: mission.id, attempts: attempts[mission.id], result });
        drawWallet();
        const last = index === D.MISSIONS.length - 1;
        after.innerHTML = `<p class="ld-ok">✔️ ผ่านภารกิจ ${mission.id} แล้ว</p>
          <div class="row"><button type="button" class="btn primary ld-go">${last ? 'ไปสรุปก่อนบันทึก' : `ไปภารกิจ ${mission.id + 1}`}</button></div>`;
        $('.ld-go', after).onclick = () => {
          sfx.play('click');
          index++;
          if (last) finalPhase(); else { orderPhase(); $('#ld-m-h', panel).scrollIntoView?.({ block: 'start' }); }
        };
        $('.ld-go', after).focus();
      };
    }

    // ---------- สรุปและบันทึก ----------
    function finalPhase() {
      drawSteps();
      panel.innerHTML = `<h4 id="ld-m-h">ครบ 3 ภารกิจแล้ว</h4><ul class="ld-runs">${runs.map((r) => `<li>${esc(D.runLine(r))}</li>`).join('')}</ul>`;
      $('.ld-final', el).hidden = false;
      $('.ld-save', el).hidden = false;
      $('input[name="ld-final-level"]', el).focus();
    }

    $('.ld-skip', el).onclick = () => { sfx.play('click'); quiz(); };
    $('.ld-save', el).onclick = () => {
      const problems = [];
      if (runs.length !== D.MISSIONS.length) problems.push('ทำภารกิจให้ครบ 3 ภารกิจก่อน');
      const final = D.checkFinal(Object.fromEntries(D.FINAL.map((item) => [item.id, picked(el, `ld-final-${item.id}`)])));
      D.FINAL.forEach((item) => { $(`#ld-final-${item.id}-err`, el).textContent = final.errors[item.id] || ''; });
      if (!final.ok) problems.push('ตอบข้อสรุปให้ถูกก่อนบันทึก');
      const note = D.checkSetNote({ date: $('#ld-set-date', el).value, ...Object.fromEntries(D.SET_FIELDS.map((f) => [f.id, $(`#ld-set-${f.id}`, el).value])) });
      $('#ld-set-err', el).textContent = note.error;
      if (!note.ok) { problems.push('ตรวจช่องจดค่าจริงจากเว็บ SET'); $('.ld-set', el).open = true; }
      if (problems.length) {
        sfx.play('wrong');
        status(problems.join(' · '));
        return;
      }
      const out = D.portfolioEntry(product, runs, note.note, Date.now());
      State.addPortfolio(out.key, 5, out.title, out.text, out.data);
      sfx.play('note');
      quiz();
    };

    drawWallet();
    orderPhase();
  }

  M.LimitDesk = { run };
})();

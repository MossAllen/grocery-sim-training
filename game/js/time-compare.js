/* time-compare.js — สมุดสังเกตลูกค้าช่วงเช้าและเย็น (GDD §9) · ตรรกะอยู่ใน observe-walk-model.js */
(function () {
  const M = window.MTL;
  const { $, $$, esc, sfx } = M;

  // options.gather(el, session, done) แทนขั้นเก็บหลักฐานแบบรายการ เช่น ฉากเดินใน observe-walk.js
  // ขั้นวิเคราะห์ เทียบช่วง ข้อเสนอ คะแนน และแฟ้มผลงานใช้ร่วมกันทั้งสองทาง
  M.playTimeCompare = (el, ctx, finish, options = {}) => {
    const session = M.ObserveModel.createSession(ctx.product);
    const { events, periods, timeLabel } = session;
    const route = options.route || 'list';

    function gather(periodIndex) {
      const period = periods[periodIndex];
      const available = session.periodEvents(period.id);
      const positions = [175, 395, 595];
      const customers = {};
      const nextPeriod = periods[periodIndex + 1];
      el.innerHTML = `<div class="hud"><div class="stat">จำลอง<b>${period.label}</b></div>
        <div class="stat">เวลา<b class="tc-time">${timeLabel(period.start)}</b></div>
        <div class="stat">จดแล้ว<b class="tc-progress" aria-live="polite">${session.recordedCount()} / ${events.length}</b></div></div>
        <p>เลือกเหตุการณ์จากฉากร้านหรือจากปุ่มตามเวลา แล้วจดสิ่งที่เห็นหรือได้ยินลงตาราง</p>
        <div class="scene-wrap"><canvas aria-label="ฉากร้านจำลอง${period.label}">ใช้ปุ่มตามเวลาเพื่อเปิดเหตุการณ์</canvas></div>
        <div class="row" role="group" aria-label="รายการเหตุการณ์${period.label}">${available.map((event) => `<button class="btn" data-event="${event.id}">เหตุการณ์ ${timeLabel(event.minute)}</button>`).join('')}</div>
        <div class="tc-note"></div>
        <div class="notes"><table class="tbl"><caption>ตารางสังเกต</caption><thead><tr><th scope="col">เวลา</th><th scope="col">สิ่งที่เห็นหรือได้ยิน</th></tr></thead><tbody></tbody></table></div>
        <div class="row"><button class="btn primary tc-continue" disabled>${nextPeriod ? 'ไปช่วงเย็น' : 'ย้อนดูสิ่งที่จด'}</button></div>`;

      const scene = new M.StoreScene($('canvas', el), {
        product: ctx.product, startMinute: period.start, minutesPerSec: 0,
        onCustomerClick: (customer) => showEvent(customer.data.event),
      });
      available.forEach((event, index) => {
        const customer = scene.spawn({ event, sprite: event.sprite, bubble: '!' });
        Object.assign(customer, { x: positions[index], y: 250, wait: Infinity });
        customers[event.id] = customer;
      });
      scene.start();
      M.onLeave = () => scene.stop();

      const eventButtons = $$('[data-event]', el);
      const next = $('.tc-continue', el);
      const note = $('.tc-note', el);
      const rows = $('tbody', el);
      eventButtons.forEach((button, index) => { button.onclick = () => showEvent(available[index]); });
      eventButtons[0].focus();
      fillRows();

      function fillRows() {
        rows.innerHTML = session.notebook().map((event) =>
          `<tr><td>${timeLabel(event.minute)}</td><td>${esc(event.observedText)}</td></tr>`).join('');
      }

      function showEvent(event) {
        if (session.isRecorded(event.id)) return;
        sfx.play('click');
        scene.clock = event.minute;
        $('.tc-time', el).textContent = timeLabel(event.minute);
        note.innerHTML = `<div class="note-pop"><p><b>${timeLabel(event.minute)}</b> ${esc(event.observedText)}</p>
          <button class="btn primary tc-record">จดลงตาราง</button></div>`;
        const record = $('.tc-record', note);
        record.onclick = () => {
          session.record(event.id);
          customers[event.id].bubble = '✓';
          customers[event.id].bubbleColor = '#cdeccf';
          const button = $(`[data-event="${event.id}"]`, el);
          button.disabled = true;
          button.textContent += ' ✓';
          fillRows();
          sfx.play('note');
          $('.tc-progress', el).textContent = `${session.recordedCount()} / ${events.length}`;
          const nextEvent = eventButtons.find((candidate) => !candidate.disabled);
          next.disabled = !!nextEvent;
          note.innerHTML = '';
          (nextEvent || next).focus();
        };
        record.focus();
      }

      next.onclick = () => {
        scene.stop();
        if (nextPeriod) gather(periodIndex + 1);
        else review(0);
      };
    }

    // choose(selected) บันทึกคำตอบลง session และคืนค่า true เมื่อถูก
    function ask({ count, title, context = '', options, answer, explain, choose, next, nextText = 'ต่อไป →' }) {
      el.innerHTML = `${context}<div class="q-count">${count}</div><h3 class="q tc-question" tabindex="-1">${title}</h3>
        <div class="opts">${M.R.shuffle(options).map((option) => `<button class="opt" data-answer="${option.id}">${esc(option.label)}</button>`).join('')}</div>
        <div class="feedback" aria-live="polite"></div>`;
      $('.tc-question', el).focus();
      const buttons = $$('[data-answer]', el);
      buttons.forEach((button) => { button.onclick = () => {
        const ok = choose(button.dataset.answer);
        sfx.play(ok ? 'correct' : 'wrong');
        buttons.forEach((option) => {
          option.disabled = true;
          if (option.dataset.answer === answer) option.classList.add('right');
        });
        if (!ok) button.classList.add('bad');
        $('.feedback', el).innerHTML = `<div class="msg" id="tc-feedback"><b>${ok ? 'ถูกต้อง' : 'ลองดูหลักฐาน'}</b> ${esc(explain)}</div>
          <div class="row"><button class="btn primary tc-next" aria-describedby="tc-feedback">${nextText}</button></div>`;
        const advance = $('.tc-next', el);
        advance.onclick = next;
        advance.focus();
      }; });
    }

    function review(index) {
      M.onLeave = null;
      const event = events[index];
      const count = `ย้อนดูแถว ${index + 1} / ${events.length} · ${timeLabel(event.minute)}`;
      const fact = session.observationQuestion(event.id);
      const reason = session.reasonQuestion(event.id);
      ask({
        ...fact, count, choose: (id) => session.answerObservation(event.id, id),
        next: () => ask({
          ...reason, count, context: `<p>${esc(event.observedText)}</p>`,
          choose: (id) => session.answerReason(event.id, id),
          next: () => index + 1 < events.length ? review(index + 1) : compare(0),
        }),
      });
    }

    function compare(index) {
      const question = session.comparisonQuestion(periods[index].id);
      const { period, sample, rows } = question;
      const context = `<table class="tbl tc-tally"><caption>${period.label} · บันทึก ${sample.length} เหตุการณ์ · นับก่อนสรุป</caption>
        <thead><tr><th scope="col">ความต้องการ</th><th scope="col">จำนวน ÷ ทั้งหมดในช่วงนี้</th><th scope="col">แถวในสมุด</th></tr></thead><tbody>${rows.map((row) =>
          `<tr><th scope="row">${row.group.label}</th><td>${row.count} ÷ ${row.denominator}</td><td>${row.times.join(', ') || '–'}</td></tr>`).join('')}</tbody></table>`;
      const last = index === periods.length - 1;
      ask({
        ...question, count: `เทียบช่วงเวลา ${index + 1} / ${periods.length}`, context,
        choose: (id) => session.answerComparison(period.id, id),
        next: last ? propose : () => compare(index + 1), nextText: last ? 'ดูผล' : 'ต่อไป →',
      });
    }

    // หลังคะแนน: เลือกเหตุการณ์ 1 แถวและข้อเสนอชั้นวางหรือบริการ 1 อย่างเพื่อเตรียม W1R3 (ไม่นับคะแนน)
    function propose() {
      const { correct, total } = session.score();
      el.innerHTML = `<div class="tc-result"><h3 class="q tc-question" tabindex="-1">ผลวิเคราะห์ ${correct} / ${total} ข้อ</h3>
        <p>${esc(session.summary())} · มาจากตัวอย่างจำลอง ${events.length} เหตุการณ์</p>
        <form class="tc-proposal"><fieldset><legend>เลือกเหตุการณ์ 1 แถวที่จะใช้เสนอในรอบถัดไป</legend>${session.notebook().map((event) =>
          `<label><input type="radio" name="tc-event" value="${event.id}" required> <b>${timeLabel(event.minute)}</b> ${esc(event.observedText)}</label>`).join('')}</fieldset>
        <fieldset class="tc-change" disabled><legend>เปลี่ยนชั้นวางหรือบริการ 1 อย่าง</legend><p class="muted tc-change-options">เลือกเหตุการณ์ก่อน</p></fieldset>
        <div class="row"><button type="submit" class="btn primary tc-save" disabled>บันทึกผล</button></div></form></div>`;
      $('.tc-question', el).focus();
      const form = $('.tc-proposal', el);
      const change = $('.tc-change', el);
      const save = $('.tc-save', el);
      form.onchange = (event) => {
        if (event.target.name === 'tc-event') {
          change.disabled = false;
          save.disabled = true;
          $('.tc-change-options', el).outerHTML = `<div class="tc-change-options">${session.proposalOptions(event.target.value).map((option) =>
            `<label><input type="radio" name="tc-change" value="${option.id}" required> ${option.id === 'shelf' ? 'ชั้นวาง' : 'บริการ'} · ${esc(option.label)}</label>`).join('')}</div>`;
        } else if (event.target.name === 'tc-change') save.disabled = false;
      };
      form.onsubmit = (event) => {
        event.preventDefault();
        const chosen = form.elements.namedItem('tc-event').value, kind = form.elements.namedItem('tc-change')?.value;
        if (!chosen || !kind) return;
        save.disabled = true;
        session.propose(chosen, kind);
        complete();
      };
    }

    function complete() {
      const { correct, total, score } = session.score();
      const state = M.State.data;
      const observations = state.observations || (state.observations = {});
      const byProduct = observations.timeCompare || (observations.timeCompare = {});
      byProduct[ctx.product.id] = session.result(route);
      M.State.addPortfolio('w1-observe', 1, 'ตารางสังเกตลูกค้า เช้าและเย็น', session.portfolioText());
      finish(score, `ตอบถูก ${correct} จาก ${total} ข้อ · ${session.summary()}`);
    }

    if (options.gather) options.gather(el, session, () => review(0));
    else gather(0);
  };
})();

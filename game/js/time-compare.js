/* time-compare.js — ใบงานเสริมสังเกตลูกค้าช่วงเช้าและเย็น (GDD §9) */
(function () {
  const M = window.MTL;
  const { $, $$, esc, sfx } = M;
  const periods = [
    { id: 'am', label: 'ช่วงเช้า', start: 7 * 60, answer: 'carry' },
    { id: 'pm', label: 'ช่วงเย็น', start: 17 * 60, answer: 'home' },
  ];
  const groups = [
    { id: 'carry', label: 'ซื้อเร็วหรือพกพา' },
    { id: 'value', label: 'เทียบราคา' },
    { id: 'home', label: 'ซื้อไว้ใช้ที่บ้าน' },
  ];

  function eventsFor(product) {
    return [
      { id: 'am-carry', minute: 422, period: 'am', group: 'carry', sprite: 'customer_1',
        observedText: `ลูกค้าถามว่า “${product.small.name} ใส่กระเป๋าได้ไหม”`,
        supported: 'ลูกค้าอาจให้ความสำคัญกับการพกพา', alternative: 'ลูกค้าต้องการราคาถูกสุด',
        explanation: 'คำถามเรื่องใส่กระเป๋าสนับสนุนเรื่องการพกพา ลูกค้ายังไม่ได้ถามราคา' },
      { id: 'am-fast', minute: 426, period: 'am', group: 'carry', sprite: 'customer_1',
        observedText: 'ลูกค้าถามว่า “หยิบแล้วจ่ายได้เลยไหม กำลังจะขึ้นรถ”',
        supported: 'ลูกค้าอาจอยากซื้อให้ทันเวลา', alternative: 'ลูกค้าต้องการซื้อหลายชิ้น',
        explanation: 'ถ้อยคำเรื่องขึ้นรถและจ่ายทันทีสนับสนุนเรื่องเวลา ลูกค้ายังไม่ได้ระบุจำนวน' },
      { id: 'am-price', minute: 429, period: 'am', group: 'value', sprite: 'customer_4',
        observedText: 'ลูกค้าเทียบป้ายสองขนาดแล้วถามว่าขนาดไหนถูกกว่าต่อหน่วย',
        supported: 'ลูกค้าอาจใช้ราคาต่อหน่วยช่วยตัดสิน', alternative: 'ลูกค้ากำลังรีบเดินทาง',
        explanation: 'คำถามและการเทียบป้ายสนับสนุนเรื่องราคาต่อหน่วย ลูกค้ายังไม่ได้พูดถึงเวลา' },
      { id: 'pm-stock', minute: 1024, period: 'pm', group: 'home', sprite: 'customer_2',
        observedText: `ลูกค้าถามว่า “${product.big.name} มีพอใช้ที่บ้านทั้งสัปดาห์ไหม”`,
        supported: 'ลูกค้าอาจซื้อไว้ใช้ที่บ้าน', alternative: 'ลูกค้าต้องการขนาดที่พกง่าย',
        explanation: 'คำถามระบุปริมาณสำหรับใช้ที่บ้าน ลูกค้ายังไม่ได้ถามเรื่องการพกพา' },
      { id: 'pm-stock-more', minute: 1028, period: 'pm', group: 'home', sprite: 'customer_2',
        observedText: 'ลูกค้าขอหลายชิ้นและบอกว่า “เอาไปเก็บไว้ที่บ้าน”',
        supported: 'ลูกค้าอาจซื้อไว้ใช้ที่บ้าน', alternative: 'ลูกค้าต้องการราคาต่อหน่วยต่ำสุด',
        explanation: 'ทั้งการขอหลายชิ้นและคำพูดชี้ไปที่การเก็บไว้ใช้ที่บ้าน ลูกค้ายังไม่ได้เปรียบเทียบราคา' },
    ];
  }

  const timeLabel = (minute) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  const groupLabel = (id) => groups.find((group) => group.id === id).label;

  M.playTimeCompare = (el, ctx, finish) => {
    const events = eventsFor(ctx.product);
    const recorded = new Set();
    const answers = {};
    const comparison = [];
    let correct = 0;

    function gather(periodIndex) {
      const period = periods[periodIndex];
      const available = events.filter((event) => event.period === period.id);
      const positions = [175, 395, 595];
      const customers = {};
      const nextPeriod = periods[periodIndex + 1];
      el.innerHTML = `<div class="hud"><div class="stat">จำลอง<b>${period.label}</b></div>
        <div class="stat">เวลา<b class="tc-time">${timeLabel(period.start)}</b></div>
        <div class="stat">จดแล้ว<b class="tc-progress" aria-live="polite">${recorded.size} / ${events.length}</b></div></div>
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
        rows.innerHTML = events.filter((event) => recorded.has(event.id)).map((event) =>
          `<tr><td>${timeLabel(event.minute)}</td><td>${esc(event.observedText)}</td></tr>`).join('');
      }

      function showEvent(event) {
        if (recorded.has(event.id)) return;
        sfx.play('click');
        scene.clock = event.minute;
        $('.tc-time', el).textContent = timeLabel(event.minute);
        note.innerHTML = `<div class="note-pop"><p><b>${timeLabel(event.minute)}</b> ${esc(event.observedText)}</p>
          <button class="btn primary tc-record">จดลงตาราง</button></div>`;
        const record = $('.tc-record', note);
        record.onclick = () => {
          recorded.add(event.id);
          customers[event.id].bubble = '✓';
          customers[event.id].bubbleColor = '#cdeccf';
          const button = $(`[data-event="${event.id}"]`, el);
          button.disabled = true;
          button.textContent += ' ✓';
          fillRows();
          sfx.play('note');
          $('.tc-progress', el).textContent = `${recorded.size} / ${events.length}`;
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

    function ask({ count, title, context = '', options, answer, explain, choose, next, nextText = 'ต่อไป →' }) {
      el.innerHTML = `${context}<div class="q-count">${count}</div><h3 class="q tc-question" tabindex="-1">${title}</h3>
        <div class="opts">${M.R.shuffle(options).map((option) => `<button class="opt" data-answer="${option.id}">${esc(option.label)}</button>`).join('')}</div>
        <div class="feedback" aria-live="polite"></div>`;
      $('.tc-question', el).focus();
      const buttons = $$('[data-answer]', el);
      buttons.forEach((button) => { button.onclick = () => {
        const selected = button.dataset.answer;
        const ok = selected === answer;
        if (ok) correct++;
        choose(selected);
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
      const event = events[index];
      const count = `ย้อนดูแถว ${index + 1} / ${events.length} · ${timeLabel(event.minute)}`;
      const choice = answers[event.id] = {};
      const supported = `${event.id}-supported`;
      ask({
        count, title: 'ข้อความใดคือสิ่งที่เห็นหรือได้ยินโดยตรง',
        options: [{ id: 'fact', label: event.observedText }, { id: 'inference', label: event.supported }],
        answer: 'fact', explain: `จดคำพูดหรือการกระทำนี้ได้โดยตรง “${event.observedText}” ส่วนเหตุผลเป็นสิ่งที่เราเสนอจากหลักฐาน`,
        choose: (id) => { choice.selectedObservationId = id; },
        next: () => ask({
          count, title: 'หลักฐานนี้รองรับการตีความใด', context: `<p>${esc(event.observedText)}</p>`,
          options: [{ id: supported, label: event.supported }, { id: `${event.id}-alternative`, label: event.alternative }],
          answer: supported, explain: event.explanation,
          choose: (id) => { choice.selectedReasonId = id; },
          next: () => index + 1 < events.length ? review(index + 1) : compare(0),
        }),
      });
    }

    function compare(index) {
      const period = periods[index];
      const sample = events.filter((event) => event.period === period.id);
      const evidence = sample.filter((event) => event.group === period.answer);
      const rows = groups.map((group) => {
        const count = sample.filter((event) => event.group === group.id).length;
        return `<tr><th scope="row">${group.label}</th><td>${count} ÷ ${sample.length}</td></tr>`;
      }).join('');
      const context = `<table class="tbl"><caption>${period.label} · บันทึก ${sample.length} เหตุการณ์</caption>
        <thead><tr><th scope="col">ความต้องการ</th><th scope="col">จำนวน ÷ ทั้งหมดในช่วงนี้</th></tr></thead><tbody>${rows}</tbody></table>`;
      const last = index === periods.length - 1;
      ask({
        count: `เทียบช่วงเวลา ${index + 1} / ${periods.length}`, title: 'ความต้องการกลุ่มใดพบมากสุดในตัวอย่างนี้', context,
        options: groups, answer: period.answer,
        explain: `แถวเวลา ${evidence.map((event) => timeLabel(event.minute)).join(' และ ')} เข้ากลุ่ม${groupLabel(period.answer)} ${evidence.length} ÷ ${sample.length} ในช่วงนี้ ใช้ผลเป็นสมมติฐานสำหรับเก็บข้อมูลเพิ่ม`,
        choose: (id) => { comparison.push({ period: period.id, sampleCount: sample.length, selectedGroupId: id }); },
        next: last ? complete : () => compare(index + 1), nextText: last ? 'ดูผล' : 'ต่อไป →',
      });
    }

    function complete() {
      const total = events.length * 2 + periods.length;
      const score = correct / total;
      const state = M.State.data;
      const observations = state.observations || (state.observations = {});
      const byProduct = observations.timeCompare || (observations.timeCompare = {});
      byProduct[ctx.product.id] = {
        source: 'simulated',
        events: events.map(({ id, minute, period, observedText }) => ({ id, minute, period, observedText, ...answers[id] })),
        comparison, score,
      };
      const rows = events.map((event, index) =>
        `| ${index + 1} | ${timeLabel(event.minute)} | ${event.observedText} | ${event.supported} |`).join('\n');
      const summary = periods.map((period) => {
        const sample = events.filter((event) => event.period === period.id);
        const count = sample.filter((event) => event.group === period.answer).length;
        return `${period.label} ${groupLabel(period.answer)} ${count} ÷ ${sample.length}`;
      }).join(' · ');
      M.State.addPortfolio('w1-observe', 1, 'ตารางสังเกตลูกค้า เช้าและเย็น',
        `| ครั้ง | เวลา | สิ่งที่เห็นหรือได้ยิน | เหตุผลที่เป็นไปได้ |\n|---|---|---|---|\n${rows}\n${summary}\n(ข้อมูลจำลองจากเกม ใช้ตั้งสมมติฐานเพื่อเก็บข้อมูลเพิ่ม)`);
      finish(score, `ตอบถูก ${correct} จาก ${total} ข้อ · ${summary}`);
    }

    gather(0);
  };
})();

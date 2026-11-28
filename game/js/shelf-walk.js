/* W2R2 — Walk to shelf labels, carry one pack to the counter, scan it, pay, and check the change.
 * Prices, hand, scanner, receipt, payment, and change rules live in checkout-model.js. */
(function () {
  const M = window.MTL;
  const { $, $$, esc, fmt, readDecimal, State, sfx } = M;
  const money = (baht) => Number(baht).toFixed(2);

  const picture = (item) => item.sprite ? '<img src="' + esc(item.sprite) + '" alt="" width="36" height="42">' :
    '<span class="walk-item-icon" aria-hidden="true">' + esc(item.icon) + '</span>';
  const record = (item, mission) => '<li data-recorded="' + item.id + '" data-price="' + item.price +
    '" data-quantity="' + item.quantity + '" data-basis="' + mission.basis + '">' + picture(item) +
    '<div><b>ชั้น ' + item.shelf + ' · ' + esc(item.name) + '</b><br>' + esc(item.sizeText) + ' · ' + fmt(item.price) + ' บาท</div></li>';
  const carried = (item) => item ? picture(item) + '<span>ชั้น ' + item.shelf + ' · ' + esc(item.name) + ' · ' + fmt(item.price) + ' บาท</span>' :
    '<span class="muted">ยังไม่มี</span>';

  M.playShelfWalk = (el, ctx, finish, classic) => {
    const CM = M.CheckoutModel;
    const previous = ctx.state.shelfWalk?.[ctx.product.id];
    const caseIndex = previous?.caseIndex === 0 ? 1 : 0;
    const mission = CM.mission(ctx.product, caseIndex);
    const { items, budget, unit, basis, denominator, best } = mission;
    for (const item of items) {
      item.icon = ctx.product.emoji[item.size];
      item.sprite = window.MTL_SPRITE_MANIFEST?.['item_' + ctx.product.id + '_' + item.size];
    }
    const counter = CM.createCounter(mission, { transactionId: State.newId('w2') });
    const seen = new Set();
    const cash = { id: 'checkout', name: 'เคาน์เตอร์', icon: '🧾' };

    el.innerHTML = '<section class="shelf-walk" aria-label="ภารกิจเดินเทียบราคา">' +
      '<div class="walk-brief"><p><strong>ภารกิจ</strong> มีงบ ' + fmt(budget) +
      ' บาท หยิบสินค้า 1 แพ็กที่มีราคาต่อหน่วยต่ำที่สุด สแกนที่เคาน์เตอร์ แล้วตรวจเงินทอน</p>' +
      '<button type="button" class="btn small ghost" data-walk-classic>ฝึกคำนวณแบบเดิม</button></div>' +
      '<div class="walk-world"><div class="walk-viewport" tabindex="0" role="region" aria-label="ร้านมุมมองบุคคลที่หนึ่ง ใช้ปุ่มลูกศรเดิน กด Q หรือ R เพื่อหัน และ E เพื่ออ่านป้ายหรือหยิบสินค้า">' +
      '<canvas width="960" height="540" aria-hidden="true"></canvas><span class="walk-reticle" aria-hidden="true">+</span></div>' +
      '<div class="walk-controls">' + M.WalkControls.pad() +
      '<div class="walk-act"><button type="button" class="btn primary" data-walk-action>อ่านป้ายชั้น A</button>' +
      '<p class="walk-hand" aria-live="polite"><b>ในมือ</b> <span data-walk-hand>' + carried(null) + '</span></p>' +
      '<small class="muted">ลูกศร / WASD เดิน · Q/R หัน · E อ่านหรือหยิบ</small></div></div>' +
      '<p class="walk-hint" role="status">เริ่มที่ชั้น A อ่านป้าย แล้วเดินขวาไปชั้น B</p>' +
      '<section class="walk-notebook" aria-label="สมุดจดป้ายสินค้า"><h3>ป้ายสินค้าที่จด</h3><ul class="walk-records"></ul></section></div>' +
      '<section class="walk-checkout hidden" aria-label="เคาน์เตอร์"></section></section>';

    const viewport = $('.walk-viewport', el), world = $('.walk-world', el), notebook = $('.walk-records', el);
    const checkout = $('.walk-checkout', el), action = $('[data-walk-action]', el), hint = $('.walk-hint', el);
    const scene = M.ShelfWalkScene.create($('canvas', viewport), { stations: [...items, cash] });
    $('[data-walk-classic]', el).onclick = classic;
    if (!scene) {
      action.disabled = true;
      hint.textContent = 'เครื่องนี้เปิดฉากร้านไม่ได้ กดฝึกคำนวณแบบเดิมเพื่อเล่นรอบนี้';
      return;
    }

    let checkingOut = false, closed = false, actionKey;

    const updateNotebook = () => {
      notebook.innerHTML = items.filter((item) => seen.has(item.id)).map((item) => record(item, mission)).join('') ||
        '<li class="muted">ยังไม่ได้จดราคาและขนาดจากชั้นวาง</li>';
    };
    // The main button says what E or a tap will do here: read a tag, pick or put back a pack, or go to pay.
    const modeFor = (id) => {
      const item = items.find((entry) => entry.id === id);
      if (item) return !seen.has(id) ? 'read' : counter.hand() === item ? 'return' : 'pick';
      return id === 'checkout' ? 'pay' : '';
    };
    const updateTarget = () => {
      const id = scene.target(), mode = modeFor(id), key = (id || '') + ':' + mode;
      if (key === actionKey) return;
      actionKey = key;
      action.dataset.target = id || '';
      action.dataset.mode = mode;
      action.disabled = !id;
      const item = items.find((entry) => entry.id === id);
      action.textContent = mode === 'read' ? 'อ่านป้ายชั้น ' + item.shelf :
        mode === 'pick' ? (counter.hand() ? 'เปลี่ยนเป็นชั้น ' : 'หยิบ 1 แพ็กจากชั้น ') + item.shelf :
        mode === 'return' ? 'วางคืนชั้น ' + item.shelf : mode === 'pay' ? 'ไปชำระเงิน' : 'เข้าใกล้ป้ายหรือเคาน์เตอร์';
    };
    const showHand = () => {
      $('[data-walk-hand]', el).innerHTML = carried(counter.hand());
      scene.hold(counter.hand());
    };
    const controls = M.WalkControls.attach({
      root: el, viewport, scene, paused: () => checkingOut, onMove: updateTarget,
      onInteract: () => { if (!action.disabled) interact(); },
    });
    M.onLeave = () => {
      closed = true;
      controls.destroy();
    };
    action.onclick = interact;
    updateNotebook();
    updateTarget();
    scene.draw();
    viewport.focus({ preventScroll: true });

    function interact() {
      if (closed || checkingOut) return;
      const id = scene.target(), mode = modeFor(id);
      const item = items.find((candidate) => candidate.id === id);
      if (mode === 'pay') {
        if (seen.size < items.length) hint.textContent = 'อ่านราคาและขนาดที่ชั้น A กับ B ให้ครบก่อนชำระเงิน';
        else if (!counter.hand()) hint.textContent = 'หยิบสินค้า 1 แพ็กจากชั้นที่คิดว่าคุ้มต่อหน่วยกว่า แล้วถือมาที่เคาน์เตอร์';
        else openCheckout();
        return;
      }
      if (mode === 'read') {
        seen.add(id);
        updateNotebook();
        sfx.play('notebook');
        hint.textContent = seen.size === items.length ? 'จดครบทั้งสองป้ายแล้ว เทียบ ' + unit + ' แล้วหยิบ 1 แพ็กไปเคาน์เตอร์' :
          'จดชั้น ' + item.shelf + ' แล้ว กดอีกครั้งเพื่อหยิบ หรือเดินไปอ่านอีกชั้น';
      } else if (mode === 'pick') {
        const { picked, previous } = counter.pick(id);
        if (picked) {
          sfx.play('shelf_pick');
          showHand();
          hint.textContent = (previous ? 'วางชั้น ' + previous.shelf + ' คืนแล้ว ' : '') + 'ถือชั้น ' + item.shelf + ' อยู่ เดินไปเคาน์เตอร์ทางขวา';
        }
      } else if (mode === 'return' && counter.putBack()) {
        sfx.play('click');
        showHand();
        hint.textContent = 'วางชั้น ' + item.shelf + ' คืนแล้ว';
      }
      actionKey = undefined;
      updateTarget();
    }

    function reveal(target) {
      const { top, bottom } = target.getBoundingClientRect();
      const headerBottom = $('.topbar')?.getBoundingClientRect().bottom ?? 0;
      if (top < headerBottom || bottom > window.innerHeight) {
        target.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
      target.focus({ preventScroll: true });
    }

    function backToShelves() {
      checkingOut = false;
      checkout.classList.add('hidden');
      world.classList.remove('hidden');
      actionKey = undefined;
      updateTarget();
      reveal(viewport);
    }

    function openCheckout() {
      controls.stop();
      checkingOut = true;
      world.classList.add('hidden');
      checkout.classList.remove('hidden');
      if (!$('.counter', checkout)) buildCounter();
      $('[data-counter-hand]', checkout).innerHTML = carried(counter.hand());
      reveal($('h3', checkout));
    }

    function buildCounter() {
      const normalize = ctx.product.id === 'water' ? '1,000 มล. = 1 ลิตร' : 'ใช้ฐาน ' + basis + ' ' + denominator + ' เท่ากันทั้งสองชั้น';
      checkout.innerHTML = '<h3 tabindex="-1">เคาน์เตอร์</h3><ul class="walk-records">' +
        items.map((item) => record(item, mission).replace('data-recorded=', 'data-checkout-item=')).join('') +
        '</ul><p class="walk-tip">' + esc(normalize) + ' · ราคา ÷ ปริมาณในแพ็ก' + (basis === 1 ? '' : ' × ' + basis) +
        ' = ' + esc(unit) + '<br>ปัดเป็นทศนิยม 2 ตำแหน่งเมื่อหารไม่ลงตัว</p>' +
        '<form id="counter-prices" class="walk-checkout-form" novalidate><p class="counter-step">1. ราคาต่อหน่วยจากสมุด</p><div class="walk-calculations">' +
        items.map((item) => '<label>ชั้น ' + item.shelf + ' · ' + esc(unit) +
          '<input name="unit-' + item.id + '" inputmode="decimal" required autocomplete="off"></label>').join('') + '</div></form>' +
        '<div class="counter"><p class="counter-step">2. วางสินค้าบนเครื่องสแกน</p>' +
        '<p class="counter-hand"><b data-counter-position>ในมือ</b> <span data-counter-hand></span></p>' +
        '<div class="row"><button type="submit" form="counter-prices" class="btn primary" data-counter-scan>วางบนเครื่องสแกน</button>' +
        '<button type="button" class="btn ghost walk-inspect-again">กลับไปเปลี่ยนสินค้า</button></div>' +
        '<div class="counter-machine"><div class="counter-scanner" data-counter-scanner aria-hidden="true"><span class="counter-pad"></span><div class="counter-on-pad" data-counter-on-pad></div></div>' +
        '<div class="counter-display"><small>TOTAL / THB</small><b data-counter-total>0.00</b></div></div>' +
        '<p class="counter-reason" data-counter-reason role="status"></p>' +
        '<div class="counter-paper"><b>ใบเสร็จ</b><ol class="counter-receipt" data-counter-receipt></ol></div></div>' +
        '<section class="counter-pay hidden" data-counter-pay-step aria-labelledby="counter-pay-title"><p class="counter-step" id="counter-pay-title">3. จ่ายเงิน</p>' +
        '<p>กระเป๋ามี ' + fmt(budget) + ' บาท แตะเงินที่จะยื่นให้พนักงาน</p><div class="counter-wallet" role="group" aria-label="เงินในกระเป๋า">' +
        counter.purse.map((value, i) => '<button type="button" class="btn" data-cash="' + i + '" aria-pressed="false">' + value + ' บาท</button>').join('') +
        '</div><p>ยื่นแล้ว <b data-counter-tray>0</b> บาท</p><div class="row"><button type="button" class="btn primary" data-counter-pay disabled>จ่ายเงิน</button></div>' +
        '<p class="counter-reason" data-counter-pay-reason role="status"></p></section>' +
        '<section class="counter-change hidden" data-counter-change-step aria-labelledby="counter-change-title"><p class="counter-step" id="counter-change-title">4. รับเงินทอน</p>' +
        '<form class="counter-change-form"><label>เงินทอนที่ควรได้ (บาท)<input name="change" inputmode="decimal" required autocomplete="off"></label>' +
        '<button type="submit" class="btn primary" data-counter-change>รับเงินทอน</button></form>' +
        '<p data-counter-change-feedback role="status"></p></section>' +
        '<div class="walk-feedback" aria-live="polite"></div>';

      const form = $('.walk-checkout-form', checkout);
      const reason = $('[data-counter-reason]', checkout);
      const inspect = $('.walk-inspect-again', checkout);
      inspect.onclick = backToShelves;
      form.onsubmit = (event) => { event.preventDefault(); scan(); };

      function scan() {
        const values = items.map((item) => readDecimal(form.elements.namedItem('unit-' + item.id).value, 2));
        if (!counter.lines.length) {
          const invalid = values.findIndex((value) => value === null || value < 0);
          if (invalid >= 0) {
            reason.textContent = 'กรอกราคาต่อหน่วยของทั้งสองชั้นเป็นตัวเลข ทศนิยมได้ไม่เกิน 2 ตำแหน่ง ก่อนสแกน';
            reason.dataset.state = 'rejected';
            form.elements.namedItem('unit-' + items[invalid].id).focus();
            return;
          }
          counter.setUnits(values);
        }
        const result = counter.scan();
        reason.dataset.state = result.accepted ? 'accepted' : 'rejected';
        if (!result.accepted) {
          reason.textContent = result.reason;
          return;
        }
        // One accepted scan: one cue, one flash, one receipt line, and the new total.
        sfx.play('scanner');
        const scanner = $('[data-counter-scanner]', checkout);
        const scanned = items.find((item) => item.id === result.line.id);
        $('[data-counter-on-pad]', scanner).innerHTML = picture(scanned);
        $('[data-counter-position]', checkout).textContent = 'บนแท่นสแกน';
        $('[data-counter-hand]', checkout).textContent = 'ชั้น ' + scanned.shelf + ' · ' + scanned.name + ' · ' + fmt(scanned.price) + ' บาท';
        scanner.classList.remove('is-flash');
        void scanner.offsetWidth;
        scanner.classList.add('is-flash');
        $('[data-counter-total]', checkout).textContent = money(result.total);
        $('[data-counter-receipt]', checkout).innerHTML = counter.lines.map((line) => '<li data-line="' + line.id + '"><span>' +
          line.quantity + ' × ' + esc(line.name) + '</span><span>' + money(line.price) + '</span></li>').join('') +
          '<li class="counter-sum"><span>ยอดรวม</span><span>' + money(result.total) + '</span></li>';
        reason.textContent = 'สแกนแล้ว ' + result.line.name + ' ' + fmt(result.line.price) + ' บาท';
        for (const input of $$('input', form)) input.disabled = true;
        inspect.remove();
        const pay = $('[data-counter-pay-step]', checkout);
        pay.classList.remove('hidden');
        reveal($('[data-cash]', pay));
      }

      const tray = new Set();
      const payButton = $('[data-counter-pay]', checkout);
      const traySum = () => [...tray].reduce((sum, i) => sum + counter.purse[i], 0);
      for (const coin of $$('[data-cash]', checkout)) {
        coin.onclick = () => {
          const i = Number(coin.dataset.cash);
          if (tray.has(i)) tray.delete(i); else tray.add(i);
          coin.setAttribute('aria-pressed', String(tray.has(i)));
          $('[data-counter-tray]', checkout).textContent = fmt(traySum());
          payButton.disabled = traySum() < counter.total();
          $('[data-counter-pay-reason]', checkout).textContent = payButton.disabled ?
            'ยังขาดอีก ' + fmt(counter.total() - traySum()) + ' บาท' : '';
        };
      }
      payButton.onclick = () => {
        const result = counter.pay([...tray]);
        if (!result.paid) {
          $('[data-counter-pay-reason]', checkout).textContent = result.reason;
          return;
        }
        for (const control of $$('[data-counter-pay-step] button', checkout)) control.disabled = true;
        $('[data-counter-pay-reason]', checkout).textContent = 'พนักงานรับเงิน ' + fmt(result.amount) + ' บาท';
        const change = $('[data-counter-change-step]', checkout);
        change.classList.remove('hidden');
        reveal($('input', change));
      };

      const changeForm = $('.counter-change-form', checkout);
      changeForm.onsubmit = (event) => {
        event.preventDefault();
        const typed = readDecimal(changeForm.elements.namedItem('change').value, 2);
        const feedback = $('[data-counter-change-feedback]', checkout);
        if (typed === null || typed < 0) {
          feedback.textContent = 'กรอกจำนวนเงินเป็นตัวเลข ทศนิยมได้ไม่เกิน 2 ตำแหน่ง';
          return;
        }
        const { amount, change } = counter.payment();
        const ok = counter.answerChange(typed / 100);
        const formula = 'เงินที่ยื่น − ยอดรวม = ' + fmt(amount) + ' − ' + fmt(counter.total()) + ' = ' + fmt(change) + ' บาท';
        feedback.textContent = (ok ? 'ถูกต้อง ' : 'ยังไม่ตรง ') + formula + (change ? ' รับเงินทอนแล้ว' : ' จ่ายพอดี ไม่มีเงินทอน');
        feedback.dataset.state = ok ? 'accepted' : 'rejected';
        // cash_change plays once per transaction and only when change is above 0 (docs/AUDIO_SPEC.md).
        if (counter.receiveChange()) sfx.play('cash_change');
        for (const control of $$('input, button', changeForm)) control.disabled = true;
        showReceipt();
      };
    }

    function showReceipt() {
      const result = counter.result();
      const { choice, unitCorrect, chosenBest, points } = result;
      const formula = (item) => fmt(item.price) + ' ÷ ' + fmt(item.quantity) + (basis === 1 ? '' : ' × ' + basis) + ' = ' + fmt(item.per) + ' ' + unit;
      const feedback = $('.walk-feedback', checkout);
      feedback.innerHTML = '<div class="walk-receipt"><h3>ใบเสร็จ</h3><p class="muted">เลขที่ ' + esc(counter.transactionId) + ' · จำลอง</p>' +
        '<p>ซื้อ 1 × ' + esc(choice.name) + ' · ยอดรวม ' + fmt(result.total) + ' บาท · รับเงิน ' + fmt(result.paid) +
        ' บาท · ทอน ' + fmt(result.change) + ' บาท · งบเหลือ ' + fmt(budget - result.total) + ' บาท</p><ul>' +
        items.map((item, i) => '<li>' + (unitCorrect[i] ? '✓ ' : '✗ ') + 'ชั้น ' + item.shelf + ' · ' + esc(formula(item)) + '</li>').join('') +
        '</ul><p><b>ชั้น ' + best.shelf + ' คุ้มต่อหน่วยที่สุด</b> · ' + esc(chosenBest ? 'เลือกตรงตามภารกิจ' :
          'ราคาที่จ่ายต่อแพ็กและราคาต่อหน่วยตอบคนละคำถาม') + '</p>' +
        '<p class="muted">เงินทอน' + (result.changeCorrect ? 'ถูกต้อง' : 'ยังไม่ตรงในครั้งแรก') + ' (ไม่นับคะแนน)</p>' +
        '<button type="button" class="btn primary" data-walk-save>บันทึกผล (' + points + '/3)</button></div>';
      const save = $('[data-walk-save]', feedback);
      save.onclick = () => {
        save.disabled = true;
        (ctx.state.shelfWalk ||= {})[ctx.product.id] = {
          caseIndex, choice: choice.id, score: result.score, transactionId: counter.transactionId,
          total: result.total, paid: result.paid, change: result.change, changeCorrect: result.changeCorrect,
        };
        const notebookText = items.map((item) => 'ชั้น ' + item.shelf + ' ' + item.name + ' · ' + item.sizeText + ' · ' + formula(item)).join('\n');
        State.addPortfolio('w2-store-' + ctx.product.id, 2, 'เดินเทียบราคาต่อหน่วย', notebookText +
          '\nใบเสร็จ ' + counter.transactionId + ': 1 × ' + choice.name + ' ' + fmt(result.total) + ' บาท · รับเงิน ' + fmt(result.paid) +
          ' บาท · ทอน ' + fmt(result.change) + ' บาท\nคุ้มต่อหน่วยที่สุดคือชั้น ' + best.shelf + ' (ข้อมูลจำลอง)');
        finish(result.score, 'ตอบถูก ' + points + ' จาก 3 ข้อ · ชั้น ' + best.shelf + ' คุ้มต่อหน่วยที่สุด');
      };
      $('.walk-receipt', feedback).scrollIntoView({ block: 'start', behavior: 'instant' });
      reveal(save);
    }
  };
})();

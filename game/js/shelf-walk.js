/* W2R2 — Walk to shelf labels, use the same unit, and make a purchase. */
(function () {
  const M = window.MTL;
  const { $, $$, esc, fmt, readDecimal, State, sfx } = M;
  const alternate = { water: [9, 24], snack: [8, 27], household: [9, 60] };
  const direction = {
    forward: [1, 0, 0], back: [-1, 0, 0], left: [0, -1, 0], right: [0, 1, 0],
    'turn-left': [0, 0, -1], 'turn-right': [0, 0, 1],
  };
  const keyMoves = {
    ArrowUp: 'forward', KeyW: 'forward', ArrowDown: 'back', KeyS: 'back',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyQ: 'turn-left', KeyR: 'turn-right',
  };

  function offer(product, caseIndex) {
    const prices = caseIndex === 1 ? alternate[product.id] : [product.small.price, product.big.price];
    const sizeText = (size) => {
      if (product.id === 'water') return size < 1 ? fmt(size * 1000, 0) + ' มล.' : fmt(size) + ' ลิตร';
      return fmt(size, 0) + (product.id === 'snack' ? ' กรัม' : ' ม้วน');
    };
    const items = ['small', 'big'].map((size, i) => ({
      id: i ? 'b' : 'a', shelf: i ? 'B' : 'A', name: product[size].name, quantity: product[size].size,
      price: prices[i], sizeText: sizeText(product[size].size), icon: product.emoji[size],
      sprite: window.MTL_SPRITE_MANIFEST?.['item_' + product.id + '_' + size],
      per: prices[i] * product.per / product[size].size,
    }));
    return {
      items, budget: Math.max(...prices) + 5, basis: product.per, unit: product.perLabel,
      denominator: product.id === 'water' ? 'ลิตร' : product.id === 'snack' ? 'กรัม' : 'ม้วน',
      best: items[0].per < items[1].per ? items[0] : items[1],
    };
  }

  const picture = (item) => item.sprite ? '<img src="' + esc(item.sprite) + '" alt="" width="36" height="42">' :
    '<span class="walk-item-icon" aria-hidden="true">' + esc(item.icon) + '</span>';
  const record = (item, mission) => '<li data-recorded="' + item.id + '" data-price="' + item.price +
    '" data-quantity="' + item.quantity + '" data-basis="' + mission.basis + '">' + picture(item) +
    '<div><b>ชั้น ' + item.shelf + ' · ' + esc(item.name) + '</b><br>' + esc(item.sizeText) + ' · ' + fmt(item.price) + ' บาท</div></li>';
  const actionButton = (move, glyph, label) => '<button type="button" class="btn" data-move="' + move + '" aria-label="' + label +
    '" title="' + label + '"><span aria-hidden="true">' + glyph + '</span></button>';

  M.playShelfWalk = (el, ctx, finish, classic) => {
    const previous = ctx.state.shelfWalk?.[ctx.product.id];
    const caseIndex = previous?.caseIndex === 0 ? 1 : 0;
    const mission = offer(ctx.product, caseIndex);
    const { items, budget, unit, basis, denominator, best } = mission;
    const seen = new Set();
    const cash = { id: 'checkout', name: 'เคาน์เตอร์', icon: '🧾' };

    el.innerHTML = '<section class="shelf-walk" aria-label="ภารกิจเดินเทียบราคา">' +
      '<div class="walk-brief"><p><strong>ภารกิจ</strong> มีงบ ' + fmt(budget) +
      ' บาท ซื้อสินค้า 1 แพ็กที่มีราคาต่อหน่วยต่ำที่สุด</p><button type="button" class="btn small ghost" data-walk-classic>ฝึกคำนวณแบบเดิม</button></div>' +
      '<div class="walk-world"><div class="walk-viewport" tabindex="0" role="region" aria-label="ร้านมุมมองบุคคลที่หนึ่ง ใช้ปุ่มลูกศรเดิน กด Q หรือ R เพื่อหัน และ E เพื่ออ่านป้าย">' +
      '<canvas width="960" height="540" aria-hidden="true"></canvas><span class="walk-reticle" aria-hidden="true">+</span></div>' +
      '<div class="walk-controls"><div class="walk-pad" role="group" aria-label="เดินและหัน">' +
      actionButton('turn-left', '↶', 'หันซ้าย') + actionButton('forward', '↑', 'เดินหน้า') + actionButton('turn-right', '↷', 'หันขวา') +
      actionButton('left', '←', 'เดินซ้าย') + actionButton('back', '↓', 'ถอยหลัง') + actionButton('right', '→', 'เดินขวา') + '</div>' +
      '<div class="walk-act"><button type="button" class="btn primary" data-walk-action>อ่านป้ายชั้น A</button>' +
      '<small class="muted">ลูกศร / WASD เดิน · Q/R หัน · E อ่าน</small></div></div>' +
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

    let checkingOut = false, closed = false, frame, last = 0, activeTarget;
    let hold, drag, queueTime = 0, queued = [];
    const pressed = new Set();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const updateNotebook = () => {
      notebook.innerHTML = items.filter((item) => seen.has(item.id)).map((item) => record(item, mission)).join('') ||
        '<li class="muted">ยังไม่ได้จดราคาและขนาดจากชั้นวาง</li>';
    };
    const updateTarget = () => {
      const id = scene.target();
      if (id === activeTarget) return;
      activeTarget = id;
      action.dataset.target = id || '';
      action.disabled = !id;
      const item = items.find((item) => item.id === id);
      action.textContent = item ? (seen.has(id) ? 'ดูป้ายชั้น ' : 'อ่านป้ายชั้น ') + item.shelf :
        id === 'checkout' ? 'ไปชำระเงิน' : 'เข้าใกล้ป้ายหรือเคาน์เตอร์';
    };
    const stopMotion = () => { pressed.clear(); queued = []; queueTime = 0; hold = null; drag = null; };

    function renderFrame(now) {
      if (closed) return;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
      last = now;
      if (!checkingOut) {
        const moves = [...pressed].map((key) => keyMoves[key]);
        if (hold && now - hold.start > 180) moves.push(hold.move);
        if (moves.length) {
          const vector = [0, 0, 0];
          for (const move of new Set(moves)) direction[move].forEach((value, i) => { vector[i] += value; });
          const [forward, strafe, turn] = vector.map(Math.sign);
          scene.step(forward, strafe, turn, dt);
          updateTarget();
          scene.draw();
        } else if (queued.length) {
          const time = Math.min(dt, 0.26 - queueTime);
          scene.step(...direction[queued[0]], time);
          queueTime += time;
          if (queueTime >= 0.26) { queued.shift(); queueTime = 0; }
          updateTarget();
          scene.draw();
        }
      }
      frame = requestAnimationFrame(renderFrame);
    }
    const nudge = (move) => {
      if (reducedMotion) {
        scene.step(...direction[move], 0.26);
        updateTarget();
        scene.draw();
      } else if (queued.length < 8) queued.push(move);
    };

    for (const button of $$('[data-move]', el)) {
      const move = button.dataset.move;
      button.onclick = (event) => { if (event.detail === 0) nudge(move); };
      button.onpointerdown = (event) => {
        if (event.button !== 0 || hold) return;
        hold = { id: event.pointerId, move, start: performance.now() };
        button.setPointerCapture(event.pointerId);
      };
      const release = (event) => {
        if (hold?.id !== event.pointerId) return;
        if (event.type === 'pointerup' && performance.now() - hold.start <= 180) nudge(move);
        hold = null;
      };
      button.onpointerup = button.onpointercancel = button.onlostpointercapture = release;
    }

    viewport.onpointerdown = (event) => {
      if (event.button !== 0) return;
      viewport.focus({ preventScroll: true });
      drag = { id: event.pointerId, x: event.clientX, origin: event.clientX, moved: false };
      viewport.setPointerCapture(event.pointerId);
    };
    viewport.onpointermove = (event) => {
      if (drag?.id !== event.pointerId) return;
      drag.moved ||= Math.abs(event.clientX - drag.origin) > 5;
      const dx = event.clientX - drag.x;
      drag.x = event.clientX;
      if (drag.moved && dx) {
        scene.step(0, 0, Math.sign(dx), Math.min(0.18, Math.abs(dx) * 0.005));
        updateTarget();
        scene.draw();
      }
    };
    const endDrag = (event) => {
      if (drag?.id !== event.pointerId) return;
      const tap = !drag.moved && event.type === 'pointerup';
      drag = null;
      if (tap && !action.disabled) interact();
    };
    viewport.onpointerup = viewport.onpointercancel = viewport.onlostpointercapture = endDrag;

    el.onkeydown = (event) => {
      if (checkingOut || event.ctrlKey || event.altKey || event.metaKey) return;
      if (keyMoves[event.code]) {
        event.preventDefault();
        pressed.add(event.code);
      } else if ((event.code === 'KeyE' || (event.code === 'Enter' && event.target === viewport)) && !event.repeat) {
        event.preventDefault();
        interact();
      }
    };
    el.onkeyup = (event) => pressed.delete(event.code);
    el.onfocusout = (event) => { if (!el.contains(event.relatedTarget)) stopMotion(); };
    const blur = () => stopMotion();
    window.addEventListener('blur', blur);
    M.onLeave = () => {
      closed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('blur', blur);
      el.onkeydown = el.onkeyup = el.onfocusout = null;
    };
    action.onclick = interact;
    updateNotebook();
    updateTarget();
    scene.draw();
    viewport.focus({ preventScroll: true });
    frame = requestAnimationFrame(renderFrame);

    function interact() {
      if (closed || checkingOut) return;
      const id = scene.target();
      if (id === 'checkout') {
        if (seen.size === items.length) openCheckout();
        else hint.textContent = 'อ่านราคาและขนาดที่ชั้น A กับ B ให้ครบก่อนชำระเงิน';
        return;
      }
      const item = items.find((candidate) => candidate.id === id);
      if (!item) return;
      if (!seen.has(id)) {
        seen.add(id);
        updateNotebook();
        sfx.play('note');
      }
      activeTarget = undefined;
      updateTarget();
      hint.textContent = seen.size === items.length ? 'จดครบทั้งสองป้ายแล้ว เดินไปเคาน์เตอร์เพื่อเทียบ ' + unit :
        'จดชั้น ' + item.shelf + ' แล้ว เดินไปอ่านอีกชั้น';
    }

    function openCheckout() {
      stopMotion();
      checkingOut = true;
      world.classList.add('hidden');
      checkout.classList.remove('hidden');
      if (!$('form', checkout)) {
        const normalize = ctx.product.id === 'water' ? '1,000 มล. = 1 ลิตร' : 'ใช้ฐาน ' + basis + ' ' + denominator + ' เท่ากันทั้งสองชั้น';
        checkout.innerHTML = '<h3 tabindex="-1">เคาน์เตอร์</h3><ul class="walk-records">' +
          items.map((item) => record(item, mission).replace('data-recorded=', 'data-checkout-item=')).join('') +
          '</ul><p class="walk-tip">' + esc(normalize) + ' · ราคา ÷ ปริมาณในแพ็ก' + (basis === 1 ? '' : ' × ' + basis) +
          ' = ' + esc(unit) + '<br>ปัดเป็นทศนิยม 2 ตำแหน่งเมื่อหารไม่ลงตัว</p>' +
          '<form class="walk-checkout-form"><div class="walk-calculations">' + items.map((item) => '<label>ชั้น ' + item.shelf +
          ' · ' + esc(unit) + '<input name="unit-' + item.id + '" inputmode="decimal" required autocomplete="off"></label>').join('') +
          '</div><fieldset><legend>เลือกสินค้า 1 แพ็ก</legend>' + items.map((item, i) => '<label><input type="radio" name="chosen" value="' +
          item.id + '"' + (i === 0 ? ' required' : '') + '> ชั้น ' + item.shelf + ' · ' + esc(item.name) + '</label>').join('') +
          '</fieldset><div class="row"><button type="submit" class="btn primary">ชำระเงินและดูผล</button>' +
          '<button type="button" class="btn ghost walk-inspect-again">กลับไปดูป้าย</button></div></form><div class="walk-feedback" aria-live="polite"></div>';
        $('.walk-inspect-again', checkout).onclick = () => {
          checkingOut = false;
          checkout.classList.add('hidden');
          world.classList.remove('hidden');
          viewport.focus({ preventScroll: true });
        };
        $('form', checkout).onsubmit = pay;
      }
      const heading = $('h3', checkout);
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: 'start' });
    }

    function pay(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const answers = items.map((item) => readDecimal(form.elements.namedItem('unit-' + item.id).value, 2));
      const feedback = $('.walk-feedback', checkout);
      const invalid = answers.findIndex((answer) => answer === null || answer < 0);
      if (invalid >= 0) {
        feedback.textContent = 'กรอกตัวเลขอย่างน้อย 1 หลัก ทศนิยมได้ไม่เกิน 2 ตำแหน่ง';
        form.elements.namedItem('unit-' + items[invalid].id).focus();
        return;
      }
      const choice = items.find((item) => item.id === form.elements.namedItem('chosen').value);
      if (!choice) return;
      const correct = items.map((item, i) => answers[i] === Math.round(item.per * 100));
      const chosenBest = choice === best;
      const points = Number(correct[0]) + Number(correct[1]) + Number(chosenBest);
      for (const control of $$('input, button', form)) control.disabled = true;
      sfx.play(points === 3 ? 'correct' : 'note');
      const formula = (item) => fmt(item.price) + ' ÷ ' + fmt(item.quantity) + (basis === 1 ? '' : ' × ' + basis) + ' = ' + fmt(item.per) + ' ' + unit;
      feedback.innerHTML = '<div class="walk-receipt"><h3>ใบเสร็จ</h3><p>ซื้อ ' + esc(choice.name) + ' · จ่าย ' + fmt(choice.price) +
        ' บาท · เงินเหลือ ' + fmt(budget - choice.price) + ' บาท</p><ul>' +
        items.map((item, i) => '<li>' + (correct[i] ? '✓ ' : '✗ ') + 'ชั้น ' + item.shelf + ' · ' + esc(formula(item)) + '</li>').join('') +
        '</ul><p><b>ชั้น ' + best.shelf + ' คุ้มต่อหน่วยที่สุด</b> · ' + esc(chosenBest ? 'เลือกตรงตามภารกิจ' :
          'ราคาที่จ่ายต่อแพ็กและราคาต่อหน่วยตอบคนละคำถาม') + '</p><button type="button" class="btn primary" data-walk-save>บันทึกผล (' +
          points + '/3)</button></div>';
      const save = $('[data-walk-save]', feedback);
      save.onclick = () => {
        save.disabled = true;
        (ctx.state.shelfWalk ||= {})[ctx.product.id] = { caseIndex, choice: choice.id, score: points / 3 };
        const notebookText = items.map((item) => 'ชั้น ' + item.shelf + ' ' + item.name + ' · ' + item.sizeText + ' · ' + formula(item)).join('\n');
        State.addPortfolio('w2-store-' + ctx.product.id, 2, 'เดินเทียบราคาต่อหน่วย', notebookText +
          '\nซื้อชั้น ' + choice.shelf + ' · จ่าย ' + fmt(choice.price) + ' บาท · คุ้มต่อหน่วยที่สุดคือชั้น ' + best.shelf);
        finish(points / 3, 'ตอบถูก ' + points + ' จาก 3 ข้อ · ชั้น ' + best.shelf + ' คุ้มต่อหน่วยที่สุด');
      };
      save.focus({ preventScroll: true });
      $('.walk-receipt', feedback).scrollIntoView({ block: 'start' });
    }
  };
})();

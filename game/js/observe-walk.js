/* observe-walk.js — W1R2 เดินสังเกตลูกค้าในร้านมุมมองบุคคลที่หนึ่ง (GDD §9 ภารกิจเดินสังเกต)
 * หน้านี้แทนเฉพาะขั้นเก็บหลักฐาน · การจด คะแนน และเซฟอยู่ใน observe-walk-model.js
 * ขั้นวิเคราะห์ เทียบช่วง ข้อเสนอ และแฟ้มผลงานใช้สมุดเดิมใน time-compare.js */
(function () {
  const M = window.MTL;
  const { $, $$, esc, sfx, State } = M;
  const OM = M.ObserveModel;
  const START = { x: 0, z: 2.3, yaw: 0 };
  const EVENING = 'rgba(122, 58, 24, .17)';
  const RING = 'rgba(255, 214, 90, .2)';

  // คิวเสียงตาม docs/AUDIO_SPEC.md: เล่นคีย์ใหม่เมื่อมีใน manifest แล้ว ระหว่างรอไฟล์ใช้เสียงเดิมหรือภาพแทน
  const lastCue = {};
  function cue(key, fallback, gapSeconds) {
    const now = performance.now();
    if (now - (lastCue[key] ?? -Infinity) < gapSeconds * 1000) return;
    lastCue[key] = now;
    if ((window.MTL_AUDIO_MANIFEST || {})[key]) sfx.play(key);
    else if (fallback) sfx.play(fallback);
  }

  M.playObserveWalk = (el, ctx, finish, classic) => M.playTimeCompare(el, ctx, finish, {
    route: 'walk', gather: (root, session, done) => gather(root, ctx, session, done, classic),
  });

  function gather(el, ctx, session, done, classic) {
    const { product } = ctx;
    const { periods, timeLabel } = session;
    const sprites = window.MTL_SPRITE_MANIFEST || {};
    let periodIndex = 0, clock = periods[0].start, captionKey = '', focus = null;

    el.innerHTML = `<section class="observe-walk" aria-label="ภารกิจเดินสังเกตลูกค้า">
      <div class="walk-brief"><p><strong>ภารกิจ</strong> คุณเป็นผู้ช่วยร้าน เดินเข้าใกล้ลูกค้า ฟังคำถามหรือดูสิ่งที่ทำ แล้วจดลงสมุดพร้อมเวลา
        เช้า 3 คน เย็น 2 คน เพื่อเสนอว่าแต่ละช่วงควรจัดชั้นวางหรือบริการอย่างไร</p>
        <button type="button" class="btn small ghost" data-walk-classic>ใช้แบบรายการเดิม</button></div>
      <p class="ow-example"><b>จดอะไร</b> จดคำพูดหรือการกระทำที่เกิดขึ้นจริง เช่น ได้ยิน “${esc(product.small.name)} ใส่กระเป๋าได้ไหม”
        ส่วน “ลูกค้าอยากพกง่าย” เป็นเหตุผลที่เราคิดต่อ ใช้ตอนวิเคราะห์</p>
      <div class="ow-hud" role="group" aria-label="สถานะภารกิจ"><span class="ow-tag">จำลอง</span>
        <span class="ow-period"></span><b class="ow-clock"></b><span class="ow-progress"></span>
        ${State.data.settings.sound ? '' : '<span class="ow-muted">🔇 ปิดเสียงอยู่ อ่านคำบรรยายใต้ภาพได้ครบ</span>'}</div>
      <div class="walk-world"><div class="ow-stage"><div class="walk-viewport" tabindex="0" role="region"
          aria-label="ร้านมุมมองบุคคลที่หนึ่ง ใช้ลูกศรหรือ WASD เดิน Q หรือ R หัน และ E จดหลักฐาน">
        <canvas width="960" height="540" aria-hidden="true"></canvas><span class="walk-reticle" aria-hidden="true">+</span></div>
        <div class="ow-caption" aria-live="polite" aria-atomic="true"></div></div>
        <div class="walk-controls">${M.WalkControls.pad()}
          <div class="walk-act"><div class="row ow-actions"><button type="button" class="btn primary" data-ow-record disabled>เข้าใกล้ลูกค้าเพื่อจด</button>
            <button type="button" class="btn ghost" data-ow-replay disabled>อ่านคำพูดซ้ำ</button></div>
            <small class="muted">ลูกศร / WASD เดิน · Q/R หัน · E จด · แตะภาพเพื่อจด</small></div></div>
        <p class="walk-hint"></p>
        <section class="ow-list" aria-labelledby="ow-list-title"><h3 id="ow-list-title">ลูกค้าในช่วงนี้</h3><ul></ul></section>
        <section class="walk-notebook" aria-labelledby="ow-book-title"><h3 id="ow-book-title">สมุดสังเกต</h3>
          <table class="tbl ow-book"><thead><tr><th scope="col">เวลา</th><th scope="col">สิ่งที่เห็นหรือได้ยิน</th></tr></thead><tbody></tbody></table></section>
        <div class="row ow-next-row"><button type="button" class="btn primary ow-next" disabled></button><span class="muted ow-next-why"></span></div>
      </div></section>`;

    const period = () => periods[periodIndex];
    const events = () => session.periodEvents(period().id);
    const level = (sense) => !sense ? 'none' : sense.ready ? 'ready' : sense.heard ? 'heard' : sense.seen ? 'seen' : 'none';

    const viewport = $('.walk-viewport', el), caption = $('.ow-caption', el), hint = $('.walk-hint', el);
    const recordButton = $('[data-ow-record]', el), replayButton = $('[data-ow-replay]', el), next = $('.ow-next', el);
    $('[data-walk-classic]', el).onclick = classic;

    const actorFor = (event) => ({ id: event.id, x: event.spot.x, z: event.spot.z, sprite: sprites[event.sprite],
      bubble: session.isRecorded(event.id) ? '✓' : '!', bubbleColor: session.isRecorded(event.id) ? '#cdeccf' : '#ffde59',
      ring: session.isRecorded(event.id) ? 0 : OM.SENSE.hear, ringColor: RING });
    const stations = [
      { id: 'a', price: product.small.price, sizeText: product.small.name, icon: product.emoji.small, sprite: sprites[`item_${product.id}_small`] },
      { id: 'b', price: product.big.price, sizeText: product.big.name, icon: product.emoji.big, sprite: sprites[`item_${product.id}_big`] },
      { id: 'checkout' },
    ];
    const scene = M.ShelfWalkScene.create($('canvas', viewport), { stations, start: START,
      actors: session.periodEvents(periods[0].id).map(actorFor) });
    if (!scene) {
      caption.textContent = 'เครื่องนี้เปิดฉากร้านไม่ได้ กด “ใช้แบบรายการเดิม” เพื่อเล่นรอบนี้';
      return;
    }

    let lastPose = scene.pose();
    const controls = M.WalkControls.attach({ root: el, viewport, scene, onMove: moved, onInteract: interact });
    M.onLeave = () => controls.destroy();
    recordButton.onclick = record;
    replayButton.onclick = () => replay(true);
    next.onclick = advance;
    showPeriod();
    viewport.focus({ preventScroll: true });

    function moved() {
      const pose = scene.pose();
      if (Math.hypot(pose.x - lastPose.x, pose.z - lastPose.z) > 0.01) cue('step_shop', null, 0.42);
      lastPose = pose;
      sense();
    }

    // เลือกลูกค้าที่รับรู้ชัดที่สุด: จดได้ > ได้ยิน > เห็น · ระยะใกล้กว่าชนะ
    function sense() {
      const pose = scene.pose();
      const rank = { ready: 3, heard: 2, seen: 1, none: 0 };
      const sensed = events().map((event) => ({ event, sense: OM.perceive(pose, event) }));
      sensed.sort((a, b) => rank[level(b.sense)] - rank[level(a.sense)] || a.sense.distance - b.sense.distance);
      const best = sensed[0] && level(sensed[0].sense) !== 'none' ? sensed[0] : null;
      focus = best;
      const id = best ? best.event.id : '';
      const key = best ? `${id}:${level(best.sense)}:${session.isRecorded(id)}` : '';
      viewport.dataset.focus = id;
      viewport.dataset.level = best ? level(best.sense) : 'none';
      if (best && (best.sense.heard || best.sense.ready) && best.event.minute !== clock) {
        clock = best.event.minute;
        $('.ow-clock', el).textContent = timeLabel(clock);
      }
      updateActions();
      updateHint(sensed);
      if (key !== captionKey) {
        captionKey = key;
        renderCaption();
        if (best?.sense.heard) cue('tick', 'tick', 0.3);
      }
    }

    function renderCaption() {
      if (!focus) {
        caption.innerHTML = `<p class="ow-line muted">ยังไม่มีลูกค้าอยู่ใกล้ ดูทิศทางใต้ปุ่มเดิน หรือใช้รายการลูกค้า</p>`;
        return;
      }
      const { event, sense } = focus;
      const done = session.isRecorded(event.id);
      const lines = [];
      if (sense.seen || sense.ready) lines.push(`<p class="ow-line"><span aria-hidden="true">👀</span> <b>เห็น</b> ${esc(event.place)} — ${esc(event.seen)}</p>`);
      if (sense.heard) lines.push(`<p class="ow-line ow-quote"><span aria-hidden="true">👂</span> <b>ได้ยิน ${timeLabel(event.minute)}</b> ลูกค้าพูดว่า ${esc(event.heard)}</p>`);
      if (!sense.heard) lines.push('<p class="ow-line muted">เข้าใกล้อีกนิดจนถึงวงสีเหลืองบนพื้นเพื่อฟังคำพูด</p>');
      else if (!sense.ready) lines.push(`<p class="ow-line muted">หันไปทางลูกค้า (${OM.direction(sense.bearing)}) เพื่อดูสิ่งที่ทำก่อนจด</p>`);
      else lines.push(`<p class="ow-line muted">${done ? `แถว ${timeLabel(event.minute)} อยู่ในสมุดแล้ว` : 'กด “จดลงสมุด” หรือ E เพื่อจดพร้อมเวลา'}</p>`);
      caption.innerHTML = lines.join('');
    }

    function updateActions() {
      const ready = focus?.sense.ready ? focus.event : null;
      const done = ready && session.isRecorded(ready.id);
      recordButton.disabled = !ready;
      recordButton.dataset.target = ready ? ready.id : '';
      recordButton.textContent = !ready ? 'เข้าใกล้ลูกค้าเพื่อจด' : done ? `จดแล้ว ${timeLabel(ready.minute)} ✓` : `จดลงสมุด ${timeLabel(ready.minute)}`;
      replayButton.disabled = !focus?.sense.heard;
    }

    function updateHint(sensed) {
      const waiting = sensed.filter(({ event }) => !session.isRecorded(event.id)).sort((a, b) => a.sense.distance - b.sense.distance);
      if (!waiting.length) {
        hint.textContent = periodIndex === 0 ? 'จดช่วงเช้าครบ 3 คนแล้ว กด “ไปช่วงเย็น”' : 'จดครบ 5 เหตุการณ์แล้ว กด “ไปวิเคราะห์ในสมุด”';
        return;
      }
      const { event, sense } = waiting[0];
      hint.textContent = sense.ready ? `ลูกค้าที่${event.place}อยู่ตรงหน้า พร้อมจด` :
        `ลูกค้าที่ยังไม่ได้จดใกล้สุด: ${event.place} ${OM.direction(sense.bearing)} ${M.fmt(sense.distance, 1)} ม.`;
    }

    function interact() {
      if (focus?.sense.ready && !session.isRecorded(focus.event.id)) record();
      else if (focus?.sense.heard) replay(true);
      else hint.textContent = 'ยังไม่มีลูกค้าในระยะได้ยิน เดินเข้าใกล้วงสีเหลืองบนพื้น หรือใช้รายการลูกค้า';
    }

    function replay(announce) {
      if (!focus?.sense.heard) return;
      cue('tick', 'tick', 0.3);
      if (announce) { caption.textContent = ''; setTimeout(renderCaption, 60); }
    }

    function record() {
      const event = focus?.sense.ready ? focus.event : null;
      if (!event) return;
      const { added } = session.record(event.id);
      if (added) {
        cue('notebook', 'note', 0.2);
        Object.assign(scene.actors.find((actor) => actor.id === event.id), { bubble: '✓', bubbleColor: '#cdeccf', ring: 0 });
        scene.draw();
      }
      fillNotebook(event.id);
      fillList();
      updateProgress();
      captionKey = '';
      sense();
      caption.insertAdjacentHTML('afterbegin', `<p class="ow-line ow-saved">${added ? '📝 จดลงสมุดแล้ว' : '📒 มีแถวนี้ในสมุดแล้ว'} ${timeLabel(event.minute)}</p>`);
    }

    function fillNotebook(flash) {
      const rows = session.notebook();
      $('.ow-book tbody', el).innerHTML = rows.map((event) => `<tr data-row="${event.id}"${event.id === flash ? ' class="ow-flash"' : ''}>
        <td>${timeLabel(event.minute)}</td><td>${esc(event.observedText)}</td></tr>`).join('') ||
        '<tr><td colspan="2" class="muted">ยังไม่มีแถว เดินไปหาลูกค้าที่มีเครื่องหมาย !</td></tr>';
    }

    function fillList() {
      $('.ow-list ul', el).innerHTML = events().map((event) => {
        const done = session.isRecorded(event.id);
        return `<li><button type="button" class="btn small" data-ow-go="${event.id}">ไปหาลูกค้าที่${esc(event.place)}</button>
          <span class="ow-state">${done ? `✓ จดแล้ว ${timeLabel(event.minute)}` : '! ยังไม่ได้จด'}</span></li>`;
      }).join('');
      for (const button of $$('[data-ow-go]', el)) button.onclick = () => goTo(session.get(button.dataset.owGo));
    }

    // ทางเลือกแบบรายการภายในฉาก: พาไปยืนหน้าลูกค้าและหันเข้าหา แล้วให้ผู้เล่นกดจดเอง
    function goTo(event) {
      const front = OM.approachPose(event);
      const placed = [0, 0.35, -0.35, 0.7, -0.7].some((offset) => scene.place({ ...front, x: front.x + offset,
        yaw: Math.atan2(event.spot.x - front.x - offset, event.spot.z - front.z) }));
      if (!placed) return;
      scene.draw();
      lastPose = scene.pose();
      sense();
      (recordButton.disabled ? viewport : recordButton).focus({ preventScroll: true });
    }

    function updateProgress() {
      const current = period();
      $('.ow-period', el).textContent = current.label;
      $('.ow-clock', el).textContent = timeLabel(clock);
      $('.ow-progress', el).textContent = `จด ${session.recordedCount(current.id)}/${events().length} · รวม ${session.recordedCount()}/${session.events.length}`;
      const last = periodIndex === periods.length - 1;
      const ready = last ? session.allRecorded() : session.periodDone(current.id);
      next.textContent = last ? 'ไปวิเคราะห์ในสมุด' : 'ไปช่วงเย็น';
      next.disabled = !ready;
      $('.ow-next-why', el).textContent = ready ? '' : last ? `จดให้ครบ ${session.events.length} เหตุการณ์ก่อน` :
        `จดช่วงเช้าให้ครบ ${events().length} คนก่อน (ตอนนี้ ${session.recordedCount(current.id)})`;
    }

    function showPeriod() {
      const current = period();
      clock = current.start;
      scene.actors.splice(0, scene.actors.length, ...events().map(actorFor));
      scene.ambience.tint = periodIndex ? EVENING : null;
      scene.place(START);
      lastPose = scene.pose();
      scene.draw();
      fillNotebook();
      fillList();
      updateProgress();
      captionKey = '';
      sense();
      caption.insertAdjacentHTML('afterbegin', `<p class="ow-line"><b>${current.label} ${timeLabel(current.start)}</b> ลูกค้า ${events().length} คนอยู่ในร้าน มองหาเครื่องหมาย ! เหนือศีรษะ</p>`);
    }

    function advance() {
      if (next.disabled) return;
      if (periodIndex < periods.length - 1) {
        periodIndex++;
        cue('door', 'door', 0.3);
        showPeriod();
        viewport.focus({ preventScroll: true });
        return;
      }
      controls.destroy();
      M.onLeave = null;
      done();
    }
  }
})();

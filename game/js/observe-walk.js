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
  const WALK_SPEED = 2.4;     // เมตรต่อวินาที ลูกค้าที่เดินเข้ามาที่เคาน์เตอร์
  const STRIDE_LENGTH = 1.1;  // เมตรต่อหนึ่งรอบก้าว (ซ้ายและขวา)

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
    let periodIndex = 0, clock = periods[0].start, captionKey = '', focus = null, walker = 0;
    let replayTimer;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // ลูกค้าเริ่มด้วยท่ายืน เมื่อผู้เล่นเห็นหรือได้ยินครั้งแรกจึงเปลี่ยนเป็นท่ากระทำของเหตุการณ์และคงท่านั้นไว้
    const performed = new Set();

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
            <button type="button" class="btn ghost" data-ow-replay disabled>ฟังหรืออ่านคำพูดซ้ำ</button></div>
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

    const spriteOf = (event) => sprites[performed.has(event.id) && sprites[event.pose] ? event.pose : event.sprite];
    const actorFor = (event) => {
      const arriving = !!event.enter && !reducedMotion && !session.isRecorded(event.id);
      const from = arriving ? event.enter[0] : event.spot;
      return { id: event.id, x: from.x, z: from.z, sprite: spriteOf(event), arriving,
        path: arriving ? [...event.enter.slice(1), event.spot] : [],
        bubble: session.isRecorded(event.id) ? '✓' : '!', bubbleColor: session.isRecorded(event.id) ? '#cdeccf' : '#ffde59',
        ring: session.isRecorded(event.id) || arriving ? 0 : OM.SENSE.hear, ringColor: RING };
    };
    const actorOf = (id) => scene.actors.find((actor) => actor.id === id);
    const arriving = (id) => !!actorOf(id)?.arriving;
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

    const controls = M.WalkControls.attach({ root: el, viewport, scene, onMove: sense, onInteract: interact });
    M.onLeave = () => {
      cancelAnimationFrame(walker);
      clearTimeout(replayTimer);
      controls.destroy();
      M.stopSpeaking();
    };
    recordButton.onclick = record;
    replayButton.onclick = replay;
    next.onclick = advance;
    showPeriod();
    viewport.focus({ preventScroll: true });

    // เลือกลูกค้าที่รับรู้ชัดที่สุด: จดได้ > ได้ยิน > เห็น · ระยะใกล้กว่าชนะ
    function sense() {
      const pose = scene.pose();
      const rank = { ready: 3, heard: 2, seen: 1, none: 0 };
      // ลูกค้าที่ยังเดินไม่ถึงจุดยังเห็นและได้ยินไม่ได้
      const sensed = events().filter((event) => !arriving(event.id)).map((event) => ({ event, sense: OM.perceive(pose, event) }));
      for (const { event, sense } of sensed) if (sense.seen || sense.heard) performed.add(event.id);
      showPoses();
      sensed.sort((a, b) => rank[level(b.sense)] - rank[level(a.sense)] || a.sense.distance - b.sense.distance);
      const best = sensed[0] && level(sensed[0].sense) !== 'none' ? sensed[0] : null;
      const previouslyHeard = focus?.sense.heard ? focus.event.id : '';
      focus = best;
      const id = best ? best.event.id : '';
      const key = best ? `${id}:${best.sense.ready}:${best.sense.seen}:${best.sense.heard}:${session.isRecorded(id)}` : '';
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
      }
      if (best?.sense.heard && id !== previouslyHeard) cue('tick', 'tick', 0.3);
    }

    function renderCaption() {
      clearTimeout(replayTimer);
      if (!focus) {
        caption.innerHTML = `<p class="ow-line muted">ยังไม่มีลูกค้าอยู่ใกล้ ดูทิศทางใต้ปุ่มเดิน หรือใช้รายการลูกค้า</p>`;
        return;
      }
      const { event, sense } = focus;
      const done = session.isRecorded(event.id);
      const lines = [];
      if (sense.seen) lines.push(`<p class="ow-line"><span aria-hidden="true">👀</span> <b>เห็น</b> ${esc(event.place)} — ${esc(event.seen)}</p>`);
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

    // ท่ายืน ท่าก้าว หรือท่ากระทำของลูกค้าแต่ละคน · data-poses ใช้ตรวจในชุดทดสอบ
    function showPoses() {
      let changed = false;
      for (const actor of scene.actors) {
        if (actor.arriving) continue;
        const sprite = spriteOf(session.get(actor.id));
        if (actor.sprite !== sprite) {
          if (sprite === sprites[session.get(actor.id).pose]) actor.popAt = performance.now() / 1000;
          actor.sprite = sprite;
          changed = true;
        }
      }
      viewport.dataset.poses = scene.actors.map((actor) =>
        `${actor.id}:${actor.arriving ? 'walk' : performed.has(actor.id) ? 'action' : 'idle'}`).join(' ');
      if (changed) scene.draw();
    }

    function arrive(actor) {
      const event = session.get(actor.id);
      Object.assign(actor, { x: event.spot.x, z: event.spot.z, arriving: false, path: [], sprite: spriteOf(event),
        ring: session.isRecorded(event.id) ? 0 : OM.SENSE.hear });
    }

    // ท่าทางลูกค้า (M.StudMotion): เดิน 4 จังหวะสลับเท้า ตัวเด้ง ฝุ่นที่เท้า หายใจตอนยืน และเด้งตอนเปลี่ยนเป็นท่ากระทำ
    // ลูกค้าที่มีจุดเริ่ม enter เดินผ่านจุดแวะจนถึงจุดของเหตุการณ์ · ตั้งลดการเคลื่อนไหวแล้วไม่วาดซ้ำเลย
    function animate() {
      cancelAnimationFrame(walker);
      if (reducedMotion) return;
      let last = 0, drawn = 0;
      const frame = (now) => {
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
        const t = now / 1000;
        last = now;
        let moving = false;
        scene.actors.forEach((actor, n) => {
          const event = session.get(actor.id);
          const motion = actor.motion || (actor.motion = { puffs: [] });
          motion.puffs = motion.puffs.filter((puff) => (puff.age += dt) < 0.5);
          if (actor.arriving) {
            moving = true;
            const [goal] = actor.path;
            const dx = goal.x - actor.x, dz = goal.z - actor.z, distance = Math.hypot(dx, dz), move = WALK_SPEED * dt;
            actor.walked = (actor.walked || 0) + Math.min(distance, move);
            if (distance <= move) {
              if (actor.path.length > 1) Object.assign(actor, actor.path.shift());
              else arrive(actor);
            } else {
              actor.x += dx / distance * move;
              actor.z += dz / distance * move;
            }
          }
          if (actor.arriving) {
            const step = M.StudMotion.walk(actor.walked, STRIDE_LENGTH);
            actor.sprite = sprites[step.frame === 'walk' && sprites[event.walk] ? event.walk : event.sprite];
            if (step.step !== motion.step) motion.puffs.push({ age: 0, side: step.step ? 1 : -1 });
            Object.assign(motion, { step: step.step, flip: step.flip, lift: step.lift, sx: 1, sy: step.squash, sparkle: 0 });
          } else {
            const pop = M.StudMotion.pop(t - (actor.popAt ?? -9));
            Object.assign(motion, { flip: false, lift: 0, sx: pop.sx, sy: pop.sy * M.StudMotion.idle(t, n), sparkle: pop.sparkle });
          }
        });
        // เดินอยู่วาดทุกเฟรม ยืนเฉย ๆ วาดราว 20 ภาพต่อวินาที
        if (moving || now - drawn > 50) {
          scene.draw();
          drawn = now;
        }
        if (moving) sense();
        walker = requestAnimationFrame(frame);
      };
      walker = requestAnimationFrame(frame);
    }

    function updateHint(sensed) {
      const waiting = sensed.filter(({ event }) => !session.isRecorded(event.id)).sort((a, b) => a.sense.distance - b.sense.distance);
      if (!waiting.length && scene.actors.some((actor) => actor.arriving)) {
        hint.textContent = 'ลูกค้าอีกคนกำลังเดินไปที่เคาน์เตอร์ รอให้ถึงก่อนจึงฟังได้';
        return;
      }
      if (!waiting.length) {
        hint.textContent = periodIndex === 0 ? 'จดช่วงเช้าครบ 3 คนแล้ว กด “ไปช่วงเย็น”' : 'จดครบ 5 เหตุการณ์แล้ว กด “ไปวิเคราะห์ในสมุด”';
        return;
      }
      const { event, sense } = waiting[0];
      hint.textContent = sense.ready ? `ลูกค้าที่${event.place}อยู่ในระยะจด` :
        `ลูกค้าที่ยังไม่ได้จดใกล้สุด: ${event.place} ${OM.direction(sense.bearing)} ${M.fmt(sense.distance, 1)} ม.`;
    }

    function interact() {
      if (focus?.sense.ready && !session.isRecorded(focus.event.id)) record();
      else if (focus?.sense.heard) replay();
      else hint.textContent = 'ยังไม่มีลูกค้าในระยะได้ยิน เดินเข้าใกล้วงสีเหลืองบนพื้น หรือใช้รายการลูกค้า';
    }

    function replay() {
      if (!focus?.sense.heard) return;
      cue('tick', 'tick', 0.3);
      const { sound, tts } = State.data.settings;
      if (sound && tts) M.speak(focus.event.heard, 'th-TH');
      caption.textContent = '';
      clearTimeout(replayTimer);
      replayTimer = setTimeout(renderCaption, 60);
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
      const walking = actorOf(event.id);
      if (walking?.arriving) arrive(walking);
      const front = OM.approachPose(event);
      const placed = [0, 0.35, -0.35, 0.7, -0.7].some((offset) => scene.place({ ...front, x: front.x + offset,
        yaw: Math.atan2(event.spot.x - front.x - offset, event.spot.z - front.z) }));
      if (!placed) return;
      scene.draw();
      sense();
      const target = recordButton.disabled ? viewport : recordButton;
      const { top, bottom } = target.getBoundingClientRect();
      const headerBottom = $('.topbar')?.getBoundingClientRect().bottom ?? 0;
      if (top < headerBottom || bottom > window.innerHeight) {
        target.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
      target.focus({ preventScroll: true });
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
      scene.draw();
      animate();
      fillNotebook();
      fillList();
      updateProgress();
      captionKey = null;
      sense();
      caption.insertAdjacentHTML('afterbegin', `<p class="ow-line"><b>${current.label} ${timeLabel(current.start)}</b> ลูกค้า ${events().length} คนอยู่ในร้าน มองหาเครื่องหมาย ! เหนือศีรษะ</p>`);
    }

    function advance() {
      if (next.disabled) return;
      M.stopSpeaking();
      if (periodIndex < periods.length - 1) {
        periodIndex++;
        cue('door', 'door', 0.3);
        showPeriod();
        viewport.focus({ preventScroll: true });
        return;
      }
      cancelAnimationFrame(walker);
      clearTimeout(replayTimer);
      controls.destroy();
      M.onLeave = null;
      done();
    }
  }
})();

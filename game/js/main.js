/* main.js — หน้าจอและการนำทาง (Claude) */
(function () {
  const M = window.MTL;
  const { $, $$, esc, sfx, State } = M;
  const app = $('#app');
  const titleIntro = $('.hero', app);
  const lessonScripts = $$('script[src]', $('#lesson-scripts').content);
  const shelfWalkScripts = $$('script[src]', $('#shelf-walk-scripts').content);
  const observeWalkScripts = $$('script[src]', $('#observe-walk-scripts').content);
  const scriptLoads = new Map();
  let currentScreen = 0;
  // ฉากเดินในร้านรุ่นทดลอง: W1R2 สังเกตลูกค้า และ W2R2 เทียบราคา · #observe-walk หรือ #shelf-walk เปิดรอบนั้นหลังเลือกสินค้า
  const previewRound = { '#shelf-walk': [1, 1], '#observe-walk': [0, 1] }[location.hash];
  State.load();

  const product = () => M.PRODUCTS[State.data.product];
  const ctxFor = (week, idx) => ({ product: product(), state: State.data, week, idx });
  const weekStars = (w) => M.WEEKS[w].rounds.reduce((a, _, r) => a + ((State.round(w, r) || {}).stars || 0), 0);
  const weekDone = (w) => M.WEEKS[w].rounds.every((_, r) => State.round(w, r));
  const weekOpen = (w) => State.data.settings.unlockAll || w === 0 || weekDone(w - 1);
  const roundOpen = (w, r) => State.data.settings.unlockAll || r === 0 || !!State.round(w, r - 1);
  const starStr = (n, max = 3) => '★'.repeat(n) + '☆'.repeat(max - n);

  function leave() {
    currentScreen++;
    if (M.onLeave) { M.onLeave(); M.onLeave = null; }
    M.stopSpeaking();
  }

  function header() {
    const P = product();
    $('#productBadge').textContent = P ? `${P.icon} ${P.th}` : '';
    $('#starBadge').textContent = `⭐ ${State.totalStars()} / ${M.WEEKS.length * 15 + 3}`;
    $('#soundBtn').classList.toggle('off', !State.data.settings.sound);
    $('#ttsBtn').classList.toggle('off', !State.data.settings.tts);
    $('#soundBtn').setAttribute('aria-pressed', String(State.data.settings.sound));
    $('#ttsBtn').setAttribute('aria-pressed', String(State.data.settings.tts));
  }

  // ---------- หน้าเริ่ม ----------
  function titleScreen() {
    leave();
    if (titleIntro.parentNode !== app) app.replaceChildren(titleIntro);
    $('.card', app)?.remove();
    titleIntro.dataset.entry = previewRound ? 'mission' : 'campaign';
    const disabled = product() ? '' : 'disabled';
    app.insertAdjacentHTML('beforeend', `
      <section class="card shop-setup" aria-labelledby="product-title"><h2 id="product-title">เลือกสินค้าที่จะใช้ฝึก</h2>
      <div class="product-pick" aria-labelledby="product-title" role="group">${Object.values(M.PRODUCTS).map((p) => {
        const selected = State.data.product === p.id;
        return `<button type="button" data-p="${p.id}" class="${selected ? 'sel' : ''}" aria-pressed="${selected}">
          <img src="assets/sprites/item_${p.id}_big.png" alt="" width="48" height="56">
          <span><b>${p.th}</b><small class="muted">${esc(p.small.name)} · ${esc(p.big.name)}</small></span></button>`;
      }).join('')}</div>
      <div class="shop-start">
        <label class="player-field" for="pname">ชื่อผู้ฝึก <small class="muted">(ใช้ในแฟ้มผลงาน)</small>
          <input id="pname" maxlength="40" value="${esc(State.data.player)}" placeholder="เว้นว่างได้" autocomplete="off"></label>
        <button type="button" class="btn primary shop-start-button" id="startBtn" ${disabled}>${previewRound ? 'เข้าร้าน →' : 'เริ่มแผนฝึก →'}</button>
      </div>
      ${previewRound ? '' : `<div class="shop-missions"><h3>ลองภารกิจเดินในร้าน</h3>
        <div class="mission-links"><button type="button" class="btn" data-mission="0" ${disabled}>เดินสังเกตลูกค้า <span aria-hidden="true">→</span></button>
        <button type="button" class="btn" data-mission="1" ${disabled}>เทียบราคาและจ่ายเงิน <span aria-hidden="true">→</span></button></div></div>`}
      </section>`);
    $$('.product-pick button').forEach((b) => (b.onclick = () => {
      sfx.play('click'); State.data.product = b.dataset.p; State.save();
      $$('.product-pick button').forEach((x) => {
        x.classList.toggle('sel', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
      $$('#startBtn, [data-mission]', app).forEach((button) => { button.disabled = false; });
      header();
    }));
    const enter = (round) => {
      State.data.player = $('#pname').value.trim(); State.save(); sfx.play('door');
      if (round) playScreen(round[0], round[1]);
      else mapScreen();
    };
    $('#startBtn').onclick = () => enter(previewRound);
    $$('[data-mission]', app).forEach((button) => { button.onclick = () => enter([Number(button.dataset.mission), 1]); });
  }

  // ---------- แผนที่ 8 สัปดาห์ ----------
  function rubric() {
    const by = {};
    Object.keys(M.SKILLS).forEach((k) => (by[k] = []));
    M.WEEKS.forEach((W, w) => W.rounds.forEach((R, r) => { const s = State.round(w, r); if (s) by[R.skill].push(s.stars); }));
    const fin = State.data.rounds['final-0']; if (fin) by.num.push(fin.stars);
    let total = 0;
    const rows = Object.entries(M.SKILLS).map(([k, label]) => {
      const a = by[k], avg = a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0, pts = Math.round((avg / 3) * 2 * 10) / 10;
      total += pts;
      return `<div class="r"><span>${label}</span><div class="bar"><i style="width:${(pts / 2) * 100}%"></i></div><b>${pts}/2</b></div>`;
    });
    return { html: rows.join(''), total: Math.round(total * 10) / 10 };
  }

  function mapScreen() {
    leave(); header();
    if (!product()) return titleScreen();
    const rb = rubric();
    const nextWeek = M.WEEKS.findIndex((_, week) => weekOpen(week) && !weekDone(week));
    const nextRound = nextWeek < 0 ? null : M.WEEKS[nextWeek].rounds.findIndex((_, round) => !State.round(nextWeek, round));
    const nextTitle = nextRound === null ? 'แบบทดสอบท้ายแผน' : M.WEEKS[nextWeek].rounds[nextRound].title;
    const totalRounds = M.WEEKS.reduce((count, week) => count + week.rounds.length, 0);
    const playedRounds = M.WEEKS.reduce((count, week, w) => count + week.rounds.filter((_, r) => State.round(w, r)).length, 0);
    app.innerHTML = `<div class="play-head"><div><h1>แผนฝึก 8 สัปดาห์</h1><p class="muted">สัปดาห์ละ 5 รอบ · รอบที่ 1–4 การตลาดและภาษาอังกฤษ · รอบที่ 5 การเงิน บัญชี ภาษี หรือการลงทุน</p></div>
      <div class="row" style="margin:0"><button class="btn" id="pfBtn">📁 แฟ้มผลงาน</button><button class="btn" id="finalBtn">📝 แบบทดสอบท้ายแผน</button></div></div>
      <section class="campaign-card" aria-labelledby="campaign-next"><div><small>${nextRound === null ? 'ฝึกครบแผนแล้ว' : `สัปดาห์ ${nextWeek + 1} · รอบ ${nextRound + 1}`}</small>
        <h2 id="campaign-next">${esc(nextTitle)}</h2><label class="campaign-count" for="campaign-progress">เล่นจบ ${playedRounds} / ${totalRounds} รอบ</label>
        <progress id="campaign-progress" value="${playedRounds}" max="${totalRounds}"></progress></div>
        <button type="button" class="btn campaign-action" id="continueBtn">${nextRound === null ? 'เปิดแบบทดสอบ' : playedRounds ? 'เล่นต่อ' : 'เริ่มรอบแรก'} →</button></section>
      <div class="weeks">${M.WEEKS.map((W, w) => {
        const open = weekOpen(w), st = weekStars(w);
        return `<button class="week" data-w="${w}" ${w === nextWeek ? 'aria-current="step"' : ''} ${open ? '' : 'disabled'}>${open ? '' : '<span class="lock" aria-hidden="true">🔒</span>'}<div class="wk">สัปดาห์ ${w + 1}</div><h3>${esc(W.title)}</h3>
          <div class="stars">⭐ ${st} / 15</div><div class="progress"><i style="width:${(st / 15) * 100}%"></i></div></button>`;
      }).join('')}</div>
      <div class="grid g2" style="margin-top:18px">
        <div class="card"><h3>เกณฑ์ให้คะแนนงานส่งท้าย</h3><div class="rubric">${rb.html}</div>
        <p style="margin-top:10px">คะแนนรวม <b>${rb.total} / 10</b> · เป้าหมาย ≥ 8 และทุกด้าน ≥ 1</p></div>
        <div class="card"><h3>วิธีฝึกแต่ละรอบ (30 นาที)</h3>
        <p>📖 <b>8 นาที</b> อ่านหลักการ ลองอธิบายด้วยภาษาตัวเอง</p><p>🛠️ <b>17 นาที</b> เล่นรอบในเกม + ทำใบงานจริงกับร้านใกล้บ้าน</p><p>✅ <b>5 นาที</b> ตรวจผล จดสิ่งที่ต้องแก้</p>
        <p class="muted">ตัวเลขในเกมเป็นข้อมูลจำลอง ให้กำกับในใบงานเสมอว่าข้อมูลใดจริง ข้อมูลใดจำลอง</p></div></div>`;
    $$('.week').forEach((b) => (b.onclick = () => { sfx.play('click'); weekScreen(+b.dataset.w); }));
    $('#continueBtn').onclick = () => nextRound === null ? playScreen('final', 0) : playScreen(nextWeek, nextRound);
    $('#pfBtn').onclick = portfolioScreen;
    $('#finalBtn').onclick = () => playScreen('final', 0);
  }

  // ---------- หน้าสัปดาห์ ----------
  function weekScreen(w) {
    leave(); header();
    const W = M.WEEKS[w];
    app.innerHTML = `<button class="btn ghost small" id="back">← แผนที่</button>
      <h1>สัปดาห์ ${w + 1}: ${esc(W.title)}</h1><div class="task"><b>เป้าหมาย</b> ${esc(W.goal)}</div>
      <div class="rounds">${W.rounds.map((R, r) => {
        const s = State.round(w, r), open = roundOpen(w, r);
        return `<button class="round ${s ? 'done' : ''}" data-r="${r}" ${open ? '' : 'disabled'}><span class="n">${s ? '✓' : r + 1}</span>
          <span><span class="t">รอบ ${r + 1} ${esc(R.title)}</span><span class="tag">${M.SKILLS[R.skill]}</span><br><span class="s">${R.theory.replace(/<[^>]+>/g, '')}</span></span>
          <span class="stars">${open ? starStr(s ? s.stars : 0) : '🔒'}</span></button>`;
      }).join('')}</div>`;
    $('#back').onclick = mapScreen;
    $$('.round').forEach((b) => (b.onclick = () => { sfx.play('click'); playScreen(w, +b.dataset.r); }));
  }

  // ---------- หน้าเล่น ----------
  function loadScript(reference) {
    const src = reference.getAttribute('src');
    if (!scriptLoads.has(src)) {
      const pending = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => { script.remove(); reject(new Error('โหลดบทเรียนไม่ได้')); };
        document.head.appendChild(script);
      }).catch((error) => { scriptLoads.delete(src); throw error; });
      scriptLoads.set(src, pending);
    }
    return scriptLoads.get(src);
  }

  async function playScreen(w, r, opts = {}) {
    leave(); header();
    const screen = currentScreen;
    const isFinal = w === 'final';
    const R = isFinal ? M.FINAL : M.WEEKS[w].rounds[r];
    // ฉากเดินในร้าน: แต่ละรอบระบุไฟล์ที่โหลดทีหลัง ฟังก์ชันเริ่มภารกิจ และทางกลับไปแบบเดิม
    const walks = {
      '0-1': { scripts: observeWalkScripts, start: () => M.playObserveWalk, title: 'เดินสังเกตลูกค้าในร้าน',
        classicLabel: 'ใช้แบบรายการเดิม', replay: 'เล่นซ้ำได้ด้วยเหตุการณ์ชุดเดิมเพื่อทบทวน' },
      '1-1': { scripts: shelfWalkScripts, start: () => M.CheckoutModel && M.playShelfWalk, title: 'เทียบราคาบนชั้นวาง',
        classicLabel: 'ฝึกคำนวณแบบเดิม', replay: 'เล่นซ้ำเพื่อเจอป้ายราคาชุดถัดไป' },
    };
    const walk = opts.classic || isFinal ? null : walks[`${w}-${r}`] || null;
    const walking = !!walk;
    const toClassic = () => playScreen(w, r, { classic: true });
    if (walking ? !(walk.start() && M.ShelfWalkScene && M.WalkControls) : !isFinal && !R.lesson) {
      app.innerHTML = `<button class="btn ghost small" id="back">← สัปดาห์ ${w + 1}</button>
        <p class="muted" role="status">${walking ? 'กำลังเปิดฉากร้าน…' : 'กำลังเปิดบทเรียน…'}</p>`;
      $('#back').onclick = () => weekScreen(w);
      try {
        if (walking) await Promise.all(walk.scripts.map(loadScript));
        else await loadScript(lessonScripts[w]);
      }
      catch (error) {
        if (screen === currentScreen) {
          $('[role="status"]', app).textContent = walking ? 'โหลดฉากร้านไม่ได้ ลองอีกครั้ง' : 'โหลดบทเรียนไม่ได้ ลองอีกครั้ง';
          app.insertAdjacentHTML('beforeend', '<button class="btn primary" id="retryLesson">ลองอีกครั้ง</button>');
          $('#retryLesson').onclick = () => playScreen(w, r, opts);
          if (walking) {
            app.insertAdjacentHTML('beforeend', ` <button class="btn ghost" data-walk-classic>${walk.classicLabel}</button>`);
            $('[data-walk-classic]', app).onclick = toClassic;
          }
        }
        return;
      }
      if (screen !== currentScreen) return;
    }
    const ctx = ctxFor(isFinal ? 8 : w, r);
    if (walking) {
      app.innerHTML = `<button class="btn ghost small" id="back">← สัปดาห์ ${w + 1}</button>
        <div class="play-head"><h2>${walk.title}</h2></div><div class="stage card walk-stage"></div>`;
      $('#back').onclick = () => weekScreen(w);
      walk.start()($('.stage'), ctx, finish, toClassic);
      return;
    }
    app.innerHTML = `<button class="btn ghost small" id="back">← ${isFinal ? 'แผนที่' : 'สัปดาห์ ' + (w + 1)}</button>
      <div class="play-head"><h2>${isFinal ? '📝 ' : `สัปดาห์ ${w + 1} · รอบ ${r + 1} — `}${esc(R.title)} <span class="tag">${M.SKILLS[R.skill]}</span></h2></div>
      <div class="theory"><b>📖 ทฤษฎี</b> ${R.theory}${isFinal ? '' : ' <button class="btn small ghost rd">📚 อ่านประกอบ</button>'}</div>
      <div class="lesson-wrap"></div>
      <div class="precheck"></div>
      <div class="task hidden"><b>🛠️ ลงมือทำ</b> ${R.task}</div>
      <div class="stage card hidden"></div>`;
    $('#back').onclick = () => (isFinal ? mapScreen() : weekScreen(w));
    if (!isFinal) $('.rd').onclick = () => readingPanel(w, r, R);
    const begin = () => {
      $('.task').classList.remove('hidden'); $('.stage').classList.remove('hidden');
      const stage = $('.stage');
      if (!M.RealWorksheets.run(stage, R, ctx, finish)) M.engines[R.engine](stage, R, ctx, finish);
    };
    const afterLesson = () => { if (R.check && !isFinal) precheck(R, w, r, begin); else begin(); };
    // บทเรียนก่อนเล่น: ครั้งแรกเปิดเอง · เรียนแล้วย่อเป็นแถบให้กดทบทวน
    const lkey = `${w}-${r}`, seen = !!(State.data.lessons || {})[lkey];
    const lessonBar = () => {
      $('.lesson-wrap').innerHTML = `<div class="lesson-bar">📖 <b>บทเรียนก่อนเล่น</b> <span class="muted">เรียนแล้ว ✓</span> <button class="btn small ghost relesson">ทบทวนบทเรียน</button></div>`;
      $('.relesson').onclick = () => { sfx.play('click'); playScreen(w, r, { ...opts, lesson: true }); };
    };
    if (R.lesson && !isFinal && (!seen || opts.lesson)) {
      M.playLesson($('.lesson-wrap'), R.lesson(ctx), () => {
        State.data.lessons = State.data.lessons || {}; State.data.lessons[lkey] = true; State.save();
        lessonBar(); afterLesson();
        $('.precheck').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, { canSkip: seen || State.data.settings.unlockAll });
    } else {
      if (R.lesson && !isFinal) lessonBar();
      afterLesson();
    }
    function finish(score, summary) {
      leave();
      const stars = score >= 0.999 ? 3 : score >= 0.66 ? 2 : score > 0 ? 1 : 0;
      const wasDone = isFinal ? false : weekDone(w);
      State.setRound(isFinal ? 'final' : w, r, { stars, score, skill: R.skill });
      header();
      sfx.play(stars ? 'star' : 'wrong');
      const weekNow = !isFinal && !wasDone && weekDone(w);
      const hasNext = !isFinal && r < M.WEEKS[w].rounds.length - 1;
      modal(`<div class="result-stars">
        <div class="bigstars" role="img" aria-label="${stars} จาก 3 ดาว">${Array.from({ length: 3 }, (_, i) => `<span aria-hidden="true" class="${i < stars ? 'earned' : ''}">${i < stars ? '★' : '☆'}</span>`).join('')}</div>
        ${stars === 3 ? '<div class="result-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>' : ''}</div>
        <h2>${stars === 3 ? 'ยอดเยี่ยม!' : stars === 2 ? 'ดีมาก' : stars === 1 ? 'ผ่าน — ฝึกซ้ำได้' : 'ลองอีกครั้ง'}</h2>
        <p>${esc(summary)}</p>${weekNow ? `<p>🎉 <b>จบสัปดาห์ ${w + 1}!</b> ${w < 7 ? 'ปลดล็อกสัปดาห์ถัดไปแล้ว' : 'ปลดล็อกครบทุกสัปดาห์ ลองทำแบบทดสอบท้ายแผน'}</p>` : ''}
        <p class="muted">เก็บคะแนนที่ดีที่สุดไว้ ${walking ? walk.replay : 'เล่นซ้ำได้เสมอ (โจทย์ตัวเลขจะสุ่มใหม่)'}</p>
        <div class="row" style="justify-content:center">
          <button class="btn" data-a="again">↻ เล่นซ้ำ</button>
          ${hasNext ? '<button class="btn primary" data-a="next">รอบต่อไป →</button>' : `<button class="btn primary" data-a="back">${isFinal ? 'กลับแผนที่' : 'กลับหน้าสัปดาห์'}</button>`}
        </div>`, (a) => {
        if (a === 'again') playScreen(w, r, { classic: opts.classic });
        else if (a === 'next') playScreen(w, r + 1);
        else isFinal ? mapScreen() : weekScreen(w);
      });
      if (weekNow) setTimeout(() => sfx.play('levelup'), 600);
    }
  }

  // ---------- คำถามเช็กก่อนเล่น (GDD §2, §4) — ใช้ทบทวน ไม่นับดาว ----------
  function precheck(R, w, r, begin) {
    const c = R.check, box = $('.precheck');
    const order = M.R.shuffle(c.options.map((_, i) => i));
    box.innerHTML = `<div class="card check"><div class="q-count">✔️ เช็กความเข้าใจก่อนเล่น <span class="muted">(ไม่นับดาว)</span></div>
      <div class="q">${esc(c.q)}</div><div class="opts">${order.map((k) => `<button class="opt" data-k="${k}">${esc(c.options[k])}</button>`).join('')}</div><div class="feedback"></div></div>`;
    $$('.opt', box).forEach((b) => (b.onclick = () => {
      const ok = +b.dataset.k === c.answer;
      sfx.play(ok ? 'correct' : 'wrong');
      b.classList.add(ok ? 'right' : 'bad'); b.disabled = true;
      if (ok) $$('.opt', box).forEach((x) => (x.disabled = true));
      $('.feedback', box).innerHTML = `<div class="msg">${ok ? '✅ <b>ถูกต้อง</b>' : '❌ <b>ยังไม่ใช่</b> — ลองเลือกใหม่ได้'}<br>${esc(c.explain)}</div>
        <div class="row"><button class="btn ${ok ? 'primary' : ''} go">${ok ? 'เริ่มลงมือ →' : 'ข้ามไปลงมือ →'}</button><button class="btn ghost rd2">📚 อ่านประกอบ</button></div>`;
      const go = $('.go', box); if (go) go.onclick = () => { sfx.play('click'); $$('.opt', box).forEach((x) => (x.disabled = true)); go.remove(); begin(); };
      $('.rd2', box).onclick = () => readingPanel(w, r, R);
    }));
  }

  // ---------- 📚 อ่านประกอบ (GDD §10 → js/reading.js) ----------
  function readingPanel(w, r, R) {
    const it = (M.READING || {})[`${w}-${r}`];
    const entry = (label, x) => !x ? '' : x.status === 'ok'
      ? `<li><b>${label}</b> — ${esc(x.note)}<br><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(x.title)}</a></li>`
      : `<li><b>${label}</b> — <span class="todo">⏳ ต้องค้นเพิ่ม</span> ${esc(x.note)}</li>`;
    modal(`<h2>📚 อ่านประกอบ ${it ? esc(it.code) + ' · ' + esc(it.topic) : ''}</h2>
      <div class="theory"><b>ทฤษฎีสั้น</b> ${R.theory}</div>
      ${it ? `<ul class="reading">${entry('คลิป', it.clip)}${entry('แหล่งทางการ', it.official)}</ul>` : '<p class="muted">ยังไม่มีรายการอ่านประกอบของรอบนี้</p>'}
      <p class="muted">ลิงก์เปิดในแท็บใหม่ รอบที่เล่นอยู่ยังค้างไว้ · รายการ “ต้องค้นเพิ่ม” รอผู้สอนตรวจแหล่งก่อนใส่ลิงก์</p>
      <div class="row"><button class="btn primary" data-a="close">ปิด</button></div>`, null, true);
  }

  // ---------- แฟ้มผลงาน ----------
  function portfolioScreen() {
    leave(); header();
    const items = Object.entries(State.data.portfolio).sort((a, b) => a[1].week - b[1].week);
    const rb = rubric();
    const md = () => `# แฟ้มผลงาน — แผนฝึกการตลาด 8 สัปดาห์\n\nผู้ฝึก: ${State.data.player || '-'}  \nสินค้า: ${product().th}  \nดาวรวม: ${State.totalStars()}  \nคะแนนเกณฑ์: ${rb.total}/10\n\n` +
      items.map(([, v]) => `## สัปดาห์ ${v.week} — ${v.title}\n\n${v.text}\n`).join('\n') + '\n> ใช้ป้ายกำกับแหล่งข้อมูลในแต่ละชิ้นงานเมื่อนำผลไปอ้างอิง\n';
    app.innerHTML = `<button class="btn ghost small" id="back">← แผนที่</button><h1>📁 แฟ้มผลงาน</h1>
      <p class="muted">ชิ้นงานที่บันทึกจากแต่ละรอบ ดาวน์โหลดเป็นไฟล์ .md เพื่อแนบใบงานหรือส่งครู</p>
      <div class="row"><button class="btn primary" id="dl" ${items.length ? '' : 'disabled'}>⬇️ ดาวน์โหลดแฟ้มผลงาน</button></div>
      <div class="grid" style="margin-top:14px">${items.length ? items.map(([, v]) => `<div class="card"><div class="wk" style="color:var(--brand);font-weight:700">สัปดาห์ ${v.week}</div><h3>${esc(v.title)}</h3><div style="white-space:pre-wrap">${esc(v.text)}</div></div>`).join('') : '<div class="card muted">ยังไม่มีชิ้นงาน — เล่นรอบต่าง ๆ แล้วกดบันทึกผล</div>'}</div>`;
    $('#back').onclick = mapScreen;
    $('#dl').onclick = () => M.download('แฟ้มผลงาน-การตลาด.md', md());
  }

  // ---------- modal / settings ----------
  function modal(html, onAction, left) {
    const m = $('#modal'), c = $('#modalCard');
    const trigger = document.activeElement;
    c.className = 'modal-card' + (left ? ' left' : '');
    c.innerHTML = html;
    $('h2', c).id = 'modal-title';
    m.classList.remove('hidden');
    $$('[data-a]', c).forEach((b) => (b.onclick = () => {
      m.classList.add('hidden'); sfx.play('click'); onAction?.(b.dataset.a);
      if (trigger?.isConnected && m.classList.contains('hidden')) trigger.focus({ preventScroll: true });
    }));
    c.onkeydown = (event) => {
      if (event.key === 'Escape') $('[data-a="close"]', c)?.click();
      if (event.key !== 'Tab') return;
      const items = $$('button:not(:disabled), input:not(:disabled), a[href]', c);
      const edge = event.shiftKey ? items[0] : items.at(-1);
      if (document.activeElement !== edge && !(event.shiftKey && document.activeElement === c)) return;
      event.preventDefault();
      (event.shiftKey ? items.at(-1) : items[0])?.focus();
    };
    c.focus({ preventScroll: true });
  }
  function settings() {
    const s = State.data.settings;
    const pid = State.data.product;
    const hasReal = pid && (M.RealW4.hasReal(pid) || M.RealWorksheets.hasReal(pid));
    modal(`<h2>⚙️ ตั้งค่า</h2>
      <div class="checks"><label><input type="checkbox" id="ul" ${s.unlockAll ? 'checked' : ''}> โหมดครู: ปลดล็อกทุกสัปดาห์และทุกรอบ</label></div>
      <div class="row"><button class="btn" data-a="product">เปลี่ยนสินค้า / ชื่อ</button>${hasReal ? '<button class="btn" data-a="drop">ลบชุดข้อมูลร้านของสินค้านี้</button>' : ''}<button class="btn" data-a="reset">🗑️ ล้างความคืบหน้า</button><button class="btn primary" data-a="close">ปิด</button></div>`, (a) => {
      if (a === 'product') titleScreen();
      if (a === 'drop' && confirm('ลบข้อมูลร้านและใบงานที่เกี่ยวข้องของ ' + product().th + '? ดาวที่ได้จะยังอยู่')) {
        M.RealW4.drop(pid);
        M.RealWorksheets.drop(pid);
        mapScreen();
      }
      if (a === 'reset' && confirm('ล้างดาว ผลจำลอง และแฟ้มผลงานทั้งหมด? (ย้อนกลับไม่ได้)')) { State.reset(); titleScreen(); }
      if (a === 'close' && product()) mapScreen();
    }, true);
    $('#ul').onchange = (e) => { s.unlockAll = e.target.checked; State.save(); };
  }

  M.nav = { play: playScreen, week: weekScreen };
  $('#showInstall', titleIntro).onclick = () => {
    const install = $('#install-app');
    if (!install) return;
    install.open = true;
    $('summary', install).focus();
  };
  $('#homeBtn').onclick = () => (product() ? mapScreen() : titleScreen());
  $('#soundBtn').onclick = () => { State.data.settings.sound = !State.data.settings.sound; State.save(); header(); if (!State.data.settings.sound) sfx.stopBgm(); else sfx.play('click'); };
  $('#ttsBtn').onclick = () => {
    State.data.settings.tts = !State.data.settings.tts;
    State.save(); header();
    if (State.data.settings.tts) M.speak('Hello!'); else M.stopSpeaking();
  };
  $('#menuBtn').onclick = settings;
  if ('speechSynthesis' in window) speechSynthesis.getVoices();

  header();
  product() && !previewRound ? mapScreen() : titleScreen();
})();

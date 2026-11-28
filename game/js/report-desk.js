/*
 * report-desk.js — โต๊ะอ่านผลประกอบการ W6R5 (GDD §8) หน้าจอและการบันทึก
 * เปิดก่อนคำถามเดิมของรอบ: อ่านบัตรผลร้านจาก W4R3 + แฟ้มรายงานบริษัทสมมติ 2 ฉบับ แล้วจดลงแฟ้มผลงานสัปดาห์ 6
 * โต๊ะนี้ไม่นับดาว ดาวมาจากคำถามเดิม 4 ข้อ (M.engines.mcq) ผ่าน finish ตัวเดียวกับทุกรอบ
 * ข้อมูลและกติกาตรวจอยู่ใน js/report-desk-model.js
 */
(function () {
  const M = window.MTL;
  const D = M.ReportDeskModel;
  const { $, $$, esc, sfx, State } = M;

  const badge = (label, cls) => `<span class="src ${cls || (label === D.REAL || /^คำนวณ/.test(label) ? 'calc' : /^แผน/.test(label) ? 'plan' : 'sim')}">${esc(label)}</span>`;
  const radios = (name, legend, options, errorId) => `<fieldset class="rd-group" aria-describedby="${errorId}"><legend>${legend}</legend>
    ${options.map(([value, label]) => `<label class="rd-opt"><input type="radio" name="${name}" value="${esc(value)}"><span>${esc(label)}</span></label>`).join('')}
    <small class="err" id="${errorId}" aria-live="polite"></small></fieldset>`;
  const picked = (root, name) => $(`input[name="${name}"]:checked`, root)?.value || '';

  // ---------- บัตรผลร้าน ----------
  function column(col, card) {
    const cell = (label, value) => `<dt>${label}</dt><dd>${value}</dd>`;
    return `<div class="rd-col"><h5>${esc(col.title)} ${badge(col.provenance)}</h5>
      <p class="rd-period">${esc(col.period)}<br><b>${col.minutes} นาที · ${esc(card.moneyUnit)}</b></p>
      <dl>${cell('จำนวนขาย', `${D.count(col.qty)} ${esc(card.unit)}${col.sets === undefined ? '' : ` (${D.count(col.sets)} ชุด + ${D.count(col.singles)} เดี่ยว)`}`)}
        ${cell('ยอดขาย', `${D.baht(col.sales)} บาท`)}${cell('ต้นทุนขาย', `${D.baht(col.cogs)} บาท`)}
        ${cell('ค่าทำโปร', `${D.baht(col.expense)} บาท${col.expenseSource ? ' ' + badge(col.expenseSource) : ''}`)}
        ${cell('ผลหลังค่าใช้จ่าย', `<b>${D.baht(col.result)} บาท</b>`)}
        ${col.origin ? cell('ที่มา', esc(col.origin)) : ''}</dl></div>`;
  }

  function verdictHtml(card) {
    const v = card.verdict;
    if (v.kind === 'forecast') return `<p class="rd-verdict"><b>${esc(v.label)}</b> · เทียบยอดปกติจริงกับผลโปรจำลอง ผลต่างจากช่วงปกติ ${D.baht(card.delta)} บาท</p>`;
    if (!v.decision) return `<p class="rd-verdict warn"><b>${esc(D.INSUFFICIENT)}</b></p><ul>${card.reasons.map((reason) => `<li>${esc(reason)}</li>`).join('')}</ul>`;
    return `<p class="rd-verdict">คำตัดสิน${card.type === 'sample' ? 'ของตัวอย่าง' : ''}: <b>${esc(v.label)}</b> · ผลต่างจากช่วงปกติ ${D.baht(card.delta)} บาท</p>`;
  }

  function walkHtml(card) {
    if (card.type === 'sample') return '<p class="muted">ตัวอย่างฝึกไม่มีบันทึกจากฉากเดิน</p>';
    if (!card.walkEvidence.length) return '<p class="muted">ผลชุดนี้ไม่มีบันทึกจากฉากเดิน (เล่นผ่านแบบรายการหรือโหมดข้อมูลร้าน) ยังใช้เป็นหลักฐานได้</p>';
    return `<details class="rd-walk"><summary>หลักฐานจากฉากเดิน (${card.walkEvidence.length} จุด)</summary><ul>${card.walkEvidence.map((item) =>
      `<li><b>${esc(item.label)}</b> <small class="muted">${esc(item.id)}</small>${item.text ? `<br>${esc(item.text)}` : ''}</li>`).join('')}</ul></details>`;
  }

  function storeHtml(card, resolved) {
    const sample = card.type === 'sample';
    const notice = resolved.ok ? '' : `<p class="warn" role="note">⚠️ ${esc(resolved.message)} จึงแสดงตัวอย่างฝึกแทน ตัวอย่างนี้ไม่ใช่ผลของคุณ</p>
      <div class="row"><button type="button" class="btn small rd-go">${esc(resolved.goLabel)}</button></div>`;
    return `<h4 id="rd-store-h">🏪 ผลทดลองของร้าน · ${esc(card.productName)} ${badge(D.storeLabel(card), sample ? 'sim' : undefined)}</h4>${notice}
      <div class="rd-cols">${column(card.columns.normal, card)}${column(card.columns.promo, card)}</div>${verdictHtml(card)}
      <p class="muted rd-ids">${sample ? `ตัวอย่างฝึก seed ${D.SAMPLE_SEED} · ไม่มีรหัสฐาน แผน หรือผลของผู้เล่น` :
        `รหัสฐาน ${esc(card.baselineId)} · แผน ${esc(card.planId)} · ผล ${esc(card.runId)}${card.route ? ` · เส้นทาง ${esc(card.route)}` : ''}`}</p>${walkHtml(card)}`;
  }

  // ---------- แฟ้มรายงาน ----------
  function pageHtml(report, page) {
    const head = `<h5>${esc(D.pageTitle(page))}</h5>`;
    if (page.kind === 'text') return `<div class="rd-page">${head}<p>${esc(page.body)}</p></div>`;
    const periods = page.columns.map((id) => report.periods.find((period) => period.id === id));
    return `<div class="rd-page">${head}<p class="rd-unit"><b>${esc(page.unitNote)}</b></p>
      <div class="rd-table" role="region" tabindex="0" aria-label="ตาราง ${esc(page.section)}"><table class="tbl"><thead><tr><th scope="col">รายการ</th>${periods.map((period) => `<th scope="col">${esc(period.label)}</th>`).join('')}</tr></thead>
      <tbody>${page.rows.map((row) => `<tr><th scope="row">${esc(row.label)}</th>${row.values.map((value) => `<td>${D.count(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  }

  function panelHtml(report) {
    const k = report.key;
    return `<dl class="rd-doc"><dt>เอกสาร</dt><dd>${esc(report.docId)} · ${esc(report.form)}</dd><dt>บริษัท</dt><dd>${esc(report.company)} <small class="muted">(ข้อมูลสมมติ)</small></dd></dl>
      ${report.pages.map((page) => pageHtml(report, page)).join('')}
      <form class="rd-form" data-report="${k}" novalidate aria-label="จดตัวเลขจาก${esc(report.company)}">
        <h5>จดหลักฐานลงใบงาน</h5>
        <p class="rd-instruction">เลือกงวดปีล่าสุดของรายงาน แล้วอ้างหน้าที่แสดงตัวเลขของงวดนั้น</p>
        ${radios(`rd-${k}-metric`, '1 · รายการที่จะจด', D.METRICS.map((metric) => [metric.id, metric.label]), `rd-${k}-metric-err`)}
        ${radios(`rd-${k}-page`, '2 · หน้า/หัวข้อ', report.pages.map((page) => [page.id, D.pageTitle(page)]), `rd-${k}-page-err`)}
        ${radios(`rd-${k}-period`, '3 · งวด', report.periods.map((period) => [period.id, `${period.label} (${period.length})`]), `rd-${k}-period-err`)}
        ${radios(`rd-${k}-unit`, '4 · สกุลเงินและหน่วย', report.units.map((unit) => [unit.id, unit.label]), `rd-${k}-unit-err`)}
        <div class="row"><button type="submit" class="btn primary rd-record" data-report="${k}">จดลงใบงาน</button></div>
      </form>
      <div class="rd-rows" aria-live="polite"><h5>ใบงานของแฟ้มนี้</h5><ul class="rd-row-list"></ul></div>`;
  }

  function pairHtml(card) {
    const mini = (title, period, body) => `<div class="rd-mini"><h5>${title}</h5><p><b>${esc(period)}</b></p>${body}</div>`;
    return `<div class="rd-pair">${mini('🏪 ผลร้าน', `${card.columns.promo.minutes} นาที · ${card.moneyUnit}`,
      `<p>ผลหลังค่าใช้จ่ายช่วงโปร ${D.baht(card.columns.promo.result)} บาท</p>`)}
      ${D.REPORTS.map((report) => {
        const c = D.contrastFor(report);
        return mini(`${report.flag} ${esc(report.company)}`, `${c.period.length} · ${c.unit}`,
          `<p>${esc(c.period.label)} · หน้า ${c.page}</p><p>กำไรสุทธิ ${D.count(c.profit)} · เงินสดจากการดำเนินงาน ${D.count(c.cash)} ${esc(c.unit)}</p><p class="muted">${esc(c.text)}</p>`);
      }).join('')}</div>
      <p class="warn" role="note">งวดและหน่วยของสามบัตรต่างกัน (ร้านนับเป็นนาที บริษัทนับเป็นปี และเป็นหน่วยล้าน) จึงเทียบตัวเลขตรง ๆ ไม่ได้ ใช้เทียบเฉพาะว่าตัวเลขแต่ละตัวตอบคำถามอะไร</p>`;
  }

  function run(el, round, ctx, finish) {
    const product = ctx.product;
    const resolved = D.resolveStore(product, M.RealW4.evidence(ctx), ctx.state.sim?.promoV2?.[product.id]);
    const card = resolved.ok ? resolved.card : D.sampleStore(product);
    const rows = { th: new Map(), us: new Map() };
    const saved = ctx.state.portfolio?.[D.portfolioKey(product.id)];
    const savedNote = !saved ? '' : `<p class="muted rd-saved">เคยบันทึกใบงานโต๊ะนี้ไว้แล้ว ${saved.data?.store?.runId && saved.data.store.runId === card.runId ? '(อ้างผลชุดปัจจุบัน)' : '(อ้างผลหรือตัวอย่างชุดอื่น)'} บันทึกใหม่จะทับฉบับเดิม</p>`;
    const [first, second] = D.METRICS.filter((metric) => metric.question);

    el.innerHTML = `<section class="report-desk" aria-labelledby="rd-title">
      <h3 id="rd-title">🗂️ โต๊ะอ่านผลประกอบการ</h3>
      <p>เปิดผลทดลองของร้านกับรายงานบริษัทสมมติ 2 ฉบับ แล้วจดว่าตัวเลขมาจากหน้า งวด สกุลเงิน และหน่วยใด ขั้นนี้<b>ไม่นับดาว</b> เมื่อจดเสร็จจะบันทึกลงแฟ้มผลงานสัปดาห์ 6 แล้วไปทำคำถาม 4 ข้อ (นับดาวเหมือนเดิม) หรือข้ามไปทำคำถามเลยก็ได้</p>${savedNote}
      <section class="card rd-card" aria-labelledby="rd-store-h">${storeHtml(card, resolved)}</section>
      <div class="rd-files"><div role="tablist" aria-label="แฟ้มรายงานบริษัทตัวอย่าง">${D.REPORTS.map((report, i) =>
        `<button type="button" role="tab" class="rd-tab" id="rd-tab-${report.key}" data-report="${report.key}" aria-controls="rd-panel-${report.key}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${report.flag} ${esc(report.company)} · ${esc(report.form)}</button>`).join('')}</div>
        ${D.REPORTS.map((report, i) => `<div role="tabpanel" class="card rd-card rd-panel" id="rd-panel-${report.key}" aria-labelledby="rd-tab-${report.key}" tabindex="0"${i ? ' hidden' : ''}>${panelHtml(report)}</div>`).join('')}</div>
      <section class="card rd-card" aria-labelledby="rd-contrast-h"><h4 id="rd-contrast-h">เทียบกำไรกับเงินสด และเทียบบัตรร้านกับบัตรบริษัท</h4>${pairHtml(card)}
        <div class="rd-contrast">
          ${radios('rd-contrast-profit', `ข้อ 1 · ตัวเลขใดตอบคำถาม “${esc(first.question)}”`, D.METRICS.filter((m) => m.question).map((m) => [m.id, m.label]), 'rd-contrast-profit-err')}
          ${radios('rd-contrast-cash', `ข้อ 2 · ตัวเลขใดตอบคำถาม “${esc(second.question)}”`, D.METRICS.filter((m) => m.question).map((m) => [m.id, m.label]), 'rd-contrast-cash-err')}
        </div></section>
      <div class="row rd-actions"><button type="button" class="btn primary rd-save">บันทึกลงแฟ้มผลงานและไปทำคำถาม</button><button type="button" class="btn ghost rd-skip">ข้ามโต๊ะนี้ ไปทำคำถามเลย</button></div>
      <p class="err rd-status" role="status" aria-live="polite"></p></section>`;

    const quiz = () => {
      el.scrollIntoView?.({ block: 'start' });
      M.engines[round.engine](el, round, ctx, finish);
    };
    const status = (message, good) => {
      const box = $('.rd-status', el);
      box.textContent = message;
      box.classList.toggle('rd-ok', !!good);
    };

    // แท็บแฟ้มรายงาน: ลูกศรซ้ายขวา Home End ย้ายแท็บ
    const tabs = $$('.rd-tab', el);
    const select = (tab, focus) => {
      tabs.forEach((item) => {
        const on = item === tab;
        item.setAttribute('aria-selected', String(on));
        item.tabIndex = on ? 0 : -1;
        $(`#${item.getAttribute('aria-controls')}`, el).hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.onclick = () => { sfx.play('click'); select(tab); };
      tab.onkeydown = (event) => {
        const to = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        select(tabs[to], true);
      };
    });

    if (!resolved.ok) $('.rd-go', el).onclick = () => M.nav.play(resolved.go[0], resolved.go[1]);

    const drawRows = (report) => {
      const list = D.METRICS.map((metric) => rows[report.key].get(metric.id)).filter(Boolean);
      $(`#rd-panel-${report.key} .rd-row-list`, el).innerHTML = list.length ? list.map((entry) =>
        `<li><span>${esc(D.entryText(entry))}</span> <button type="button" class="btn small ghost" data-del="${esc(entry.metric)}" aria-label="ลบรายการ ${esc(entry.metricLabel)} ของ${esc(report.company)}">ลบ</button></li>`).join('') :
        '<li class="muted">ยังไม่ได้จดรายการจากแฟ้มนี้</li>';
      $$('[data-del]', $(`#rd-panel-${report.key}`, el)).forEach((button) => {
        button.onclick = () => { rows[report.key].delete(button.dataset.del); drawRows(report); sfx.play('click'); };
      });
    };

    D.REPORTS.forEach((report) => {
      drawRows(report);
      const form = $(`.rd-form[data-report="${report.key}"]`, el);
      const errorBox = (group) => $(`#rd-${report.key}-${group}-err`, form);
      form.onsubmit = (event) => {
        event.preventDefault();
        const groups = ['metric', 'page', 'period', 'unit'];
        const picks = Object.fromEntries(groups.map((group) => [group, picked(form, `rd-${report.key}-${group}`)]));
        const errors = Object.fromEntries(groups.filter((group) => !picks[group]).map((group) => [group, 'เลือกข้อนี้ก่อนจด']));
        let result = null;
        if (!Object.keys(errors).length) {
          result = D.checkReading(report, picks);
          Object.assign(errors, result.errors);
        }
        groups.forEach((group) => { errorBox(group).textContent = errors[group] || ''; });
        const bad = groups.find((group) => errors[group]);
        if (bad) {
          sfx.play('wrong');
          $(`input[name="rd-${report.key}-${bad}"]`, form).focus();
          return;
        }
        rows[report.key].set(result.entry.metric, result.entry);
        drawRows(report);
        sfx.play('correct');
        status(`จดแล้ว: ${D.entryText(result.entry)}`, true);
      };
    });

    $('.rd-skip', el).onclick = () => { sfx.play('click'); quiz(); };
    $('.rd-save', el).onclick = () => {
      const problems = D.REPORTS.filter((report) => !rows[report.key].size).map((report) => `จดอย่างน้อย 1 รายการจากแฟ้ม${report.company}`);
      const contrast = D.checkContrast({ profit: picked(el, 'rd-contrast-profit'), cash: picked(el, 'rd-contrast-cash') });
      $('#rd-contrast-profit-err', el).textContent = contrast.errors.profit || '';
      $('#rd-contrast-cash-err', el).textContent = contrast.errors.cash || '';
      if (!contrast.ok) problems.push('ตอบข้อเทียบกำไรกับเงินสดให้ถูกก่อนบันทึก');
      if (problems.length) {
        sfx.play('wrong');
        status(problems.join(' · '));
        return;
      }
      const entries = Object.fromEntries(D.REPORTS.map((report) => [report.key, D.METRICS.map((metric) => rows[report.key].get(metric.id)).filter(Boolean)]));
      const out = D.portfolioEntry(product, card, entries, D.REPORTS.map(D.contrastFor), Date.now());
      State.addPortfolio(out.key, 6, out.title, out.text, out.data);
      sfx.play('note');
      quiz();
    };
  }

  // ลบข้อมูลร้านของสินค้า: ใบงานที่อ้างผลจริงชุดนั้นไม่มีต้นทางแล้ว จึงลบด้วย (ใบงานที่อ้างผลจำลองยังอยู่)
  function drop(pid) {
    const key = D.portfolioKey(pid), entry = State.data.portfolio?.[key];
    if (entry?.data?.store?.baselineSource === D.REAL) {
      delete State.data.portfolio[key];
      State.save();
    }
  }

  M.ReportDesk = { run, drop };
})();

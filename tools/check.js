#!/usr/bin/env node
/*
 * tools/check.js — ตรวจความถูกต้องก่อนส่งงาน/merge (ไม่ต้องเปิดเบราว์เซอร์)
 *   node tools/check.js
 * ตรวจ: syntax ของ JS ทุกไฟล์ · โจทย์ทุกรอบ × 3 สินค้า (สุ่มซ้ำ 30 ครั้ง) · บทสนทนา ·
 *       เฉลยแบบทดสอบท้ายแผนตรง docx · คีย์เสียง/ภาพครบและไฟล์ที่อ้างมีอยู่จริง
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GAME = path.join(ROOT, 'game');
const errors = [];
const err = (m) => errors.push(m);

// ---- 1) syntax ----
const jsFiles = [
  ...fs.readdirSync(path.join(GAME, 'js')).map((f) => path.join(GAME, 'js', f)),
  path.join(GAME, 'assets/audio/manifest.js'),
  path.join(GAME, 'assets/voice/manifest.js'),
  path.join(GAME, 'assets/sprites/manifest.js'),
];
for (const f of jsFiles) {
  try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); } catch (e) { err(`syntax ${path.relative(ROOT, f)}: ${e.message}`); }
}

// ---- 2) โหลด util + curriculum + manifests ใน sandbox ----
const sandbox = { window: {}, console, Math, Date, JSON };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['assets/audio/manifest.js', 'assets/voice/manifest.js', 'assets/sprites/manifest.js', 'js/util.js', 'js/curriculum.js', 'js/reading.js', 'js/lesson-kit.js', 'js/lessons-w1.js', 'js/lessons-w2.js', 'js/lessons-w3.js', 'js/lessons-w4.js', 'js/lessons-w5.js', 'js/lessons-w6.js', 'js/lessons-w7.js', 'js/lessons-w8.js']) {
  try { vm.runInContext(fs.readFileSync(path.join(GAME, f), 'utf8'), sandbox, { filename: f }); } catch (e) { err(`load ${f}: ${e.message}`); }
}
const M = sandbox.MTL;
if (!M || !M.WEEKS) { console.error('โหลด curriculum ไม่ได้\n' + errors.join('\n')); process.exit(1); }

const ENGINES = ['mcq', 'calc', 'sort', 'dialogue', 'observe', 'sim', 'post', 'pitch'];
const fakeState = () => ({ sim: {}, rounds: {}, portfolio: {}, settings: {} });
let checks = 0;

if (M.WEEKS.length !== 8) err(`ต้องมี 8 สัปดาห์ แต่มี ${M.WEEKS.length}`);
for (const pid of Object.keys(M.PRODUCTS)) {
  M.WEEKS.forEach((W, w) => {
    if (W.rounds.length !== 5) err(`สัปดาห์ ${w + 1} ต้องมี 5 รอบ`);
    W.rounds.forEach((R, r) => {
      const tag = `${pid} ส.${w + 1} ร.${r + 1}`;
      if (!ENGINES.includes(R.engine)) err(`${tag}: engine ไม่รู้จัก "${R.engine}"`);
      if (!M.SKILLS[R.skill]) err(`${tag}: skill ไม่รู้จัก "${R.skill}"`);
      if (!R.title || !R.theory || !R.task) err(`${tag}: ขาด title/theory/task`);
      if (R.check) {
        checks++;
        const c = R.check;
        if (!c.q || !c.explain || !(c.answer >= 0 && c.answer < c.options.length)) err(`${tag}: คำถามเช็กก่อนเล่นไม่ครบหรือเฉลยผิด index`);
        if (new Set(c.options).size !== c.options.length) err(`${tag}: ตัวเลือกเช็กก่อนเล่นซ้ำ`);
      } else if (w === 3 || R.lesson) err(`${tag}: รอบที่มีบทเรียนต้องมีคำถามเช็กก่อนเล่น (GDD §4)`);
      const rd = M.READING && M.READING[`${w}-${r}`];
      if (!rd) err(`${tag}: ไม่มีรายการอ่านประกอบ (รัน node tools/build_reading.js)`);
      else for (const x of [rd.clip, rd.official]) { checks++; if (x.status === 'ok' && !/^https:\/\//.test(x.url)) err(`${tag}: ลิงก์อ่านประกอบต้องเป็น https`); }
      for (let k = 0; k < 30; k++) {
        const ctx = { product: M.PRODUCTS[pid], state: fakeState(), week: w, idx: r };
        try {
          if (R.engine === 'calc') {
            const g = R.gen(ctx, k === 0);
            g.fields.forEach((f) => {
              checks++;
              if (f.options) { if (!f.options.includes(f.answer)) err(`${tag}: คำตอบ "${f.answer}" ไม่อยู่ในตัวเลือก (${f.label})`); }
              else if (!Number.isFinite(f.answer)) err(`${tag}: คำตอบไม่ใช่ตัวเลข (${f.label})`);
            });
          }
          if (R.engine === 'sort') {
            const g = R.gen(ctx);
            g.items.forEach((it) => { checks++; if (!g.buckets.includes(it.bucket)) err(`${tag}: การ์ด "${it.text}" ไม่มีกล่อง`); });
          }
          if (R.engine === 'mcq') {
            const qs = typeof R.questions === 'function' ? R.questions(ctx) : R.questions;
            qs.forEach((q) => { checks++; if (!(q.answer >= 0 && q.answer < q.options.length)) err(`${tag}: index คำตอบผิด`); if (new Set(q.options).size !== q.options.length) err(`${tag}: ตัวเลือกซ้ำ "${q.q}"`); });
          }
          if (R.engine === 'dialogue') {
            R.script(ctx).forEach((s) => {
              if (s.choices) { checks++; const ok = s.choices.filter((c) => c.ok).length; if (ok !== 1) err(`${tag}: ต้องมีคำตอบถูก 1 ข้อ (มี ${ok})`); if (new Set(s.choices.map((c) => c.en)).size !== s.choices.length) err(`${tag}: ตัวเลือกซ้ำ`); }
              if (s.listen) { checks++; if (!s.options.includes(s.answer)) err(`${tag}: คำตอบฟังไม่อยู่ในตัวเลือก`); if (new Set(s.options).size !== s.options.length) err(`${tag}: ตัวเลือกฟังซ้ำ`); }
            });
          }
        } catch (e) { err(`${tag}: ${e.message}`); break; }
      }
    });
  });
}

// ---- 2b) บทเรียนก่อนเล่น: ทุกขั้นสร้างได้ เฉลยเป็นตัวเลข ตัวเลือกไม่ซ้ำ ----
const LESSON_TYPES = ['say', 'reveal', 'try', 'pick'];
const LESSON_WEEKS = [0, 1, 2, 3, 4, 5, 6, 7]; // ครบทั้ง 8 สัปดาห์แล้ว ทุกรอบต้องมีบทเรียนและคำถามเช็กก่อนเล่น
for (const pid of Object.keys(M.PRODUCTS)) {
  for (const st of [fakeState(), Object.assign(fakeState(), { sim: { plan: { bundle: 2 * M.PRODUCTS[pid].promo.price, sign: 30 } } }),
    Object.assign(fakeState(), { sim: { plan: { bundle: 23, sign: 30 }, run: { sets: 27, singles: 3, profit: -33, baseProfit: 136 } } })]) {
    M.WEEKS.forEach((W, w) => W.rounds.forEach((R, r) => {
      if (!R.lesson) { if (LESSON_WEEKS.includes(w)) err(`${pid} ส.${w + 1} ร.${r + 1}: ต้องมีบทเรียนก่อนเล่น`); return; }
      const tag = `${pid} ส.${w + 1} ร.${r + 1} บทเรียน`;
      let steps;
      try { steps = R.lesson({ product: M.PRODUCTS[pid], state: st, week: w, idx: r }); } catch (e) { return err(`${tag}: ${e.message}`); }
      if (!Array.isArray(steps) || steps.length < 3) err(`${tag}: ต้องมีอย่างน้อย 3 ขั้น`);
      steps.forEach((s, k) => {
        checks++;
        const t = `${tag} ขั้น ${k + 1}`;
        if (!LESSON_TYPES.includes(s.type)) err(`${t}: ชนิดขั้นไม่รู้จัก "${s.type}"`);
        if (!s.text) err(`${t}: ไม่มีข้อความ`);
        if (/undefined|NaN/.test(String(s.text) + (s.visual || '') + (s.ask || '') + (s.say || '') + (s.explain || '') + (s.options || []).join('|'))) err(`${t}: มี undefined/NaN ในเนื้อหา`);
        if (s.type === 'reveal' && !(s.parts && s.parts.length && s.parts.every((p) => p.btn && p.html && !/undefined|NaN/.test(p.html)))) err(`${t}: reveal ต้องมี parts ที่มี btn และ html`);
        if (s.type === 'try' && (!Number.isFinite(s.answer) || !s.ask)) err(`${t}: try ต้องมี ask และ answer เป็นตัวเลข`);
        if (s.type === 'pick') {
          if (!(s.answer >= 0 && s.answer < s.options.length)) err(`${t}: pick เฉลยผิด index`);
          if (new Set(s.options).size !== s.options.length) err(`${t}: pick ตัวเลือกซ้ำ`);
        }
      });
      if (!steps.some((s) => s.level === 'ง่าย')) err(`${tag}: ต้องเริ่มจากตัวอย่างระดับง่าย`);
    }));
  }
}

// ---- 3) เฉลยแบบทดสอบท้ายแผน (หน้า 14 ของ docx) ----
const fin = M.FINAL.gen({}, true).fields.map((f) => f.answer).join('/');
if (fin !== '8/3/50/9/28') err(`เฉลยท้ายแผนไม่ตรง docx: ได้ ${fin} ต้องเป็น 8/3/50/9/28`);
for (let k = 0; k < 200; k++) M.FINAL.gen({}, false).fields.forEach((f) => { if (!Number.isFinite(f.answer)) err('แบบทดสอบสุ่มได้ค่าไม่ใช่ตัวเลข'); });

// ---- 3b) โมเดลโปรสัปดาห์ 4 ต้องได้ผลตรงตาราง GDD §5 (seed 4001–4040) ----
{
  const PM = require(path.join(GAME, 'js/promo-model.js'));
  const expect = { // [ทำต่อที่ 5%, 10%, 15%] และส่วนลดลึก [ทำต่อ, ปรับ, หยุด]
    water: { P: 2000, C: 1200, cont: [14, 24, 25], deep: [0, 25, 15] },
    household: { P: 1500, C: 1000, cont: [12, 21, 14], deep: [0, 21, 19] },
  };
  for (const [pid, e] of Object.entries(expect)) {
    const { F } = PM.defaults(e.P, e.C);
    const tally = (B) => {
      const t = { 'ทำต่อ': 0, 'ปรับ': 0, 'หยุด': 0 };
      for (let s = 4001; s <= 4040; s++) {
        const r = PM.simulatePair({ seed: s, P: e.P, C: e.C, B, slot: s % 2 ? 'am' : 'pm', event: 'none' });
        t[PM.evaluate({ P: e.P, C: e.C, B, F, N0: r.normal.N, S: r.promo.S, U: r.promo.U }).decision]++;
        checks++;
      }
      return t;
    };
    [0.05, 0.10, 0.15].forEach((d, k) => {
      const got = tally(PM.round(2 * e.P * (1 - d)))['ทำต่อ'];
      if (got !== e.cont[k]) err(`โมเดลโปร ${pid} ส่วนลด ${d * 100}%: ทำต่อ ${got}/40 แต่ GDD §5 ระบุ ${e.cont[k]}/40`);
    });
    const deep = tally(2 * e.C - 100), dv = [deep['ทำต่อ'], deep['ปรับ'], deep['หยุด']].join('/');
    if (dv !== e.deep.join('/')) err(`โมเดลโปร ${pid} ส่วนลดลึก: ได้ ${dv} แต่ GDD §5 ระบุ ${e.deep.join('/')}`);
  }
  const ex = [[4002, 3600, '20/8/13/16000/17000/ทำต่อ'], [4001, 3600, '25/9/14/20000/19000/ปรับ'], [4012, 2300, '17/27/3/13600/-3300/หยุด']];
  for (const [seed, B, want] of ex) {
    const r = PM.simulatePair({ seed, P: 2000, C: 1200, B, slot: seed % 2 ? 'am' : 'pm', event: 'none' });
    const v = PM.evaluate({ P: 2000, C: 1200, B, F: 3000, N0: r.normal.N, S: r.promo.S, U: r.promo.U });
    const got = [r.normal.N, r.promo.S, r.promo.U, v.G0, v.G1, v.decision].join('/');
    checks++;
    if (got !== want) err(`ตัวอย่าง seed ${seed} ไม่ตรง GDD §5: ได้ ${got} ต้องเป็น ${want}`);
  }
  // กรณีขอบ: ราคาชุดเท่าซื้อแยก, ส่วนต่างต่อชุดเป็นศูนย์, สต็อกศูนย์, เป้าหมายเป็นศูนย์
  const z = PM.simulatePair({ seed: 4003, P: 2000, C: 1200, B: 4000, event: 'none' });
  if (z.d !== 0 || z.promo.S !== 0) err('ราคาชุด = 2P ต้องไม่มีส่วนลดและไม่นับชุด');
  if (PM.setsNeeded(3000, 0) !== 'impossible' || PM.setsNeeded(0, 500) !== 0 || PM.setsNeeded(-100, -5) !== 0) err('setsNeeded กรณีขอบผิด');
  const k0 = PM.simulatePair({ seed: 4005, P: 2000, C: 1200, B: 3600, K0: 0, K1: 0, event: 'none' });
  if (k0.normal.N !== 0 || k0.promo.N !== 0) err('สต็อกศูนย์ต้องขายได้ 0 ชิ้น');
  checks += 4;
}

// ---- 3d) กลไกสังเกตลูกค้า W1R2 (GDD §9) ใช้ได้โดยไม่ผูกหน้าจอ ทั้งฉากเดินและแบบรายการ ----
{
  const OM = require(path.join(GAME, 'js/observe-walk-model.js'));
  const gddEvents = 'am-carry 422 am carry/am-fast 426 am carry/am-price 429 am value/pm-stock 1024 pm home/pm-stock-more 1028 pm home';
  for (const pid of Object.keys(M.PRODUCTS)) {
    const product = M.PRODUCTS[pid];
    const tag = `${pid} W1R2 สังเกต`;
    const events = OM.buildEvents(product);
    checks++;
    if (events.map((e) => `${e.id} ${e.minute} ${e.period} ${e.group}`).join('/') !== gddEvents) err(`${tag}: ชุดเหตุการณ์ไม่ตรง GDD §9`);
    for (const e of events) {
      checks += 4;
      if (/undefined|NaN|[{}]/.test([e.place, e.seen, e.heard, e.observedText, e.supported, e.alternative, e.explanation].join('|'))) err(`${tag} ${e.id}: ข้อความไม่สมบูรณ์`);
      const front = OM.approachPose(e);
      if (!OM.perceive(front, e).ready) err(`${tag} ${e.id}: ยืนที่จุดฟังแล้วจดไม่ได้`);
      const away = OM.perceive({ ...front, yaw: Math.PI }, e);
      if (!away.heard || away.ready === e.needsSight) err(`${tag} ${e.id}: หันหลังแล้วต้องได้ยิน และจดได้เฉพาะเหตุการณ์ที่ไม่ต้องเห็น`);
      if (OM.perceive({ x: e.spot.x, z: e.spot.z - OM.SENSE.hear - 0.3, yaw: 0 }, e).heard) err(`${tag} ${e.id}: ได้ยินไกลเกินระยะ`);
      for (const other of events) {
        if (other !== e && other.period === e.period && OM.perceive(front, other).heard) err(`${tag}: จุดฟัง ${e.id} ได้ยิน ${other.id} ปนกัน`);
      }
    }
    // จดสลับลำดับและจดซ้ำ: หนึ่งแถวต่อรหัส สมุดเรียงตามเวลา ไปเย็นเมื่อเช้าครบ 3 ไปวิเคราะห์เมื่อครบ 5
    const s = OM.createSession(product);
    s.record('am-price'); s.record('am-carry');
    checks += 5;
    if (s.record('am-carry').added || s.recordedCount() !== 2) err(`${tag}: จดซ้ำแล้วได้แถวเพิ่ม`);
    if (s.periodDone('am')) err(`${tag}: ไปช่วงเย็นได้ก่อนจดเช้าครบ`);
    s.record('am-fast');
    if (s.notebook().map((e) => e.id).join() !== 'am-carry,am-fast,am-price') err(`${tag}: สมุดไม่เรียงตามเวลา`);
    if (!s.periodDone('am') || s.allRecorded()) err(`${tag}: เงื่อนไขไปช่วงเย็นหรือไปวิเคราะห์ผิด`);
    s.record('pm-stock-more'); s.record('pm-stock');
    if (!s.allRecorded()) err(`${tag}: จดครบ 5 แล้วยังไปวิเคราะห์ไม่ได้`);
    for (const e of events) { s.answerObservation(e.id, 'fact'); s.answerReason(e.id, `${e.id}-supported`); }
    s.answerObservation('am-carry', 'inference'); // คำตอบหลังครั้งแรกไม่เปลี่ยนคะแนน
    const ratios = [];
    for (const period of OM.PERIODS) {
      const q = s.comparisonQuestion(period.id);
      const row = q.rows.find((entry) => entry.group.id === q.answer);
      ratios.push(`${row.count}/${row.denominator}`);
      checks++;
      if (!q.explain.includes(`${row.count} ÷ ${row.denominator}`) || !q.explain.includes(`ตัวอย่างจำลอง ${events.length} เหตุการณ์`)) err(`${tag}: คำอธิบายเทียบช่วงต้องอ้างตัวหารและขอบเขตตัวอย่าง`);
      s.answerComparison(period.id, q.answer);
    }
    checks += 4;
    if (ratios.join(' ') !== '2/3 2/2') err(`${tag}: ตัวหารเทียบช่วงต้องเป็น 2/3 และ 2/2 ได้ ${ratios.join(' ')}`);
    const full = s.score();
    if (full.correct !== 12 || full.total !== 12 || full.score !== 1) err(`${tag}: ตอบถูกทั้งหมดต้องได้ 12/12 ได้ ${full.correct}/${full.total}`);
    s.propose('pm-stock', 'shelf');
    const saved = s.result('walk');
    const okShape = saved.source === 'simulated' && saved.route === 'walk' && saved.events.length === 5 &&
      saved.events.every((e) => Number.isInteger(e.minute) && e.selectedObservationId === 'fact' && e.selectedReasonId === `${e.id}-supported`) &&
      saved.comparison.map((c) => `${c.period}:${c.sampleCount}:${c.selectedGroupId}`).join() === 'am:3:carry,pm:2:home' &&
      saved.proposal?.eventId === 'pm-stock' && !/[{}]/.test(saved.proposal.text);
    if (!okShape) err(`${tag}: รูปแบบเซฟไม่ตรง GDD §9`);
    if (!/pm-stock/.test(s.portfolioText()) || /undefined|NaN/.test(s.portfolioText())) err(`${tag}: แฟ้มผลงานต้องอ้างรหัสเหตุการณ์ที่เสนอ`);
    // ตัวอย่างคะแนน GDD §9: ข้อสังเกตถูก 4 การตีความถูก 4 เทียบช่วงถูก 1 = 9 ÷ 12 = 0.75 (2 ดาว)
    const t = OM.createSession(product);
    events.forEach((e, i) => {
      t.record(e.id);
      t.answerObservation(e.id, i === 0 ? 'inference' : 'fact');
      t.answerReason(e.id, i === 1 ? `${e.id}-alternative` : `${e.id}-supported`);
    });
    t.answerComparison('am', 'carry'); t.answerComparison('pm', 'value');
    if (t.score().score !== 0.75) err(`${tag}: ตัวอย่าง 9/12 ต้องได้ 0.75 ได้ ${t.score().score}`);
  }
}

// ---- 3e) เคาน์เตอร์ W2R2: ราคาต่อหน่วย สองชุดราคา × 3 สินค้า หยิบ สแกน จ่ายเงิน และเงินทอน ----
{
  const CM = require(path.join(GAME, 'js/checkout-model.js'));
  // ราคาต่อหน่วย (สตางค์) ของชั้น A/B และชั้นที่คุ้มกว่า: ชุดแรกแพ็กใหญ่คุ้ม ชุดเล่นซ้ำแพ็กเล็กคุ้ม
  const expect = {
    water: ['2000/1333 b 25', '1500/1600 a 29'],
    snack: ['4000/3333 b 30', '3200/3600 a 32'],
    household: ['1200/983 b 64', '900/1000 a 65'],
  };
  for (const [pid, cases] of Object.entries(expect)) {
    cases.forEach((want, caseIndex) => {
      const tag = `${pid} W2R2 เคาน์เตอร์ ชุด ${caseIndex + 1}`;
      const plan = CM.mission(M.PRODUCTS[pid], caseIndex);
      const got = `${plan.items.map((item) => item.perSatang).join('/')} ${plan.best.id} ${plan.budget}`;
      checks += 3;
      if (got !== want) err(`${tag}: ราคาต่อหน่วย/ชั้นที่คุ้ม/งบ ได้ ${got} ต้องเป็น ${want}`);
      const purse = CM.wallet(plan.budget);
      if (purse.reduce((a, b) => a + b, 0) !== plan.budget || purse.some((v) => !CM.DENOMINATIONS.includes(v))) err(`${tag}: กระเป๋าเงินไม่เท่างบ`);
      if (plan.items.some((item) => /undefined|NaN/.test(item.name + item.sizeText))) err(`${tag}: ข้อความป้ายไม่สมบูรณ์`);

      for (const choice of ['a', 'b']) {
        const c = CM.createCounter(plan, { transactionId: 'test' });
        const item = plan.items.find((entry) => entry.id === choice);
        checks += 11;
        if (c.scan().accepted) err(`${tag}: สแกนได้ทั้งที่มือว่าง`);
        c.pick(choice === 'a' ? 'b' : 'a');
        if (!c.pick(choice).picked || c.hand() !== item) err(`${tag}: หยิบเปลี่ยนแพ็กไม่ได้`);
        if (c.pick(choice).picked) err(`${tag}: หยิบแพ็กเดิมซ้ำแล้วนับเป็นการหยิบใหม่`);
        if (c.scan().accepted) err(`${tag}: สแกนได้ก่อนกรอกราคาต่อหน่วย`);
        c.setUnits([item.perSatang]);
        if (c.scan().accepted) err(`${tag}: ต้องมีราคาต่อหน่วยครบทั้งสองชั้น`);
        c.setUnits(plan.items.map((entry) => entry.perSatang));
        const scan = c.scan();
        if (!scan.accepted || scan.total !== item.price || c.lines.length !== 1 || c.hand() !== null) err(`${tag}: สแกนต้องย้ายแพ็กจากมือเข้าใบเสร็จ 1 รายการตามราคาป้าย`);
        if (c.setUnits([0, 0])) err(`${tag}: ต้องล็อกราคาต่อหน่วยเมื่อสแกนสำเร็จ`);
        if (c.scan().accepted || c.lines.length !== 1 || c.pick(choice === 'a' ? 'b' : 'a').picked) err(`${tag}: สแกนซ้ำหรือเปลี่ยนแพ็กหลังสแกนต้องถูกปฏิเสธ`);
        // จ่ายไม่พอ จ่ายเงินนอกกระเป๋า แล้วจ่ายจากธนบัตรใหญ่ลงมาจนพอ: เงินทอน = เงินที่จ่าย − ยอด
        const smallest = purse.length - 1;
        if (purse[smallest] < item.price && c.pay([smallest]).paid) err(`${tag}: จ่ายไม่พอแต่ระบบรับ`);
        if (c.pay([purse.length]).paid || c.pay([0, 0]).paid) err(`${tag}: รับเงินที่ไม่มีในกระเป๋า`);
        const hand = []; let given = 0;
        for (let i = 0; given < item.price; i++) { hand.push(i); given += purse[i]; }
        const paid = c.pay(hand);
        if (!paid.paid || paid.change !== given - item.price) { err(`${tag}: เงินทอนผิด`); continue; }
        if (c.answerChange(paid.change + 1) || !c.answerChange(paid.change)) err(`${tag}: ตรวจคำตอบเงินทอนผิด`);
        if (c.receiveChange() !== paid.change > 0 || c.receiveChange()) err(`${tag}: เสียงเงินทอนต้องเล่นครั้งเดียวเมื่อทอนมากกว่า 0`);
        const r = c.result();
        if (r.points !== 2 + Number(choice === plan.best.id) || r.changeCorrect || r.changeAnswer !== paid.change + 1) err(`${tag}: คะแนนหรือคำตอบแรกของเงินทอนผิด`);
      }
      // จ่ายพอดี: ไม่มีเงินทอนและไม่เล่นเสียงเงินทอน
      const exact = CM.createCounter(plan);
      exact.pick('a'); exact.setUnits([0, 0]); exact.scan();
      const coins = []; let sum = 0;
      purse.forEach((value, i) => { if (sum + value <= plan.items[0].price) { coins.push(i); sum += value; } });
      checks++;
      if (sum === plan.items[0].price) {
        const p = exact.pay(coins);
        if (!p.paid || p.change !== 0 || exact.receiveChange()) err(`${tag}: จ่ายพอดีต้องไม่มีเงินทอน`);
      }
    });
  }
}

// ---- 3f) โต๊ะอ่านผลประกอบการ W6R5 (GDD §8): รายงานสมมติ ผลร้านที่ผูกชุดเดียวกัน ตัวอย่าง seed 4001 และแฟ้มผลงาน ----
{
  const PM = require(path.join(GAME, 'js/promo-model.js'));
  const RD = require(path.join(GAME, 'js/report-desk-model.js'));
  M.PromoModel = PM; M.State = {};
  try { vm.runInContext(fs.readFileSync(path.join(GAME, 'js/real-w4.js'), 'utf8'), sandbox, { filename: 'js/real-w4.js' }); } catch (e) { err(`load js/real-w4.js: ${e.message}`); }
  const bad = /undefined|NaN|\[object/;
  checks++;
  if (M.RealW4?.real !== RD.REAL) err('W6R5: ป้ายที่มา "จริง" ของโต๊ะต้องตรงกับ M.RealW4.real');

  // รายงานสมมติ: ตัวอย่างใน spec = 56-1 ปี 2025 หน่วยล้านบาท หน้า 24 รายได้ 124 กำไรสุทธิ 14 เงินสดจากการดำเนินงาน 19
  const th = RD.reportOf('th'), us = RD.reportOf('us');
  const thOk = (metric) => RD.checkReading(th, { metric, page: RD.expected(th, metric).pageId, period: 'fy2025', unit: metric === 'risk' ? 'none' : 'million-thb' });
  checks += 6;
  const thEntry = thOk('netProfit').entry;
  if (!thEntry || thEntry.page !== 24 || thEntry.periodEnd !== '2025-12-31' || thEntry.currency !== 'THB' || thEntry.unit !== 'ล้านบาท' || thEntry.docId !== 'SIM-TH-56-1-2025') err('W6R5: รายการกำไรสุทธิของบริษัทไทยตัวอย่างต้องเป็นหน้า 24 งวด 2025-12-31 THB ล้านบาท');
  if ([124, 14, 19].join() !== ['revenue', 'netProfit', 'opCash'].map((m) => RD.expected(th, m).value).join()) err('W6R5: ตัวเลขรายงานไทยต้องเป็น 124 / 14 / 19');
  const sameKinds = th.periods.every((p, i) => p.id === us.periods[i].id);
  if (!sameKinds || th.docId === us.docId || th.periods[0].end === us.periods[0].end) err('W6R5: สองรายงานต้องมีรหัสเอกสารและวันสิ้นงวดต่างกัน');
  const thC = RD.contrastFor(th), usC = RD.contrastFor(us);
  if (thC.relation !== 'สูงกว่า' || usC.relation !== 'ต่ำกว่า' || thC.gap !== 5 || usC.gap !== -88) err('W6R5: กำไรกับเงินสดของสองบริษัทต้องต่างทิศ (ไทย +5 สหรัฐ −88)');
  if (RD.checkContrast({ profit: 'netProfit', cash: 'opCash' }).ok !== true || RD.checkContrast({ profit: 'opCash', cash: 'opCash' }).ok || RD.checkContrast({}).ok) err('W6R5: ตรวจข้อเทียบกำไรกับเงินสดผิด');
  for (const report of RD.REPORTS) {
    for (const metric of RD.METRICS) {
      checks += 5;
      const want = RD.expected(report, metric.id);
      const picks = { metric: metric.id, page: want.pageId, period: want.periodId, unit: want.unitId };
      const good = RD.checkReading(report, picks);
      if (!good.ok || !good.entry || bad.test(RD.entryText(good.entry))) { err(`W6R5 ${report.key} ${metric.id}: คำตอบถูกต้องต้องผ่านและเรียงข้อความได้`); continue; }
      for (const [field, wrong] of [['page', report.pages.find((p) => p.id !== want.pageId).id], ['period', report.periods.find((p) => p.id !== want.periodId).id], ['unit', report.units.find((u) => u.id !== want.unitId).id]]) {
        const r = RD.checkReading(report, { ...picks, [field]: wrong });
        if (r.ok || !r.errors[field] || r.entry || bad.test(r.errors[field])) err(`W6R5 ${report.key} ${metric.id}: เลือก ${field} ผิดต้องไม่ผ่านและชี้ข้อที่ต้องตรวจ`);
      }
      if (RD.checkReading(report, { ...picks, page: '' }).ok) err(`W6R5 ${report.key} ${metric.id}: ไม่เลือกหน้าต้องไม่ผ่าน`);
    }
  }

  // ตัวอย่างฝึก seed 4001: น้ำดื่ม 25 → 32 ชิ้น ยอดขาย 500 → 604 บาท ผลหลังค่าโปร 200 → 190 บาท คำตัดสิน ปรับ
  for (const pid of Object.keys(M.PRODUCTS)) {
    const s = RD.sampleStore(M.PRODUCTS[pid]), n = s.columns.normal, p = s.columns.promo;
    checks += 3;
    if (s.type !== 'sample' || s.runId !== null || s.baselineId !== null || s.seed !== 4001 || /^จริง/.test(s.columns.normal.provenance)) err(`W6R5 ${pid}: ตัวอย่างฝึกต้องกำกับว่าไม่ใช่ผลผู้เล่นและไม่มีรหัสชุด`);
    if (![n.qty, n.sales, n.cogs, n.result, p.qty, p.sales, p.cogs, p.expense, p.result, s.delta].every(Number.isSafeInteger) || bad.test(RD.portfolioEntry(M.PRODUCTS[pid], s, {}, [thC, usC], 0).text)) err(`W6R5 ${pid}: ตัวอย่างฝึกต้องเป็นสตางค์จำนวนเต็มและแสดงผลได้`);
    if (pid === 'water') {
      const got = [n.qty, p.qty, n.sales, p.sales, n.result, p.result, s.verdict.label, n.minutes].join('/');
      if (got !== '25/32/50000/60400/20000/19000/ปรับ/30') err(`W6R5 น้ำดื่ม seed 4001 ไม่ตรง GDD §8: ได้ ${got}`);
    }
  }

  // ผลร้านที่เป็นของผู้เล่น: ต้องมีรหัสฐาน แผน ผลครบและตรงกัน ใช้ M.RealW4.evidence ตัวจริงเลือกชุดปัจจุบัน
  const water = M.PRODUCTS.water;
  const pick = (store) => RD.resolveStore(water, M.RealW4.evidence({ product: water, state: { sim: { promoV2: { water: store } } } }), store);
  const base = { id: 'base-a', version: 2, source: 'จำลอง', seed: 7, slot: 'pm', event: 'none', T: 30, K0: 60, P: 2000, C: 1200, N0: 20, R0: 40000, COGS0: 24000, G0: 16000 };
  const plan = { id: 'plan-a', baselineId: 'base-a', practiceBase: false, B: 3600, F: 3000 };
  const run = { id: 'run-a', baselineId: 'base-a', planId: 'plan-a', source: 'จำลอง', B: 3600, F: 3000, S: 8, U: 13, N1: 29, R1: 54800, COGS1: 34800, G1: 17000, G0: 16000, delta: 1000, decision: 'ทำต่อ', route: 'list', practiceBase: false };
  const sim = pick({ baseline: base, plan, run });
  checks += 8;
  if (!sim.ok || sim.card.type !== 'player' || sim.card.runId !== 'run-a' || sim.card.verdict.label !== 'ทำต่อ' || sim.card.columns.promo.qty !== 29 || RD.baht(sim.card.columns.promo.sales) !== '548' || sim.card.walkEvidence.length) err('W6R5: ผลจำลองของผู้เล่นที่ผูกชุดเดียวกัน (ไม่มีหลักฐานฉากเดิน) ต้องแสดงได้');
  const walked = pick({ baseline: base, plan, run: { ...run, route: 'walk', evidence: [{ id: 'w4r3-sign', text: '<b>x</b>' }, { id: 'w4r3-stock', text: 'สต็อกเปิด 60' }, null, { text: 'ไม่มีรหัส' }] } });
  if (!walked.ok || walked.card.walkEvidence.map((e) => e.id).join() !== 'w4r3-sign,w4r3-stock') err('W6R5: หลักฐานฉากเดินที่ไม่มีรหัสต้องถูกข้าม ไม่ทำให้ล้ม');
  const rejects = {
    'no-baseline': pick(undefined), 'no-baseline-empty': pick({ baseline: null, plan: null, run: null }),
    practice: pick({ baseline: null, plan: { ...plan, baselineId: 'practice-4002', practiceBase: true }, run: { ...run, baselineId: 'practice-4002', practiceBase: true } }),
    'no-plan': pick({ baseline: { ...base, id: 'base-b' }, plan, run }),
    'no-run': pick({ baseline: base, plan, run: { ...run, planId: null } }),
    'no-run-malformed': pick({ baseline: {}, plan: {} }),
    unlinked: pick({ baseline: { ...base, id: '' }, plan: { ...plan, baselineId: '' }, run: { ...run, baselineId: '' } }),
    legacy: pick({ baseline: { ...base, source: 'เก่า' }, plan, run }),
    numbers: pick({ baseline: base, plan, run: { ...run, R1: 548.5 } }),
  };
  const want = { 'no-baseline': 'no-baseline', 'no-baseline-empty': 'no-baseline', practice: 'practice', 'no-plan': 'no-plan', 'no-run': 'no-run', 'no-run-malformed': 'no-run', unlinked: 'unlinked', legacy: 'legacy', numbers: 'numbers' };
  for (const [name, reason] of Object.entries(want)) {
    checks++;
    const r = rejects[name];
    if (r.ok || r.reason !== reason || !r.message || !Array.isArray(r.go)) err(`W6R5 เหตุปฏิเสธ ${name}: ต้องไม่รับเป็นผลของผู้เล่นและให้เหตุผล ${reason}`);
  }
  if (rejects['no-plan'].go.join() !== '3,1' || rejects['no-baseline'].go.join() !== '3,0' || rejects.practice.go.join() !== '3,2') err('W6R5: ปุ่มกลับต้องพาไป W4R1/W4R2/W4R3 ตามชุดที่ขาด');

  // ผลจริง: เทียบไม่ได้ต้องไม่สรุปผลโปร ส่วนผลคาดการณ์ comparable=false ต้องกำกับตามแบบจำลองและยังรับได้
  const period = { day: '2026-11-01', start: '09:00', duration: 30, endDay: '2026-11-01', end: '09:30' };
  const inputs = { origin: 'บันทึกยอดขายร้าน', reference: 'OBS-1', weather: 'ปกติ', supply: 'มีสินค้าตลอด', competitor: 'ไม่มี', duration: 30, start: '09:00' };
  const realBase = { ...base, id: 'base-r', source: RD.REAL, period, inputs };
  const realPlan = { ...plan, id: 'plan-r', baselineId: 'base-r', practiceBase: undefined };
  const realRun = { ...run, id: 'run-r', baselineId: 'base-r', planId: 'plan-r', source: RD.REAL, kind: 'observed', period, inputs: { ...inputs, weather: 'ฝนตก', matches: true }, comparable: false, decision: null, route: undefined, practiceBase: undefined, sourceByField: { R1: 'คำนวณจากข้อมูลจริง', F: RD.REAL } };
  const inc = pick({ baseline: realBase, plan: realPlan, run: realRun });
  checks += 6;
  if (!inc.ok || inc.card.verdict.decision !== null || inc.card.verdict.label !== RD.INSUFFICIENT || inc.card.comparable !== false || !inc.card.reasons.some((x) => /อากาศ/.test(x)) || inc.card.columns.promo.expenseSource !== RD.REAL) err('W6R5: ผลจริงที่เทียบไม่ได้ต้องแสดง "หลักฐานยังไม่พอ" พร้อมเงื่อนไขที่ต่าง');
  const comp = pick({ baseline: realBase, plan: realPlan, run: { ...realRun, inputs: { ...inputs, matches: true }, comparable: true, decision: 'ทำต่อ' } });
  if (!comp.ok || comp.card.verdict.label !== 'ทำต่อ' || comp.card.comparable !== true || comp.card.columns.promo.provenance !== 'คำนวณจากข้อมูลจริง') err('W6R5: ผลจริงที่เทียบได้ต้องแสดงคำตัดสินและที่มาของคอลัมน์');
  const fc = pick({ baseline: realBase, plan: realPlan, run: { ...realRun, kind: 'forecast', source: RD.SIM, comparable: false, decision: 'ปรับ', sourceByField: { F: RD.PLAN } } });
  if (!fc.ok || fc.card.verdict.label !== 'ปรับ ตามแบบจำลอง' || fc.card.comparable !== false || fc.card.columns.promo.title !== 'ผลโปรจำลอง' || fc.card.columns.normal.provenance !== RD.REAL || fc.card.columns.promo.expenseSource !== RD.PLAN) err('W6R5: ผลคาดการณ์ต้องเป็น "ตามแบบจำลอง" แยกยอดปกติจริงกับผลโปรจำลอง แม้ comparable=false');
  if (fc.card.columns.normal.period !== '2026-11-01 09:00–09:30' || fc.card.columns.normal.minutes !== 30) err('W6R5: ช่วงของฐานจริงต้องแสดงวันที่ เวลา และจำนวนนาที');

  const invalidStores = [
    [{ baseline: realBase, plan: realPlan, run: { ...realRun, kind: undefined } }, 'legacy'],
    [{ baseline: realBase, plan: realPlan, run: { ...realRun, kind: 'forecast' } }, 'legacy'],
    [{ baseline: realBase, plan: realPlan, run: { ...realRun, source: RD.SIM } }, 'legacy'],
    [{ baseline: base, plan, run: { ...run, kind: 'forecast' } }, 'legacy'],
    [{ baseline: { ...realBase, period: null }, plan: realPlan, run: realRun }, 'baseline-period'],
    [{ baseline: realBase, plan: realPlan, run: { ...realRun, period: undefined } }, 'period'],
    [{ baseline: realBase, plan: realPlan, run: { ...realRun, period: { ...period, end: '09:50' } } }, 'period'],
  ];
  for (const [store, reason] of invalidStores) {
    checks++;
    if (pick(store).reason !== reason) err(`W6R5: ชุดผลที่มีที่มาหรือช่วงเวลาขัดกันต้องถูกปฏิเสธ (${reason})`);
  }
  const lateRun = { ...realRun, period: { day: '2026-11-02', start: '23:55', duration: 15, endDay: '2026-11-03', end: '00:10' },
    inputs: { ...inputs, origin: 'นับที่ร้าน', reference: 'OBS-PROMO', start: '23:55', duration: 15, matches: true }, comparable: true, decision: 'ทำต่อ' };
  const late = pick({ baseline: realBase, plan: realPlan, run: lateRun });
  checks += 4;
  if (!late.ok || late.card.columns.promo.period !== '2026-11-02 23:55–2026-11-03 00:10' ||
      late.card.columns.normal.origin !== 'บันทึกยอดขายร้าน (OBS-1)' || late.card.columns.promo.origin !== 'นับที่ร้าน (OBS-PROMO)') err('W6R5: ช่วงโปรข้ามวันและแหล่งอ้างอิงของทั้งสองช่วงต้องอยู่คนละคอลัมน์');
  if (late.card.verdict.decision !== null || !late.card.reasons.some((x) => /30 กับ 15/.test(x)) || !late.card.reasons.some((x) => /09:00 กับ 23:55/.test(x))) err('W6R5: เวลาของสองช่วงที่ต่างกันต้องเตือนแม้เซฟเดิมระบุว่าเทียบได้');
  const missingFactors = pick({ baseline: realBase, plan: realPlan, run: { ...lateRun, inputs: undefined } });
  if (!missingFactors.ok || missingFactors.card.verdict.decision !== null || bad.test(missingFactors.card.reasons.join()) || !missingFactors.card.reasons.includes('อากาศยังไม่ทราบ')) err('W6R5: ข้อมูลสภาพแวดล้อมที่ขาดต้องแสดงว่ายังไม่ทราบ');
  if (fc.card.columns.promo.origin !== null || fc.card.columns.normal.origin !== 'บันทึกยอดขายร้าน (OBS-1)') err('W6R5: ผลคาดการณ์อ้างรหัสของยอดปกติจริงได้เฉพาะฝั่งปกติ');

  // แฟ้มผลงาน: ผลร้านกับรายการอ้างอิงรายงานต้องมีรหัสครบ ไม่มีค่าว่างหรือ NaN และเก็บโครงสร้างไว้ตรวจซ้ำ
  const rows = { th: ['netProfit', 'opCash'].map((m) => thOk(m).entry), us: [RD.checkReading(us, { metric: 'risk', page: 'risk', period: 'fy2025', unit: 'none' }).entry] };
  const out = RD.portfolioEntry(water, sim.card, rows, [thC, usC], 1);
  checks += 4;
  const need = ['base-a', 'plan-a', 'run-a', 'SIM-TH-56-1-2025', 'SIM-US-10K-FY2025', 'หน้า 24', '2025-12-31', 'THB', 'ล้านบาท', 'Item 1A'];
  if (out.key !== 'w6-report-desk-water' || need.some((t) => !out.text.includes(t)) || bad.test(out.text)) err('W6R5: แฟ้มผลงานต้องมีรหัสฐาน แผน ผล รหัสเอกสาร หน้า งวด สกุลเงิน และหน่วย');
  if (out.data.store.runId !== 'run-a' || out.data.store.baselineId !== 'base-a' || out.data.reports.length !== 2 || out.data.reports[0].entries[0].page !== 24 || out.data.reports[0].entries[0].currency !== 'THB') err('W6R5: ข้อมูลโครงสร้างในแฟ้มผลงานไม่ครบ');
  const outLate = RD.portfolioEntry(water, late.card, rows, [thC, usC], 1);
  checks++;
  if (outLate.data.store.runSource !== RD.REAL || outLate.data.store.origins.normal !== 'บันทึกยอดขายร้าน (OBS-1)' ||
      outLate.data.store.origins.promo !== 'นับที่ร้าน (OBS-PROMO)' || outLate.data.store.periods.promo !== late.card.columns.promo.period ||
      !outLate.text.includes('แหล่งข้อมูล นับที่ร้าน (OBS-PROMO)')) err('W6R5: แฟ้มผลงานต้องเก็บที่มาและช่วงเวลาของผลจริงแยกกัน');
  const outSample = RD.portfolioEntry(water, RD.sampleStore(water), { th: [], us: [] }, [thC, usC], 1);
  if (!/ตัวอย่างฝึก/.test(outSample.text) || outSample.data.store.runId !== null) err('W6R5: แฟ้มผลงานที่ใช้ตัวอย่างต้องกำกับว่าเป็นตัวอย่างและไม่อ้างรหัสผลของผู้เล่น');
  if (JSON.stringify(out.data) !== JSON.stringify(JSON.parse(JSON.stringify(out.data)))) err('W6R5: ข้อมูลโครงสร้างต้องเป็น JSON ที่บันทึกลง localStorage ได้');
}

// ---- 3g) โต๊ะคำสั่ง Limit W5R5 (GDD §7, §8): กติกาฝึก การตรวจคำสั่ง การจับคู่ และแฟ้มผลงาน ----
{
  const LD = require(path.join(GAME, 'js/limit-desk-model.js'));
  const bad = /undefined|NaN|\[object|null/;
  const m1 = LD.missionOf(1), m2 = LD.missionOf(2), m3 = LD.missionOf(3);
  checks += 6;
  if (LD.PRACTICE !== 'ค่าฝึกในเกม' || !/เงินสมมติ/.test(LD.SAFETY) || !/ไม่ส่งเข้าตลาดจริง/.test(LD.SAFETY) || !/ไม่ใช่คำแนะนำการลงทุน/.test(LD.SAFETY)) err('W5R5: ต้องกำกับค่าฝึกในเกมและข้อความเงินสมมติ ไม่ส่งเข้าตลาดจริง ไม่ใช่คำแนะนำการลงทุน');
  if (LD.BAND.floor !== 700 || LD.BAND.ceiling !== 1300 || LD.LOT !== 100 || LD.CASH0 !== 1000000) err('W5R5: กติกาฝึกต้องเป็นกรอบ 7.00–13.00 หน่วย 100 หุ้น และเงินเริ่มต้น 10,000 บาท');
  if (LD.tickFor(995) !== 5 || LD.tickFor(1000) !== 10 || LD.stepUp(995) !== 1000 || LD.stepDown(1000) !== 995 || LD.stepDown(1010) !== 1000 || LD.stepUp(1000) !== 1010) err('W5R5: ช่วงราคาต้องเปลี่ยนจาก 0.05 เป็น 0.10 ที่ 10.00 บาท');
  if (LD.band(980).ceiling !== 1270 || LD.band(980).floor !== 690) err('W5R5: กรอบราคาต้องปัดเข้าในกรอบให้ตรงช่วงราคา (ปิด 9.80 → 6.90–12.70)');
  if (Object.keys(M.PRODUCTS).some((pid) => !LD.COMPANIES[pid] || !/^SIM-[A-Z]{3}$/.test(LD.COMPANIES[pid].code))) err('W5R5: ทุกกลุ่มสินค้าต้องมีบริษัทสมมติที่ชื่อย่อขึ้นต้น SIM-');
  if (!LD.LINKS.every((link) => /^https:\/\/www\.set\.or\.th\/th\/market\/information\/trading-procedure\//.test(link.url)) || LD.LINKS.length !== 3) err('W5R5: ลิงก์ตรวจค่าจริงต้องเป็นหน้าทางการของ SET 3 หน้าตาม GDD §7');

  // ตัวอย่างที่คำนวณซ้ำได้: ภารกิจ 1 จับคู่ทันที · ภารกิจ 2 รอ → บางส่วน → ครบ · ภารกิจ 3 คิวราคาเดียวกันแล้วสิ้นสุด
  const r1 = LD.simulate(m1, { price: 1000, qty: 100 }), r2 = LD.simulate(m2, { price: 995, qty: 200 }), r3 = LD.simulate(m3, { price: 990, qty: 300 });
  const got = (r) => [r.status, r.filled, r.expired, r.cost, r.cause, r.seen.join('>')].join('/');
  checks += 4;
  if (got(r1) !== 'filled/100/0/100000/filled/filled') err(`W5R5 ภารกิจ 1: ต้องจับคู่ครบ 100 หุ้นที่ 10.00 ทันที ได้ ${got(r1)}`);
  if (got(r2) !== 'filled/200/0/199000/filled/open>partial>filled' || r2.trades.map((t) => `${t.at}:${t.qty}@${t.price}`).join() !== '10:20:100@995,10:50:100@995') err(`W5R5 ภารกิจ 2: ต้องรอ แล้วจับคู่ 100 + 100 หุ้นที่ 9.95 ได้ ${got(r2)}`);
  if (got(r3) !== 'expired/100/200/99000/queue/open>partial>expired' || !r3.queueHit) err(`W5R5 ภารกิจ 3: คิวที่ 9.90 ต้องได้ 100 หุ้นแล้วสิ้นสุด 200 หุ้น ได้ ${got(r3)}`);
  const runs = [r1, r2, r3].map((result, i) => ({ missionId: i + 1, attempts: 1, result }));
  const w = LD.wallet(runs);
  if (w.cash !== 602000 || w.shares !== 400 || w.spent !== 398000) err(`W5R5: พอร์ตหลัง 3 ภารกิจต้องเหลือ 6,020 บาท และถือ 400 หุ้น ได้ ${LD.baht(w.cash)} / ${w.shares}`);

  // ทุกคำสั่งที่ถูกกติกา: ผลไม่ล้ม ไม่มีค่าว่าง เหตุผลอยู่ในรายการ และภารกิจที่ต้องได้ครบจะไม่ผ่านถ้ายังเหลือ
  for (const m of LD.MISSIONS) {
    for (let p = LD.BAND.floor; p <= m.goal.cap; p = LD.stepUp(p)) {
      checks++;
      const check = LD.validateOrder(m, { price: LD.price(p), qty: String(m.goal.qty) }, LD.CASH0);
      if (!check.ok) { err(`W5R5 ภารกิจ ${m.id}: ราคา ${LD.price(p)} ตามกติกาต้องส่งได้`); continue; }
      const r = LD.simulate(m, check.order);
      const texts = r.steps.map((s) => s.text).join(' ') + LD.runLine({ missionId: m.id, attempts: 1, result: r });
      if (bad.test(texts) || !LD.CAUSES.some((c) => c.id === r.cause) || !['filled', 'expired'].includes(r.status) || r.filled + r.expired !== m.goal.qty) err(`W5R5 ภารกิจ ${m.id} ราคา ${LD.price(p)}: ผลไม่ครบหรือข้อความผิด`);
      if (m.goal.needFill && r.status !== 'filled' && (LD.passed(m, r, true) || r.trades.length || !LD.retryHint(m, r))) err(`W5R5 ภารกิจ ${m.id} ราคา ${LD.price(p)}: คำสั่งที่ยังไม่ครบต้องไม่ผ่าน ไม่มีรายการจับคู่ และมีคำแนะนำให้ส่งใหม่`);
      const wrong = LD.CAUSES.find((c) => c.id !== r.cause).id;
      if (!LD.checkCause(r, r.cause).ok || LD.checkCause(r, wrong).ok || !LD.checkCause(r, wrong).error || bad.test(LD.checkCause(r, wrong).error) || LD.checkCause(r, '').ok) err(`W5R5 ภารกิจ ${m.id} ราคา ${LD.price(p)}: ตรวจเหตุผลผิด`);
    }
  }
  checks += 3;
  if (LD.simulate(m1, { price: 995, qty: 100 }).cause !== 'no-seller' || LD.simulate(m2, { price: 990, qty: 200 }).cause !== 'no-seller' || LD.simulate(m3, { price: 985, qty: 300 }).cause !== 'no-seller') err('W5R5: ราคาที่ต่ำกว่าผู้ขายทั้งวันต้องสิ้นสุดเพราะไม่มีคนเสนอขายที่ราคานั้น');
  if (!LD.passed(m3, r3, true) || LD.passed(m3, r3, false) || !LD.passed(m1, r1, true)) err('W5R5: ภารกิจ 3 ผ่านเมื่ออธิบายถูกแม้ได้ไม่ครบ ภารกิจอื่นต้องได้ครบ');
  if (LD.simulate(m2, { price: 995, qty: 200 }).steps.some((s, i, all) => i && s.status === 'open' && all[i - 1].status !== 'open')) err('W5R5: สถานะต้องไม่ย้อนจากจับคู่กลับไปรอ');

  // ตรวจคำสั่งก่อนส่ง: แต่ละกติกาต้องชี้ช่องที่ผิด
  const v = (order, cash = LD.CASH0) => LD.validateOrder(m2, order, cash).errors;
  const cases = [
    [{ price: '9.93', qty: '200' }, 'price', /0\.05/], [{ price: '10.05', qty: '200' }, 'price', /0\.10/],
    [{ price: '6.95', qty: '200' }, 'price', /กรอบราคา/], [{ price: '13.10', qty: '200' }, 'price', /กรอบราคา/],
    [{ price: '10.00', qty: '200' }, 'price', /ไม่เกิน 9\.95/], [{ price: 'abc', qty: '200' }, 'price', /ตัวเลข/], [{ price: '9.955', qty: '200' }, 'price', /ตัวเลข/],
    [{ price: '9.95', qty: '150' }, 'qty', /ทวีคูณของ 100/], [{ price: '9.95', qty: '100' }, 'qty', /200 หุ้น/], [{ price: '9.95', qty: '' }, 'qty', /จำนวนเต็ม/],
    [{ price: '9.95', qty: '200', cash: 100000 }, 'cash', /1,990.*1,000/],
  ];
  for (const [order, field, re] of cases) {
    checks++;
    const errors = v(order, order.cash);
    if (!errors[field] || !re.test(errors[field]) || bad.test(errors[field])) err(`W5R5: คำสั่ง ${JSON.stringify(order)} ต้องชี้ช่อง ${field}`);
  }
  checks += 2;
  if (!LD.validateOrder(m2, { price: '๙.๙๕', qty: '๒๐๐' }, LD.CASH0).ok || LD.validateOrder(m2, { price: '9.95', qty: '200' }, LD.CASH0).order.reserve !== 199000) err('W5R5: ต้องรับเลขไทยและกันเงินเท่าราคา × จำนวน');
  if (LD.validateOrder(m3, { price: '9.90', qty: '300' }, 296999).ok || !LD.validateOrder(m3, { price: '9.90', qty: '300' }, 297000).ok) err('W5R5: เงินพอดีต้องส่งได้ และขาด 1 สตางค์ต้องส่งไม่ได้');

  // คำถามสรุปและช่องจดค่าจาก SET
  checks += 6;
  if (!LD.checkFinal({ level: 'at-or-below', unmatched: 'no-seller' }).ok || LD.checkFinal({ level: 'exact', unmatched: 'no-seller' }).ok || Object.keys(LD.checkFinal({}).errors).length !== 2) err('W5R5: ตรวจคำถามสรุปผิด');
  const today = '2026-11-28';
  if (LD.checkSetNote({}, today).note !== null || !LD.checkSetNote({}, today).ok) err('W5R5: ไม่จดค่าจาก SET ต้องบันทึกได้');
  if (LD.checkSetNote({ hours: '10:00' }, today).ok || LD.checkSetNote({ date: today }, today).ok) err('W5R5: จดค่าจาก SET ต้องมีทั้งวันที่และค่าอย่างน้อยหนึ่งช่อง');
  if (LD.checkSetNote({ date: '2026-11-29', lot: '100' }, today).ok || LD.checkSetNote({ date: '2026-02-30', lot: '100' }, today).ok) err('W5R5: วันที่ตรวจต้องเป็นวันจริงและไม่เกินวันนี้');
  const note = LD.checkSetNote({ date: today, hours: '  ' + 'ก'.repeat(100), lot: '100 หุ้น' }, today).note;
  if (!note || note.hours.length !== 80 || note.lot !== '100 หุ้น' || note.band !== '') err('W5R5: ค่าที่จดต้องตัดช่องว่างและยาวไม่เกิน 80 ตัวอักษร');
  if (LD.isoDay(new Date(2026, 0, 5)) !== '2026-01-05') err('W5R5: วันที่วันนี้ต้องอยู่ในรูป YYYY-MM-DD');

  // แฟ้มผลงานสัปดาห์ 5: รหัสคำสั่ง รายการจับคู่ พอร์ต และป้ายเงินสมมติครบ ข้อความที่ผู้เล่นจดไม่ทำให้ข้อมูลเสีย
  for (const pid of Object.keys(M.PRODUCTS)) {
    checks += 2;
    const out = LD.portfolioEntry(M.PRODUCTS[pid], runs, pid === 'water' ? note : null, 1);
    const need = [LD.SAFETY, LD.COMPANIES[pid].code, 'ค่าฝึกในเกม', 'SIM-ORD-1', 'SIM-ORD-3-T1', '6,020 บาท', '400 หุ้น', 'รอจับคู่ → จับคู่บางส่วน → สิ้นสุด', pid === 'water' ? 'วันที่ตรวจ 2026-11-28' : 'ยังไม่ได้จดค่าจริงจากเว็บ SET'];
    if (out.key !== `w5-limit-desk-${pid}` || need.some((t) => !out.text.includes(t)) || /undefined|NaN|\[object/.test(out.text)) err(`W5R5 ${pid}: แฟ้มผลงานต้องมีป้ายเงินสมมติ รหัสคำสั่ง รายการจับคู่ และพอร์ต`);
    if (JSON.stringify(out.data) !== JSON.stringify(JSON.parse(JSON.stringify(out.data))) || out.data.runs.length !== 3 || out.data.wallet.cash !== 602000 || out.data.runs[2].cause !== 'queue' || out.data.practice !== true) err(`W5R5 ${pid}: ข้อมูลโครงสร้างในแฟ้มผลงานไม่ครบ`);
  }
  checks++;
  if (!/โต๊ะคำสั่ง Limit/.test(M.WEEKS[4].rounds[4].task) || M.WEEKS[4].rounds[4].engine !== 'mcq' || M.WEEKS[4].rounds[4].questions().length !== 4) err('W5R5: รอบเดิมต้องยังเป็นคำถาม 4 ข้อ และบอกให้เปิดโต๊ะคำสั่ง Limit');
}

// ---- 3c) index.html โหลดทุกไฟล์ใน game/js ด้วยเลขเวอร์ชันเดียวกัน (กันแคชเก่าปนใหม่) ----
{
  const html = fs.readFileSync(path.join(GAME, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="((?:js|css|assets|vendor)\/[^"]+)"/g)].map((m) => m[1]);
  const vers = new Set(refs.map((r) => (r.split('?v=')[1] || '(ไม่มี)')));
  if (vers.size !== 1 || vers.has('(ไม่มี)')) err(`index.html: ต้องระบุ ?v= เลขเดียวกันทุกไฟล์ (${[...vers].join(', ')})`);
  for (const ref of refs) if (!fs.existsSync(path.join(GAME, ref.split('?')[0]))) err(`index.html: ไม่พบ ${ref}`);
  const manifestVersion = /href="manifest\.webmanifest\?v=([^"]+)"/.exec(html)?.[1];
  const worker = fs.readFileSync(path.join(GAME, 'sw.js'), 'utf8');
  const offlineVersion = /^const VERSION = '([^']+)'/m.exec(worker)?.[1];
  checks++;
  if (!vers.has(manifestVersion) || !vers.has(offlineVersion)) err('index.html: manifest และ sw.js ต้องใช้เวอร์ชันเดียวกับไฟล์เกม');
  for (const f of fs.readdirSync(path.join(GAME, 'js'))) {
    checks++;
    if (!refs.some((r) => r.split('?')[0] === `js/${f}`)) err(`index.html: ไม่ได้โหลด js/${f}`);
  }
}

// ---- 4) manifest เสียง/ภาพ ----
const AUDIO_KEYS = ['click', 'correct', 'wrong', 'coin', 'star', 'door', 'levelup', 'tick', 'whoosh', 'note', 'bgm_store', 'rain', 'lesson_step',
  'step_shop', 'shelf_pick', 'notebook', 'scanner', 'cash_change'];
const SPRITE_KEYS = ['shelf', 'counter', 'customer_1', 'customer_2', 'customer_3', 'customer_4', 'customer_5',
  'customer_1_walk', 'customer_2_walk', 'customer_3_walk', 'customer_4_walk',
  'customer_1_pick', 'customer_4_look', 'customer_2_look', 'customer_3_pay', 'customer_5_pay',
  'item_water_small', 'item_water_big', 'item_snack_small', 'item_snack_big', 'item_household_small', 'item_household_big'];
const checkManifest = (name, man, keys) => {
  if (!man) return err(`ไม่พบ ${name}`);
  keys.forEach((k) => { if (!(k in man)) err(`${name}: ขาดคีย์ "${k}" (ห้ามลบ/เปลี่ยนชื่อคีย์)`); });
  Object.entries(man).forEach(([k, v]) => {
    if (!keys.includes(k)) err(`${name}: คีย์ใหม่ "${k}" ต้องขอผ่าน Issue และให้ Claude เพิ่มในโค้ดก่อน`);
    if (Array.isArray(v)) {
      if (k === 'bgm_store' || name.includes('sprites')) err(`${name}: "${k}" ต้องเป็น path ไฟล์ ไม่ใช่ array`);
      if (v.length > 21 || !v.every((x) => x === undefined || Number.isFinite(x))) err(`${name}: "${k}" พารามิเตอร์ ZzFX ต้องเป็นตัวเลขไม่เกิน 21 ค่า`);
      return;
    }
    if (v && typeof v !== 'string') return err(`${name}: "${k}" ต้องเป็น null, path หรือ array`);
    if (v && !fs.existsSync(path.join(GAME, v))) err(`${name}: "${k}" อ้างไฟล์ ${v} แต่ไม่มีไฟล์`);
    else if (v && /\.(ogg|mp3|wav)$/i.test(v) && fs.statSync(path.join(GAME, v)).size > (k.startsWith('bgm') ? 1.5e6 : 2e5)) err(`${name}: ไฟล์ ${v} ใหญ่เกินสเปก`);
  });
};
checkManifest('audio/manifest.js', sandbox.MTL_AUDIO_MANIFEST, AUDIO_KEYS);
checkManifest('sprites/manifest.js', sandbox.MTL_SPRITE_MANIFEST, SPRITE_KEYS);
// ท่ากระทำ W1R2 ต้องเป็น PNG โปร่งใส 176×264 (2 เท่าของท่ายืน) ตาม ART_SPEC
for (const key of SPRITE_KEYS.filter((k) => /_(?:pick|look|pay)$/.test(k))) {
  const file = path.join(GAME, 'assets/sprites', `${key}.png`);
  checks++;
  if (!fs.existsSync(file)) continue;
  const head = fs.readFileSync(file).subarray(0, 26);
  if (head.toString('latin1', 1, 4) !== 'PNG' || head.readUInt32BE(16) !== 176 || head.readUInt32BE(20) !== 264 || head[25] !== 6) err(`sprites: ${key} ต้องเป็น PNG RGBA 176×264`);
}

const voiceIds = sandbox.MTL_VOICE_IDS || new Set();
const voiceDoc = fs.readFileSync(path.join(ROOT, 'docs/VOICE_LINES.md'), 'utf8');
const voiceRows = [...voiceDoc.matchAll(/^\| `([a-z0-9]+)` \| (?:customer|staff) \| (.*?) \| /gm)];
if (!voiceRows.length || voiceIds.size !== voiceRows.length) err('manifest เสียงพากย์ไม่ตรงกับ VOICE_LINES.md');
for (const [, id, line] of voiceRows) {
  checks++;
  const file = path.join(GAME, 'assets/voice', `${id}.ogg`);
  if (!voiceIds.has(id) || M.voiceId(line) !== id) err(`เสียงพากย์ ${id}: รหัสไม่ตรงกับประโยค`);
  else if (!fs.existsSync(file)) err(`เสียงพากย์ ${id}: ไม่พบไฟล์ Ogg`);
  else {
    const bytes = fs.readFileSync(file);
    if (bytes.length > 80000 || bytes.subarray(0, 4).toString() !== 'OggS') err(`เสียงพากย์ ${id}: รูปแบบหรือขนาดไฟล์ไม่ตรงสเปก`);
  }
}

// ---- 4b) เสียง ZzFX ต้องได้ยินจริง (กัน filter/ค่าที่ทำให้เสียงเงียบ) ----
{
  let last = null;
  class AC { constructor() { this.sampleRate = 44100; this.destination = {}; }
    createBuffer(ch, len, rate) { const d = new Float32Array(len); last = { len, rate, d }; return { getChannelData: () => d }; }
    createBufferSource() { return { connect() {}, start() {} }; } }
  const zctx = { AudioContext: AC, Math, Float32Array };
  vm.createContext(zctx);
  try {
    vm.runInContext(fs.readFileSync(path.join(GAME, 'vendor/zzfx/ZzFXMicro.js'), 'utf8') + ';\nthis.zzfx = zzfx;', zctx);
    for (const [k, v] of Object.entries(sandbox.MTL_AUDIO_MANIFEST || {})) {
      if (!Array.isArray(v)) continue;
      checks++;
      zctx.zzfx(...v);
      let peak = 0; for (const x of last.d) peak = Math.max(peak, Math.abs(x));
      const dur = last.len / last.rate;
      if (peak < 0.03) err(`audio/manifest.js: "${k}" เบาเกินจนแทบไม่ได้ยิน (peak ${peak.toFixed(3)}) — filter ค่าบวกคือ high-pass ลองใช้ค่าลบ`);
      if (peak > 1) err(`audio/manifest.js: "${k}" ดังจนแตก (peak ${peak.toFixed(2)})`);
      if (dur > 2.5) err(`audio/manifest.js: "${k}" ยาว ${dur.toFixed(2)} วิ เกินเสียงเอฟเฟกต์`);
    }
  } catch (e) { err(`ตรวจเสียง ZzFX ไม่ได้: ${e.message}`); }
}

const audioDone = AUDIO_KEYS.filter((k) => sandbox.MTL_AUDIO_MANIFEST && sandbox.MTL_AUDIO_MANIFEST[k]).length;
const spriteDone = SPRITE_KEYS.filter((k) => sandbox.MTL_SPRITE_MANIFEST && sandbox.MTL_SPRITE_MANIFEST[k]).length;

console.log(`ตรวจ ${checks} รายการ · ${jsFiles.length} ไฟล์ JS · เสียงเกม ${audioDone}/${AUDIO_KEYS.length} · พากย์ ${voiceIds.size} · ภาพ ${spriteDone}/${SPRITE_KEYS.length}`);
if (errors.length) {
  console.error(`\n❌ พบปัญหา ${errors.length} ข้อ\n- ` + [...new Set(errors)].slice(0, 50).join('\n- '));
  process.exit(1);
}
console.log('✅ ผ่านทั้งหมด พร้อมส่งงาน');

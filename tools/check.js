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

// ---- 3c) index.html โหลดทุกไฟล์ใน game/js ด้วยเลขเวอร์ชันเดียวกัน (กันแคชเก่าปนใหม่) ----
{
  const html = fs.readFileSync(path.join(GAME, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="((?:js|css|assets|vendor)\/[^"]+)"/g)].map((m) => m[1]);
  const vers = new Set(refs.map((r) => (r.split('?v=')[1] || '(ไม่มี)')));
  if (vers.size !== 1 || vers.has('(ไม่มี)')) err(`index.html: ต้องระบุ ?v= เลขเดียวกันทุกไฟล์ (${[...vers].join(', ')})`);
  for (const ref of refs) if (!fs.existsSync(path.join(GAME, ref.split('?')[0]))) err(`index.html: ไม่พบ ${ref}`);
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

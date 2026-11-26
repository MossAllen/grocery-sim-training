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
  path.join(GAME, 'assets/sprites/manifest.js'),
];
for (const f of jsFiles) {
  try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); } catch (e) { err(`syntax ${path.relative(ROOT, f)}: ${e.message}`); }
}

// ---- 2) โหลด util + curriculum + manifests ใน sandbox ----
const sandbox = { window: {}, console, Math, Date, JSON };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['assets/audio/manifest.js', 'assets/sprites/manifest.js', 'js/util.js', 'js/curriculum.js', 'js/reading.js']) {
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
      } else if (w === 3) err(`${tag}: สัปดาห์ 4 ต้องมีคำถามเช็กก่อนเล่น (GDD §4)`);
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

// ---- 4) manifest เสียง/ภาพ ----
const AUDIO_KEYS = ['click', 'correct', 'wrong', 'coin', 'star', 'door', 'levelup', 'tick', 'whoosh', 'note', 'bgm_store'];
const SPRITE_KEYS = ['shelf', 'counter', 'customer_1', 'customer_2', 'customer_3', 'customer_4', 'customer_5',
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
    if (v && /\.(ogg|mp3|wav)$/i.test(v) && fs.statSync(path.join(GAME, v)).size > (k.startsWith('bgm') ? 1.5e6 : 2e5)) err(`${name}: ไฟล์ ${v} ใหญ่เกินสเปก`);
  });
};
checkManifest('audio/manifest.js', sandbox.MTL_AUDIO_MANIFEST, AUDIO_KEYS);
checkManifest('sprites/manifest.js', sandbox.MTL_SPRITE_MANIFEST, SPRITE_KEYS);

const audioDone = AUDIO_KEYS.filter((k) => sandbox.MTL_AUDIO_MANIFEST && sandbox.MTL_AUDIO_MANIFEST[k]).length;
const spriteDone = SPRITE_KEYS.filter((k) => sandbox.MTL_SPRITE_MANIFEST && sandbox.MTL_SPRITE_MANIFEST[k]).length;

console.log(`ตรวจ ${checks} รายการ · ${jsFiles.length} ไฟล์ JS · เสียงจริง ${audioDone}/${AUDIO_KEYS.length} · ภาพ ${spriteDone}/${SPRITE_KEYS.length}`);
if (errors.length) {
  console.error(`\n❌ พบปัญหา ${errors.length} ข้อ\n- ` + [...new Set(errors)].slice(0, 50).join('\n- '));
  process.exit(1);
}
console.log('✅ ผ่านทั้งหมด พร้อมส่งงาน');

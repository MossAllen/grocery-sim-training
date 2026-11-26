#!/usr/bin/env node
/*
 * tools/build_reading.js — สร้าง game/js/reading.js จากตาราง docs/GDD.md §10 (อ่านประกอบรายรอบ)
 *   node tools/build_reading.js
 * รันใหม่ทุกครั้งที่ ChatGPT SOL หรือผู้สอนเติมลิงก์ใน §10 (ช่อง "ต้องค้นเพิ่ม" จะขึ้นเป็นสถานะในเกม)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const md = fs.readFileSync(path.join(ROOT, 'docs/GDD.md'), 'utf8');
const sec = md.split(/^## §10 /m)[1].split(/^## §11 /m)[0];

const cell = (raw) => {
  const s = raw.trim();
  const link = s.match(/\[([^\]]+)\]\((https?:[^)]+)\)/);
  const todo = /^ต้องค้นเพิ่ม/.test(s);
  const note = s.replace(/\[[^\]]+\]\([^)]+\)/, '').replace(/^ต้องค้นเพิ่ม\s*·?\s*/, '').replace(/\s*·\s*$/, '').trim();
  return link ? { status: 'ok', note, title: link[1], url: link[2] } : { status: todo ? 'todo' : 'none', note };
};

const out = {};
for (const line of sec.split('\n')) {
  const m = line.match(/^\|\s*W(\d)R(\d)\s*·\s*([^|]+)\|([^|]+)\|([^|]+)\|\s*$/);
  if (!m) continue;
  out[`${m[1] - 1}-${m[2] - 1}`] = { code: `W${m[1]}R${m[2]}`, topic: m[3].trim(), clip: cell(m[4]), official: cell(m[5]) };
}
const n = Object.keys(out).length;
if (n !== 40) { console.error(`พบ ${n} แถว ต้องมี 40`); process.exit(1); }

const js = `/* reading.js — สร้างอัตโนมัติจาก docs/GDD.md §10 ด้วย tools/build_reading.js · ห้ามแก้มือ */
(function () {
  const M = (window.MTL = window.MTL || {});
  M.READING = ${JSON.stringify(out, null, 1)};
})();
`;
fs.writeFileSync(path.join(ROOT, 'game/js/reading.js'), js);
const count = (k) => Object.values(out).filter((r) => r[k].status === 'ok').length;
console.log(`reading.js: 40 รอบ · คลิป ${count('clip')} · แหล่งทางการ ${count('official')} · ครบทั้งคู่ ${Object.values(out).filter((r) => r.clip.status === 'ok' && r.official.status === 'ok').length}`);

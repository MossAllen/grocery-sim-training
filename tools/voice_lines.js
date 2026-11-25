#!/usr/bin/env node
/*
 * tools/voice_lines.js — ดึงประโยคภาษาอังกฤษทั้งหมดในเกม เพื่อทำไฟล์เสียงพากย์ (ROADMAP การตัดสินใจข้อ 3)
 *   node tools/voice_lines.js            → เขียน docs/VOICE_LINES.md
 * id ของประโยค = ค่า hash ของข้อความ จึงคงที่ แม้ลำดับรอบเปลี่ยน · ประโยคที่มีตัวเลขสุ่มจะไม่ถูกนับ (ใช้ TTS)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GAME = path.join(ROOT, 'game');
const sb = { console, Math, JSON };
sb.window = sb;
vm.createContext(sb);
['js/util.js', 'js/curriculum.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(GAME, f), 'utf8'), sb));
const M = sb.MTL;

const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const clean = (s) => s.replace(/\(.*?\)/g, '').trim();

// ประโยคคงที่ = เหมือนกันทุกครั้งที่สุ่ม (รัน script 25 ครั้งเทียบ)
const lines = new Map();
for (const pid of Object.keys(M.PRODUCTS)) {
  M.WEEKS.forEach((W, w) => W.rounds.forEach((R, r) => {
    if (R.engine !== 'dialogue') return;
    const runs = [];
    for (let k = 0; k < 25; k++) {
      const out = [];
      R.script({ product: M.PRODUCTS[pid], state: { sim: {} }, week: w, idx: r }).forEach((s) => {
        if (s.them) out.push({ who: 'customer', text: clean(s.speakText || s.them) });
        if (s.choices) s.choices.filter((c) => c.ok).forEach((c) => out.push({ who: 'staff', text: c.en }));
      });
      runs.push(out.map((o) => o.who + '|' + o.text));
    }
    const stable = runs[0].filter((x) => runs.every((run) => run.includes(x)));
    stable.forEach((x) => {
      const [who, text] = x.split('|');
      const id = hash(text);
      if (!lines.has(id)) lines.set(id, { id, who, text, where: new Set() });
      lines.get(id).where.add(`ส.${w + 1} ร.${r + 1}`);
    });
  }));
}

const rows = [...lines.values()].sort((a, b) => a.who.localeCompare(b.who) || a.text.localeCompare(b.text));
const md = `# รายการเสียงพากย์ภาษาอังกฤษ (Voice Lines)

> สร้างอัตโนมัติด้วย \`node tools/voice_lines.js\` — ห้ามแก้ด้วยมือ · ${rows.length} ประโยค
> เจ้าของงาน: **Gemini Neo** · ตามการตัดสินใจเฟส 1 ข้อ 3 (docs/ROADMAP.md)

## วิธีส่งงาน
- ไฟล์: \`game/assets/voice/<id>.ogg\` (ตั้งชื่อตามคอลัมน์ id) · mono 44.1 kHz · ≤ 80 KB · ตัดเงียบหัวท้าย
- สำเนียงอเมริกันชัดเจน พูดช้ากว่าปกติเล็กน้อย (ผู้ฟังระดับ A1–A2)
- **customer** = เสียงลูกค้า (ผู้ใหญ่ สลับชาย/หญิงได้) · **staff** = เสียงพนักงานร้าน (ใช้เป็นตัวอย่างให้ผู้ฝึกพูดตาม)
- ประโยคที่มีตัวเลขสุ่ม (ราคา จำนวน เงินทอน) ไม่อยู่ในรายการนี้ — เกมใช้เสียงพูดของเบราว์เซอร์แทน
- ถ้าใช้ AI สร้างเสียง ให้บันทึกชื่อเครื่องมือและเงื่อนไขการใช้งานใน AUDIO_SPEC

| id | ผู้พูด | ประโยค | ใช้ใน |
|---|---|---|---|
${rows.map((r) => `| \`${r.id}\` | ${r.who} | ${r.text} | ${[...r.where].join(', ')} |`).join('\n')}
`;
fs.writeFileSync(path.join(ROOT, 'docs/VOICE_LINES.md'), md);
console.log(`เขียน docs/VOICE_LINES.md · ${rows.length} ประโยค (customer ${rows.filter((r) => r.who === 'customer').length}, staff ${rows.filter((r) => r.who === 'staff').length})`);

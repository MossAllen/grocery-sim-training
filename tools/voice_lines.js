#!/usr/bin/env node
/*
 * tools/voice_lines.js — ดึงประโยคภาษาอังกฤษทั้งหมดในเกม เพื่อทำไฟล์เสียงพากย์ (ROADMAP การตัดสินใจข้อ 3)
 *   node tools/voice_lines.js            → เขียน docs/VOICE_LINES.md
 *   node tools/voice_lines.js --audio    → สร้างเสียงและ manifest ด้วย FFmpeg + libflite
 * id ของประโยค = ค่า hash ของข้อความ จึงคงที่ แม้ลำดับรอบเปลี่ยน · ประโยคที่มีตัวเลขสุ่มจะไม่ถูกนับ (ใช้ TTS)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GAME = path.join(ROOT, 'game');
const sb = { console, Math, JSON };
sb.window = sb;
vm.createContext(sb);
['js/util.js', 'js/curriculum.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(GAME, f), 'utf8'), sb));
const M = sb.MTL;

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
      const id = M.voiceId(text);
      if (lines.has(id) && lines.get(id).text !== text) throw new Error(`รหัสเสียงซ้ำ: ${id}`);
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

if (process.argv.includes('--audio')) {
  const destination = path.join(GAME, 'assets/voice');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mtl-voice-'));
  try {
    for (const row of rows) {
      const text = row.text.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, ', ');
      fs.writeFileSync(path.join(temp, 'line.txt'), text);
      const voice = row.who === 'customer' ? 'rms' : 'slt';
      const output = `${row.id}.ogg`;
      const result = spawnSync('ffmpeg', [
        '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'lavfi', '-i', `flite=textfile=line.txt:voice=${voice}`,
        '-af', 'areverse,silenceremove=start_periods=1:start_threshold=-56dB:start_silence=0.07,areverse,silenceremove=start_periods=1:start_threshold=-56dB:start_silence=0.05,atempo=0.9,aformat=channel_layouts=mono,alimiter=limit=0.63:level=0',
        '-ar', '44100', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '2', '-fflags', '+bitexact', output,
      ], { cwd: temp, encoding: 'utf8', windowsHide: true });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`${row.id}: ${result.stderr}`);
      const size = fs.statSync(path.join(temp, output)).size;
      if (!size || size > 80000) throw new Error(`ขนาดไฟล์เสียงไม่ผ่าน: ${output} (${size} ไบต์)`);
    }
    fs.mkdirSync(destination, { recursive: true });
    for (const { id } of rows) fs.copyFileSync(path.join(temp, `${id}.ogg`), path.join(destination, `${id}.ogg`));
    const manifest = `/* สร้างโดย node tools/voice_lines.js --audio */\nwindow.MTL_VOICE_IDS = new Set([\n${rows.map(({ id }) => `  '${id}',`).join('\n')}\n]);\n`;
    fs.writeFileSync(path.join(destination, 'manifest.js'), manifest);
    console.log(`สร้างไฟล์เสียง Ogg ${rows.length} ไฟล์ พร้อม manifest`);
  } finally {
    for (const file of fs.readdirSync(temp)) fs.unlinkSync(path.join(temp, file));
    fs.rmdirSync(temp);
  }
}

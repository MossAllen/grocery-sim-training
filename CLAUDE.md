# กติกาการทำงานในโปรเจกต์นี้ (สำหรับ Claude)

ตอบเป็นภาษาไทย · repo: https://github.com/MossAllen/grocery-sim-training
**ห้าม push ไป MossAllen/marketing-training-lab** — เป็นเกมอื่นของเจ้าของ

## ทุกครั้งที่ทำงานเสร็จหนึ่งชิ้น ต้องทำครบ 4 ข้อ

1. **ตรวจ** — `node tools/check.js` ต้องผ่าน (ถ้าแก้ในเกม ให้เปิดเล่นในเบราว์เซอร์ด้วย)
2. **เซฟ** — commit (ข้อความบอกว่าทำอะไร) แล้ว push ขึ้น GitHub · ถ้าแก้ไฟล์ที่อยู่ในชุดส่งงาน ให้รัน `python tools/make_bundles.py`
3. **อัปเดต `STATUS.md`** — ย้ายงานที่เสร็จไปช่อง "เสร็จแล้ว" และเขียนขั้นต่อไปใหม่
4. **บอกผู้ใช้ท้ายคำตอบ** ในหัวข้อ "ขั้นต่อไป":
   - ใครทำ (ผู้ใช้ / ChatGPT SOL / Gemini Neo / Blender / Claude)
   - ทำที่ไหน ด้วยเครื่องมืออะไร (เว็บ/โปรแกรม/โฟลเดอร์)
   - เอาไฟล์อะไรไป (เช่น `dist/handoff-gemini-neo.zip`)
   - ได้งานกลับมาแล้วส่งต่อที่ไหน (วางไฟล์ตรงไหน → branch/PR หรือส่งกลับมาให้ Claude)

## แผนที่เอกสาร
- สถานะและขั้นต่อไป: `STATUS.md`
- ขั้นตอนส่งต่องาน: `docs/HANDOFF.md` · ชุดส่งงาน: `handoff/to-*.md`, `dist/*.zip`
- แผนเฟส: `docs/ROADMAP.md` · แหล่งอ้างอิง: `docs/RESEARCH.md`
- งานแสง เอฟเฟกต์ และตรวจท่าทางใน Blender ให้เริ่มที่ [สกิล Grocery Blender VFX](.agents/skills/grocery-blender-vfx/SKILL.md) และ [ใบส่งงาน Blender](handoff/to-blender.md)

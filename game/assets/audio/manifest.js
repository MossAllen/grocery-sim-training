/*
 * AUDIO MANIFEST — เจ้าของไฟล์: ทีมเสียง (Gemini Neo)
 * --------------------------------------------------------------
 * ใส่ค่าแทน null ทีละคีย์ ได้ 2 แบบ:
 *   - path ไฟล์เสียง (วางไฟล์ไว้ในโฟลเดอร์นี้) เช่น "assets/audio/correct.ogg"
 *   - พารามิเตอร์ ZzFX เป็น array เช่น [1,.05,523,0,.1,.2,1] (ออกแบบที่ https://killedbyapixel.github.io/ZzFX/)
 *     ไม่ใช้กับ bgm_store (เพลงต้องเป็นไฟล์)
 * ถ้าเป็น null หรือโหลดไฟล์ไม่ได้ เกมจะใช้เสียงสังเคราะห์ (WebAudio) แทนอัตโนมัติ
 * รายละเอียดแต่ละเสียง ความยาว อารมณ์ และจุดที่เล่น ดู docs/AUDIO_SPEC.md
 * ห้ามเปลี่ยนชื่อคีย์ — โค้ดเกมเรียกด้วยชื่อคีย์เหล่านี้
 */
window.MTL_AUDIO_MANIFEST = {
  click:      null, // "assets/audio/click.ogg"
  correct:    null,
  wrong:      null,
  coin:       null,
  star:       null,
  door:       null,
  levelup:    null,
  tick:       null,
  whoosh:     null,
  note:       null,
  bgm_store:  null  // เพลงพื้นหลังวนลูปในฉากร้าน (ไม่บังคับ)
};

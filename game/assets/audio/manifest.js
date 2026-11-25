/*
 * AUDIO MANIFEST — เจ้าของไฟล์: ทีมเสียง (Gemini Neo)
 * --------------------------------------------------------------
 * ใส่ path ไฟล์เสียงจริงแทน null ทีละคีย์ (วางไฟล์ไว้ในโฟลเดอร์นี้)
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

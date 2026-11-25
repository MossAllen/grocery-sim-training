/*
 * sfx.js — ระบบเสียง (โค้ด: Claude / ไฟล์เสียงจริง: Gemini Neo)
 * เรียกใช้: MTL.sfx.play('correct')
 * ลำดับการหาเสียง: 1) ค่าใน MTL_AUDIO_MANIFEST  2) เสียงสังเคราะห์สำรองด้านล่าง
 * ค่าใน manifest เป็นได้ 2 แบบ:
 *   "assets/audio/x.ogg"        → เล่นไฟล์เสียง
 *   [1,.05,523,0,.1,.2,1]       → พารามิเตอร์ ZzFX (ออกแบบได้ที่ https://killedbyapixel.github.io/ZzFX/)
 */
(function () {
  const M = (window.MTL = window.MTL || {});
  const manifest = window.MTL_AUDIO_MANIFEST || {};
  const cache = {};
  let ctx = null;
  let bgm = null;

  function ac() {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type = 'sine', vol = 0.12, when = 0, slide = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol = 0.08, when = 0, freq = 1200) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + when;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(freq * 3, t + dur);
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(c.destination); src.start(t);
  }

  // เสียงสำรอง (placeholder) — Gemini แทนที่ด้วยไฟล์จริงผ่าน manifest
  const synth = {
    click: () => tone(700, 0.05, 'square', 0.04),
    correct: () => { tone(523, 0.12, 'triangle'); tone(659, 0.12, 'triangle', 0.12, 0.08); tone(784, 0.22, 'triangle', 0.12, 0.16); },
    wrong: () => { tone(240, 0.16, 'sawtooth', 0.06); tone(170, 0.26, 'sawtooth', 0.06, 0.12); },
    coin: () => { tone(988, 0.07, 'square', 0.05); tone(1319, 0.22, 'square', 0.05, 0.06); },
    star: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, 'triangle', 0.1, i * 0.09)); },
    door: () => { tone(1568, 0.25, 'sine', 0.06); tone(1175, 0.4, 'sine', 0.06, 0.18); },
    levelup: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.1, i * 0.1)); },
    tick: () => tone(1200, 0.03, 'square', 0.03),
    whoosh: () => noise(0.3, 0.06, 0, 500),
    note: () => { noise(0.12, 0.05, 0, 3000); tone(880, 0.08, 'sine', 0.05, 0.05); },
  };

  M.sfx = {
    play(key) {
      if (!M.State || !M.State.data.settings.sound) return;
      const url = manifest[key];
      if (Array.isArray(url) && typeof zzfx === 'function') {
        try { zzfxX.resume(); zzfx(...url); return; } catch (e) { /* ใช้เสียงสำรองด้านล่าง */ }
      }
      if (typeof url === 'string' && url) {
        let a = cache[key];
        if (!a) { a = cache[key] = new Audio(url); a.onerror = () => { manifest[key] = null; }; }
        const b = a.cloneNode(); b.volume = 0.7;
        b.play().catch(() => synth[key] && synth[key]());
        return;
      }
      synth[key] && synth[key]();
    },
    startBgm() {
      if (!M.State || !M.State.data.settings.sound || typeof manifest.bgm_store !== 'string') return;
      if (!bgm) { bgm = new Audio(manifest.bgm_store); bgm.loop = true; bgm.volume = 0.25; }
      bgm.play().catch(() => {});
    },
    stopBgm() { if (bgm) bgm.pause(); },
  };
})();

/* util.js — ตัวช่วยทั่วไป (Claude) */
(function () {
  const M = (window.MTL = window.MTL || {});

  M.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  M.$ = (sel, root = document) => root.querySelector(sel);
  M.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  M.R = {
    int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    shuffle: (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
    chance: (p) => Math.random() < p,
  };

  M.round2 = (n) => Math.round(n * 100) / 100;
  M.readDecimal = (value, precision = 0) => {
    const text = String(value).trim().replace(/[๐-๙]/g, (digit) => String(digit.charCodeAt(0) - 0x0e50));
    const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
    if (!match || (match[3] || '').length > precision) return null;
    const scaled = Number(match[2] + (match[3] || '').padEnd(precision, '0'));
    return Number.isSafeInteger(scaled) ? (match[1] ? -scaled : scaled) : null;
  };
  M.fmt = (n, d = 2) => {
    const r = Math.round(n * 10 ** d) / 10 ** d;
    return r.toLocaleString('th-TH', { maximumFractionDigits: d });
  };

  // ตัวเลขเป็นคำอังกฤษ (0–999,999) สำหรับฝึกพูดราคา
  const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function under1000(n) {
    let s = '';
    if (n >= 100) { s += ones[Math.floor(n / 100)] + ' hundred'; n %= 100; if (n) s += ' and '; }
    if (n >= 20) { s += tens[Math.floor(n / 10)]; if (n % 10) s += '-' + ones[n % 10]; }
    else if (n > 0 || s === '') s += ones[n];
    return s;
  }
  M.words = (n) => {
    n = Math.round(n);
    if (n < 1000) return under1000(n);
    const th = Math.floor(n / 1000), rest = n % 1000;
    return under1000(th) + ' thousand' + (rest ? (rest < 100 ? ' and ' : ' ') + under1000(rest) : '');
  };
  M.baht = (n) => `${M.words(n)} baht`;

  // รหัสเดียวกับรายการเสียงใน tools/voice_lines.js
  M.voiceId = (text) => {
    let hash = 2166136261;
    for (const char of text.trim()) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
    return (hash >>> 0).toString(36);
  };

  let stopVoice;
  M.stopSpeaking = () => { if (stopVoice) stopVoice(); };

  // Use CORS mode on local audio so Safari can read cached byte ranges offline.
  M.createGameAudio = (url) => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = url;
    return audio;
  };

  // ใช้ไฟล์ในเกมก่อน แล้วใช้ Web Speech API เมื่อไม่มีไฟล์หรือเล่นไม่ได้
  M.speak = (text, lang = 'en-US') => {
    if (!M.State?.data.settings.tts || typeof text !== 'string' || !text.trim()) return Promise.resolve();
    M.stopSpeaking();
    return new Promise((resolve) => {
      const speech = window.speechSynthesis;
      const limit = Math.max(4000, text.length * 145);
      let timer, clip, utterance, fallbackStarted = false;
      const stop = () => {
        if (stopVoice !== stop) return;
        stopVoice = null;
        M.sfx?.setSpeechActive?.(false);
        clearTimeout(timer);
        clip?.pause();
        if (utterance) speech.cancel();
        resolve();
      };
      stopVoice = stop;
      M.sfx?.setSpeechActive?.(true);
      const fallback = () => {
        if (stopVoice !== stop || fallbackStarted) return;
        fallbackStarted = true;
        clearTimeout(timer);
        clip?.pause();
        if (!speech || typeof SpeechSynthesisUtterance !== 'function') { stop(); return; }
        try {
          utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = lang; utterance.rate = 0.92;
          const voice = speech.getVoices().find((candidate) => candidate.lang?.startsWith(lang.slice(0, 2)));
          if (voice) utterance.voice = voice;
          utterance.onend = utterance.onerror = stop;
          timer = setTimeout(stop, limit);
          speech.speak(utterance);
        } catch (error) { stop(); }
      };

      const id = M.voiceId(text);
      if (lang !== 'en-US' || !window.MTL_VOICE_IDS?.has(id)) { fallback(); return; }
      try {
        clip = M.createGameAudio(`assets/voice/${id}.ogg`);
        clip.addEventListener('ended', () => { if (!fallbackStarted) stop(); }, { once: true });
        clip.addEventListener('error', fallback, { once: true });
        clip.addEventListener('playing', () => {
          if (stopVoice !== stop || fallbackStarted) return;
          clearTimeout(timer);
          timer = setTimeout(stop, limit);
        }, { once: true });
        timer = setTimeout(fallback, 2500);
        clip.play().catch(fallback);
      } catch (error) { fallback(); }
    });
  };

  // ท่าทางลูกค้าแบบ stud ใช้ร่วมกันทั้งฉาก 2 มิติและ 3 มิติ (ไม่แตะ DOM)
  // walk: ก้าวละ 4 จังหวะ ยืน → ก้าว → ยืน → ก้าวกลับข้าง ตัวเด้งขึ้นกลางก้าว ยุบเล็กน้อยตอนเท้าแตะ
  // idle: หายใจเบา ๆ · pop: เด้งยืดยุบตอนเปลี่ยนเป็นท่ากระทำ (0.45 วินาที)
  M.StudMotion = {
    POP_SECONDS: 0.45,
    walk(distance, strideLength) {
      const phase = ((distance / strideLength) % 1 + 1) % 1;
      const quarter = Math.floor(phase * 4);
      const lift = Math.abs(Math.sin(phase * 4 * Math.PI));
      return { frame: quarter % 2 ? 'walk' : 'stand', flip: quarter === 3, lift,
        squash: 1 - 0.07 * (1 - lift), step: Math.floor(phase * 2) };
    },
    idle(seconds, seed = 0) { return 1 + 0.018 * Math.sin(seconds * 2.4 + seed * 1.7); },
    pop(age) {
      if (!(age >= 0 && age < M.StudMotion.POP_SECONDS)) return { sx: 1, sy: 1, sparkle: 0 };
      const u = age / M.StudMotion.POP_SECONDS, wave = Math.sin(u * Math.PI * 2.5) * (1 - u);
      return { sx: 1 - 0.12 * wave, sy: 1 + 0.18 * wave, sparkle: 1 - u };
    },
  };

  M.download = (filename, text) => {
    const blob = new Blob(['﻿' + text], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
})();

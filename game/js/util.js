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

  // เสียงพูดภาษาอังกฤษด้วย Web Speech API
  M.speak = (text, lang = 'en-US') => {
    if (!M.State || !M.State.data.settings.tts) return;
    if (!('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang; u.rate = 0.92;
      const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith(lang.slice(0, 2)));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* ไม่มีเสียงพูดก็เล่นต่อได้ */ }
  };

  M.download = (filename, text) => {
    const blob = new Blob(['﻿' + text], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
})();
